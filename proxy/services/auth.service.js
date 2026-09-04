/**
 * VBAI Local Authentication Service
 * Standalone JWT + Email/Password + Google OAuth2 Token validation on VPS.
 */
'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const dbService = require('./db.service');
const { getFirebaseAuth, initFirebase } = require('./firebase-admin.service');

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const IS_PRODUCTION = ['production', 'prod'].includes(String(process.env.NODE_ENV || process.env.APP_ENV || '').trim().toLowerCase());

if (IS_PRODUCTION && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return JWT_SECRET;
}

const googleClient = new OAuth2Client();

function generateToken(user) {
  const payload = {
    uid: user.uid || user._id,
    user_id: user.uid || user._id,
    email: user.email,
    name: user.displayName || user.name || user.email?.split('@')[0],
    admin: user.role === 'admin' || user.isAdmin === true || user.customClaims?.admin === true,
    role: user.role || (user.isAdmin || user.customClaims?.admin ? 'admin' : 'user')
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    return jwt.verify(cleanToken, getJwtSecret());
  } catch (error) {
    return null;
  }
}

async function registerWithEmail(email, password, displayName = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password || password.length < 6) {
    throw new Error('Vui lòng nhập email hợp lệ và mật khẩu tối thiểu 6 ký tự');
  }

  const existing = await dbService.getUserByEmail(normalizedEmail);
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Nếu tài khoản đã tồn tại
  if (existing) {
    if (existing.passwordHash) {
      throw new Error('Email này đã được đăng ký. Vui lòng chọn tab "Đăng nhập" để truy cập');
    }

    // Nếu tài khoản đã tồn tại (từ danh sách thành viên trước đây) nhưng chưa có mật khẩu local
    const updated = await dbService.updateUser(existing.uid || existing._id, {
      displayName: displayName || existing.displayName || normalizedEmail.split('@')[0],
      passwordHash: passwordHash,
      last_login_at: new Date()
    });
    const userToReturn = updated || { ...existing, passwordHash };
    const token = generateToken(userToReturn);
    return { user: sanitizeUser(userToReturn), token, message: 'Đã kích hoạt mật khẩu cho tài khoản thành công!' };
  }

  const uid = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isAdmin = ['haichau2404@gmail.com', 'admin@vbai.tracuu.lamdong.vn'].includes(normalizedEmail);

  const newUser = {
    _id: uid,
    uid: uid,
    email: normalizedEmail,
    displayName: displayName || normalizedEmail.split('@')[0],
    passwordHash: passwordHash,
    role: isAdmin ? 'admin' : 'user',
    isAdmin: isAdmin,
    created_at: new Date(),
    updated_at: new Date(),
    last_login_at: new Date()
  };

  await dbService.createUser(newUser);
  const token = generateToken(newUser);
  return { user: sanitizeUser(newUser), token };
}

async function loginWithEmail(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu');
  }

  const user = await dbService.getUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error('Tài khoản không tồn tại trong hệ thống. Bạn có thể bấm "Đăng ký miễn phí" để tạo tài khoản mới.');
  }

  if (!user.passwordHash) {
    throw new Error('Tài khoản này được đăng ký qua Google hoặc chưa tạo mật khẩu. Vui lòng bấm "Đăng ký miễn phí" để thiết lập mật khẩu, hoặc chọn "Đăng nhập bằng Google".');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại');
  }

  await dbService.updateUser(user.uid || user._id, { last_login_at: new Date() });
  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

async function loginWithGoogleCredential(idToken) {
  if (!idToken) {
    throw new Error('Thiếu Google ID Token');
  }

  let email = '';
  let name = '';
  let picture = '';
  let uid = '';
  let isAdmin = false;

  // 1. Try Firebase Auth verifyIdToken (client sends Firebase ID token)
  try {
    initFirebase();
    const fbDecoded = await getFirebaseAuth().verifyIdToken(idToken);
    email = String(fbDecoded.email || '').trim().toLowerCase();
    name = fbDecoded.name || email.split('@')[0];
    picture = fbDecoded.picture || '';
    uid = fbDecoded.uid;
    isAdmin = fbDecoded.admin === true || ['haichau2404@gmail.com', 'admin@vbai.tracuu.lamdong.vn'].includes(email);
  } catch (fbErr) {
    // 2. Fallback to raw Google OAuth2 ID token verification
    try {
      const ticket = await googleClient.verifyIdToken({ idToken });
      const payload = ticket.getPayload();
      email = String(payload.email || '').trim().toLowerCase();
      name = payload.name || email.split('@')[0];
      picture = payload.picture || '';
      uid = `goog_${payload.sub || Date.now()}`;
      isAdmin = ['haichau2404@gmail.com', 'admin@vbai.tracuu.lamdong.vn'].includes(email);
    } catch (gErr) {
      console.error('[Google Auth] Verification error:', fbErr.message, gErr.message);
      throw new Error('Xác thực Google không thành công. Vui lòng thử lại.');
    }
  }

  if (!email) {
    throw new Error('Không lấy được email từ tài khoản Google');
  }

  let user = await dbService.getUserByEmail(email);
  if (!user) {
    user = {
      _id: uid || `usr_${Date.now()}`,
      uid: uid || `usr_${Date.now()}`,
      email: email,
      displayName: name,
      photoURL: picture,
      role: isAdmin ? 'admin' : 'user',
      isAdmin: isAdmin,
      provider: 'google',
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: new Date()
    };
    await dbService.createUser(user);
  } else {
    user = await dbService.updateUser(user.uid || user._id, {
      displayName: name || user.displayName,
      photoURL: picture || user.photoURL,
      last_login_at: new Date(),
      ...(isAdmin ? { role: 'admin', isAdmin: true } : {})
    }) || user;
  }

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

function sanitizeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.customClaims;
  return safe;
}

module.exports = {
  generateToken,
  verifyToken,
  registerWithEmail,
  loginWithEmail,
  loginWithGoogleCredential,
  sanitizeUser,
};
