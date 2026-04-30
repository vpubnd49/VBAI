import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from '../main.js';

import { firebaseConfig } from '../firebase-config.js';

let isRegistering = false;

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-logo">
          <img src="/vbai_logo.png" alt="VBAI Logo" style="width: 80px; height: 80px; margin: 0 auto 15px auto; display: block; border-radius: 12px;">
          <h2>Đăng nhập vào VBAI</h2>
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
        background: #fdfaf6; /* soft warm background */
        font-family: 'Inter', sans-serif;
      }
      .login-card {
        background: white;
        width: 100%;
        max-width: 400px;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        text-align: center;
      }
      .login-logo h2 {
        font-size: 1.2rem;
        color: #333;
        font-weight: 500;
        margin-bottom: 24px;
      }
      .btn-google {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.9rem;
        font-weight: 500;
        color: #333;
        cursor: pointer;
        transition: background 0.2s;
        margin-bottom: 24px;
      }
      .btn-google img {
        margin-right: 10px;
      }
      .btn-google:hover {
        background: #f9f9f9;
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
        border-bottom: 1px solid #eee;
      }
      .divider span {
        padding: 0 10px;
        color: #999;
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
        color: #555;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }
      .form-group input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .form-group input:focus {
        border-color: #b71c1c;
      }
      .forgot-pwd {
        text-align: right;
        margin-bottom: 24px;
      }
      .forgot-pwd a {
        font-size: 0.8rem;
        color: #666;
        text-decoration: none;
      }
      .btn-submit {
        width: 100%;
        padding: 12px;
        background: #b71c1c; /* Deep red matching the design */
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn-submit:hover {
        background: #9a1717;
      }
      .login-footer {
        margin-top: 24px;
        font-size: 0.85rem;
        color: #666;
      }
      .login-footer a {
        color: #333;
        font-weight: 600;
        text-decoration: none;
      }
    `;
    document.head.appendChild(style);
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

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
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await saveUserToDb(db, result.user);
      showToast('Đăng nhập thành công!');
    } catch (error) {
      showToast('Lỗi đăng nhập Google: ' + error.message, 'error');
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
        showToast('Đăng ký thành công!');
      } else {
        await signInWithEmailAndPassword(auth, email, pwd);
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
