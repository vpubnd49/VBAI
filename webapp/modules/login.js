import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './ui-utils.js';

import { firebaseConfig } from '../firebase-config.js';

let isRegistering = false;

async function updateAdminState(user) {
  try {
    if (!user) {
      window.isAdmin = false;
      localStorage.setItem('vbai_is_admin', 'false');
      return false;
    }
    const tokenResult = await user.getIdTokenResult(true);
    const admin = tokenResult?.claims?.admin === true;
    window.isAdmin = admin;
    localStorage.setItem('vbai_is_admin', admin ? 'true' : 'false');
    return admin;
  } catch (e) {
    console.warn('Khong the doc custom claims admin:', e);
    window.isAdmin = false;
    localStorage.setItem('vbai_is_admin', 'false');
    return false;
  }
}

function shouldPreferRedirectLogin() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|chromium|edg|opr/.test(ua);
  const isFirefox = /firefox|fxios/.test(ua);
  const isInAppBrowser = /fbav|fban|instagram|zalo|line|webview|wv/.test(ua);
  return isMobile || isSafari || isFirefox || isInAppBrowser;
}

function canFallbackToRedirect(errorCode = "") {
  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/web-storage-unsupported",
    "auth/operation-not-supported-in-this-environment",
  ].includes(errorCode);
}

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-logo">
          <img src="/admin-assistant-logo.svg" alt="Logo Trợ lý hành chính" style="width: 80px; height: 80px; margin: 0 auto 15px auto; display: block; border-radius: 12px;">
          <h2>Đăng nhập vào Trợ lý hành chính</h2>
        </div>
        
        <button id="btn-google-login" class="btn-google">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18">
          Đăng nhập bằng Google
        </button>
        
        <div class="divider">
          <span>HOẶC</span>
        </div>
        
        <form id="login-form">
          <div class="form-group">
            <label>EMAIL / TÊN ĐĂNG NHẬP</label>
            <input type="email" id="login-email" placeholder="Nhập email hoặc tên đăng nhập" required>
          </div>
          
          <div class="form-group">
            <label>MẬT KHẨU</label>
            <input type="password" id="login-pwd" placeholder="Nhập mật khẩu" required>
          </div>
          
          <div class="forgot-pwd">
            <a href="#">Quên mật khẩu?</a>
          </div>
          
          <button type="submit" id="btn-submit" class="btn-submit">Đăng nhập</button>
        </form>
        
        <div class="login-footer">
          <span id="toggle-mode-text">Chưa có tài khoản?</span> 
          <a href="#" id="btn-toggle-mode">Đăng ký miễn phí</a>
        </div>
      </div>
    </div>
  `;

  // Dynamic Styles
  if (!document.getElementById('login-styles')) {
    const style = document.createElement('style');
    style.id = 'login-styles';
    style.textContent = `
      .login-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent 35%), linear-gradient(135deg, #081120 0%, #0f1f38 55%, #132a4a 100%);
        font-family: 'Inter', sans-serif;
      }
      .login-card {
        background: rgba(15, 31, 56, 0.82);
        width: 100%;
        max-width: 400px;
        padding: 40px;
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.45), 0 0 30px rgba(59, 130, 246, 0.14);
        text-align: center;
        border: 1px solid rgba(96, 165, 250, 0.2);
        backdrop-filter: blur(16px);
      }
      .login-logo h2 {
        font-size: 1.2rem;
        color: #e6f1ff;
        font-weight: 600;
        margin-bottom: 24px;
        letter-spacing: 0.3px;
      }
      .btn-google {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(96, 165, 250, 0.18);
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 500;
        color: #cfe4ff;
        cursor: pointer;
        transition: background 0.2s, box-shadow 0.2s;
        margin-bottom: 24px;
      }
      .btn-google img {
        margin-right: 10px;
      }
      .btn-google:hover {
        background: rgba(59, 130, 246, 0.12);
        box-shadow: 0 4px 14px rgba(59, 130, 246, 0.18);
      }
      .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin-bottom: 24px;
      }
      .divider::before, .divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid rgba(96, 165, 250, 0.18);
      }
      .divider span {
        padding: 0 10px;
        color: rgba(226, 241, 255, 0.58);
        font-size: 0.8rem;
        font-weight: 500;
      }
      .form-group {
        text-align: left;
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: rgba(226, 241, 255, 0.78);
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }
      .form-group input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid rgba(96, 165, 250, 0.2);
        border-radius: 8px;
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
        box-sizing: border-box;
        background: rgba(8, 17, 32, 0.55);
        color: #e6f1ff;
      }
      .form-group input:focus {
        border-color: #60A5FA;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
      }
      .forgot-pwd {
        text-align: right;
        margin-bottom: 24px;
      }
      .forgot-pwd a {
        font-size: 0.8rem;
        color: #93C5FD;
        text-decoration: none;
        font-weight: 500;
      }
      .forgot-pwd a:hover {
        text-decoration: underline;
      }
      .btn-submit {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #1E40AF, #2563EB);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 8px 24px rgba(37, 99, 235, 0.28);
      }
      .btn-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 28px rgba(37, 99, 235, 0.35);
        filter: brightness(1.05);
      }
      .login-footer {
        margin-top: 24px;
        font-size: 0.85rem;
        color: rgba(226, 241, 255, 0.62);
      }
      .login-footer a {
        color: #93C5FD;
        font-weight: 600;
        text-decoration: none;
      }
      .login-footer a:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  getRedirectResult(auth)
    .then(async (result) => {
      if (result?.user) {
        await saveUserToDb(db, result.user);
        await updateAdminState(result.user);
        showToast('Dang nhap thanh cong!');
      }
    })
    .catch((error) => {
      if (error?.code) {
        showToast('Loi dang nhap Google: ' + (error?.message || error.code), 'error');
      }
    });

  const form = container.querySelector('#login-form');
  const btnGoogle = container.querySelector('#btn-google-login');
  const btnSubmit = container.querySelector('#btn-submit');
  const btnToggle = container.querySelector('#btn-toggle-mode');
  const toggleText = container.querySelector('#toggle-mode-text');

  btnToggle.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    if (isRegistering) {
      btnSubmit.textContent = 'Đăng ký';
      toggleText.textContent = 'Đã có tài khoản?';
      btnToggle.textContent = 'Đăng nhập';
    } else {
      btnSubmit.textContent = 'Đăng nhập';
      toggleText.textContent = 'Chưa có tài khoản?';
      btnToggle.textContent = 'Đăng ký miễn phí';
    }
  });

  // Handle Google Login
  btnGoogle.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const oldLabel = btnGoogle.innerHTML;
    btnGoogle.disabled = true;
    btnGoogle.textContent = 'Dang mo Google...';
    try {
      if (shouldPreferRedirectLogin()) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      await saveUserToDb(db, result.user);
      showToast('Dang nhap thanh cong!');
    } catch (error) {
      const code = error?.code || '';
      const shouldFallbackToRedirect = canFallbackToRedirect(code);

      if (shouldFallbackToRedirect) {
        try {
          showToast('Popup bi chan, chuyen sang dang nhap redirect...');
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          showToast('Loi dang nhap Google: ' + (redirectError?.message || 'Khong the redirect dang nhap'), 'error');
        }
      } else {
        showToast('Loi dang nhap Google: ' + (error?.message || 'Khong xac dinh'), 'error');
      }
    } finally {
      btnGoogle.disabled = false;
      btnGoogle.innerHTML = oldLabel;
    }
  });

  // Handle Email Login/Register
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pwd = document.getElementById('login-pwd').value;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Đang xử lý...';

    try {
      if (isRegistering) {
        const result = await createUserWithEmailAndPassword(auth, email, pwd);
        await saveUserToDb(db, result.user);
        await updateAdminState(result.user);
        showToast('Đăng ký thành công!');
      } else {
        const result = await signInWithEmailAndPassword(auth, email, pwd);
        await updateAdminState(result.user);
        showToast('Đăng nhập thành công!');
      }
    } catch (error) {
      // Human readable errors
      let msg = error.message;
      if (msg.includes('invalid-credential')) msg = 'Sai email hoặc mật khẩu';
      if (msg.includes('email-already-in-use')) msg = 'Email này đã được đăng ký';
      if (msg.includes('weak-password')) msg = 'Mật khẩu quá yếu (cần tối thiểu 6 ký tự)';
      showToast('Lỗi: ' + msg, 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = isRegistering ? 'Đăng ký' : 'Đăng nhập';
    }
  });
}

async function saveUserToDb(db, user) {
  try {
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || '',
      lastLogin: serverTimestamp(),
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("Lỗi lưu user:", e);
  }
}


