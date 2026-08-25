import { showToast } from './ui-utils.js';

let isRegistering = false;

function shouldPreferRedirectLogin() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|chromium|edg|opr/.test(ua);
  const isInAppBrowser = /fbav|fban|instagram|zalo|line|webview|wv/.test(ua);
  return isMobile || isSafari || isInAppBrowser;
}

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-logo">
          <img src="/legal-pro-logo.svg" alt="Trợ lý Tra cứu Pháp luật" style="width: 80px; height: 80px; margin: 0 auto 15px auto; display: block; border-radius: 12px;">
          <h2>Đăng nhập Trợ lý Tra cứu Pháp luật</h2>
        </div>
        
        <button id="btn-google-login" class="btn-google">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18">
          Đăng nhập bằng Google
        </button>
        
        <div class="divider">
          <span>HOẶC</span>
        </div>
        
        <form id="login-form">
          <div class="form-group" id="group-name" style="display: none;">
            <label>HỌ VÀ TÊN</label>
            <input type="text" id="login-name" placeholder="Nhập họ và tên">
          </div>

          <div class="form-group">
            <label>EMAIL</label>
            <input type="email" id="login-email" placeholder="Nhập địa chỉ email" required>
          </div>
          
          <div class="form-group">
            <label>MẬT KHẨU</label>
            <input type="password" id="login-pwd" placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)" required>
          </div>
          
          <div class="forgot-pwd" id="forgot-pwd-box">
            <a href="#" id="btn-forgot-pwd">Quên mật khẩu?</a>
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
        background: linear-gradient(135deg, #F7FBFC 0%, #E7F7F9 50%, #E0F2F5 100%);
        font-family: 'Inter', sans-serif;
      }
      .login-card {
        background: #FFFFFF;
        width: 100%;
        max-width: 420px;
        padding: 36px;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08), 0 0 20px rgba(0, 140, 161, 0.08);
        text-align: center;
        border: 1px solid #CBD5E1;
      }
      .login-logo h2 {
        font-size: 1.15rem;
        color: #0F172A;
        font-weight: 700;
        margin-bottom: 20px;
        letter-spacing: 0.2px;
      }
      .btn-google {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px;
        background: #FFFFFF;
        border: 1px solid #CBD5E1;
        border-radius: 8px;
        font-size: 0.88rem;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 20px;
      }
      .btn-google img {
        margin-right: 10px;
      }
      .btn-google:hover {
        background: #F8FAFC;
        border-color: #008CA1;
        box-shadow: 0 2px 8px rgba(0, 140, 161, 0.12);
      }
      .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin-bottom: 20px;
      }
      .divider::before, .divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid #E2E8F0;
      }
      .divider span {
        padding: 0 10px;
        color: #64748B;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .form-group {
        text-align: left;
        margin-bottom: 14px;
      }
      .form-group label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: #334155;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
      }
      .form-group input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #CBD5E1;
        border-radius: 8px;
        font-size: 0.9rem;
        color: #0F172A;
        box-sizing: border-box;
      }
      .form-group input:focus {
        outline: none;
        border-color: #008CA1;
        box-shadow: 0 0 0 2px rgba(0, 140, 161, 0.15);
      }
      .forgot-pwd {
        text-align: right;
        margin-bottom: 18px;
      }
      .forgot-pwd a {
        font-size: 0.78rem;
        color: #008CA1;
        text-decoration: none;
      }
      .forgot-pwd a:hover {
        text-decoration: underline;
      }
      .btn-submit {
        width: 100%;
        padding: 12px;
        background: #008CA1;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .btn-submit:hover {
        background: #007385;
      }
      .btn-submit:disabled {
        background: #94A3B8;
        cursor: not-allowed;
      }
      .login-footer {
        margin-top: 24px;
        font-size: 0.82rem;
        color: #64748B;
      }
      .login-footer a {
        color: #008CA1;
        text-decoration: none;
        font-weight: 600;
        margin-left: 4px;
      }
      .login-footer a:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  const form = container.querySelector('#login-form');
  const btnGoogle = container.querySelector('#btn-google-login');
  const btnSubmit = container.querySelector('#btn-submit');
  const btnToggle = container.querySelector('#btn-toggle-mode');
  const toggleText = container.querySelector('#toggle-mode-text');
  const groupName = container.querySelector('#group-name');
  const forgotBox = container.querySelector('#forgot-pwd-box');

  // Check redirect result on mount
  (async () => {
    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const { getAuth, getRedirectResult } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
      const { firebaseConfig } = await import('../firebase-config.js');

      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const auth = getAuth(app);
      const redirectRes = await getRedirectResult(auth);
      if (redirectRes?.user) {
        const idToken = await redirectRes.user.getIdToken();
        const resp = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          setAuthSession(data.token, data.user);
          showToast('Đăng nhập Google thành công!');
        }
      }
    } catch (_) {}
  })();

  btnToggle.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    if (isRegistering) {
      btnSubmit.textContent = 'Đăng ký';
      toggleText.textContent = 'Đã có tài khoản?';
      btnToggle.textContent = 'Đăng nhập';
      groupName.style.display = 'block';
      forgotBox.style.display = 'none';
    } else {
      btnSubmit.textContent = 'Đăng nhập';
      toggleText.textContent = 'Chưa có tài khoản?';
      btnToggle.textContent = 'Đăng ký miễn phí';
      groupName.style.display = 'none';
      forgotBox.style.display = 'block';
    }
  });

  // Handle Google Login
  btnGoogle.addEventListener('click', async () => {
    const oldLabel = btnGoogle.innerHTML;
    btnGoogle.disabled = true;
    btnGoogle.textContent = 'Đang mở Google...';
    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
      const { firebaseConfig } = await import('../firebase-config.js');

      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      if (shouldPreferRedirectLogin()) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Send to local VPS backend
      const resp = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Xác thực Google thất bại');
      }

      setAuthSession(data.token, data.user);
      showToast('Đăng nhập Google thành công!');
    } catch (err) {
      console.error('Google Sign-in error:', err);
      showToast('Lỗi đăng nhập Google: ' + (err.message || 'Không xác định'), 'error');
    } finally {
      btnGoogle.disabled = false;
      btnGoogle.innerHTML = oldLabel;
    }
  });

  // Handle Email Login / Register
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pwd').value;
    const nameInput = document.getElementById('login-name');
    const displayName = nameInput ? nameInput.value.trim() : '';

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Đang xử lý...';

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegistering ? { email, password, displayName } : { email, password };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Đăng nhập thất bại');
      }

      setAuthSession(data.token, data.user);
      showToast(isRegistering ? 'Đăng ký thành công!' : 'Đăng nhập thành công!');
    } catch (err) {
      showToast('Lỗi: ' + (err.message || 'Không thể kết nối máy chủ'), 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = isRegistering ? 'Đăng ký' : 'Đăng nhập';
    }
  });
}

export function setAuthSession(token, user) {
  localStorage.setItem('vbai_token', token);
  localStorage.setItem('vbai_user', JSON.stringify(user));
  const isAdmin = user.role === 'admin' || user.isAdmin === true;
  localStorage.setItem('vbai_is_admin', isAdmin ? 'true' : 'false');
  window.isAdmin = isAdmin;

  window.currentUser = {
    uid: user.uid || user._id,
    user_id: user.uid || user._id,
    email: user.email,
    displayName: user.displayName || user.name || user.email?.split('@')[0],
    role: user.role || (isAdmin ? 'admin' : 'user'),
    isAdmin: isAdmin,
    getIdToken: async () => localStorage.getItem('vbai_token') || '',
    getIdTokenResult: async () => ({ claims: { admin: isAdmin } })
  };

  window.dispatchEvent(new CustomEvent('auth-changed', { detail: window.currentUser }));
}

export function clearAuthSession() {
  localStorage.removeItem('vbai_token');
  localStorage.removeItem('vbai_user');
  localStorage.removeItem('vbai_is_admin');
  window.currentUser = null;
  window.isAdmin = false;
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
}
