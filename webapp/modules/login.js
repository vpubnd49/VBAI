import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from '../main.js';

const firebaseConfig = {
  apiKey: "AIzaSyAmdSiD2byxr19cZZ7xc2HUpbsAWDChZzw",
  authDomain: "vbai-a1729.firebaseapp.com",
  projectId: "vbai-a1729",
  storageBucket: "vbai-a1729.firebasestorage.app",
  messagingSenderId: "691819234622",
  appId: "1:691819234622:web:d34caa7684c1949a5c986f",
  measurementId: "G-XLHHMNXRND"
};

let isRegistering = false;

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-logo">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none" style="margin: 0 auto 10px auto;">
            <path d="M4 7C4 5.34 5.34 4 7 4h14c1.66 0 3 1.34 3 3v14c0 1.66-1.34 3-3 3H7c-1.66 0-3-1.34-3-3V7z" fill="url(#logo-grad-login)" opacity="0.9"/>
            <path d="M9 10h10M9 14h7M9 18h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
            <defs>
              <linearGradient id="logo-grad-login" x1="4" y1="4" x2="24" y2="24">
                <stop stop-color="#2d6a4f"/>
                <stop offset="1" stop-color="#7b68ae"/>
              </linearGradient>
            </defs>
          </svg>
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
