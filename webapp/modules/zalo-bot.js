/**
 * VBAI Zalo Bot Integration Module
 * 
 * Provides two features:
 * 1. QR code to activate personal Zalo bot (via zalo-agent)
 * 2. QR code to chat with VBAI bot directly
 */

const ZALOBOT_API_BASE = '/api/zalobot';

// ============ STATE ============
let _eventSource = null;
let _currentAccountId = null;
let _loginState = 'idle'; // idle | waiting_qr | scanned | success | error

// ============ RENDER ============
export function renderZaloBot(container) {
  container.innerHTML = `
    <div class="zalobot-page">
      <div class="zalobot-header">
        <div class="zalobot-header-icon">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#zalo-grad)"/>
            <defs><linearGradient id="zalo-grad" x1="0" y1="0" x2="48" y2="48"><stop stop-color="#0068FF"/><stop offset="1" stop-color="#00C2FF"/></linearGradient></defs>
            <path d="M14 16h20v2H14zm0 6h16v2H14zm0 6h12v2H14z" fill="white" opacity="0.9"/>
            <circle cx="36" cy="34" r="6" fill="white" opacity="0.9"/>
            <path d="M34.5 34l1.5 1.5 3-3" stroke="#0068FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 class="zalobot-title">Bot Zalo VBAI</h1>
          <p class="zalobot-subtitle">Trợ lý pháp luật AI ngay trên Zalo — tra cứu, soạn văn bản, phân tích tình huống</p>
        </div>
      </div>

      <div class="zalobot-tabs">
        <button class="zalobot-tab active" data-tab="personal" id="tab-personal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Bot cá nhân
        </button>
        <button class="zalobot-tab" data-tab="vbaibot" id="tab-vbaibot">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Chat với VBAI Bot
        </button>
      </div>

      <div id="zalobot-content" class="zalobot-content">
        <!-- Dynamic content -->
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('.zalobot-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.zalobot-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      if (tabName === 'personal') renderPersonalTab(container.querySelector('#zalobot-content'));
      else renderVbaibotTab(container.querySelector('#zalobot-content'));
    });
  });

  // Initial tab
  renderPersonalTab(container.querySelector('#zalobot-content'));
}

// ============ TAB 1: BOT CÁ NHÂN ============
function renderPersonalTab(contentEl) {
  // Cleanup previous SSE
  cleanupSSE();

  contentEl.innerHTML = `
    <div class="zalobot-section">
      <div class="zalobot-card zalobot-card-highlight">
        <div class="zalobot-card-header">
          <div class="zalobot-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M7 7h.01M17 7h.01M7 17h10"/></svg>
          </div>
          <div>
            <h3>Kích hoạt Bot Zalo cá nhân</h3>
            <p class="zalobot-card-desc">Quét mã QR để bot AI chạy trên nick Zalo của bạn. Mỗi người có bot riêng, trí nhớ riêng.</p>
          </div>
        </div>

        <div class="zalobot-steps">
          <div class="zalobot-step">
            <span class="zalobot-step-num">1</span>
            <span>Nhấn <strong>"Tạo mã QR"</strong> bên dưới</span>
          </div>
          <div class="zalobot-step">
            <span class="zalobot-step-num">2</span>
            <span>Mở app <strong>Zalo</strong> → Quét mã QR hiển thị</span>
          </div>
          <div class="zalobot-step">
            <span class="zalobot-step-num">3</span>
            <span>Xác nhận đăng nhập → Bot hoạt động ngay!</span>
          </div>
        </div>

        <div class="zalobot-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Nên dùng <strong>nick Zalo phụ</strong>. Bot sử dụng API không chính thức, Zalo có thể hạn chế tài khoản.</span>
        </div>

        <div class="zalobot-qr-area" id="qr-login-area">
          <div class="zalobot-qr-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1" opacity="0.4">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
            </svg>
            <p>Nhấn nút bên dưới để tạo mã QR đăng nhập</p>
          </div>
        </div>

        <div class="zalobot-actions">
          <button class="btn btn-primary zalobot-btn-qr" id="btn-create-qr">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zm4 0h3v3h-3zm-4 4h3v3h-3zm4 0h3v3h-3z"/></svg>
            Tạo mã QR đăng nhập
          </button>
        </div>
      </div>

      <div class="zalobot-features">
        <h3 class="zalobot-features-title">Bot làm được gì?</h3>
        <div class="zalobot-features-grid">
          ${renderFeatureCard('🔍', 'Tra cứu pháp luật', 'Tìm và phân tích văn bản pháp luật ngay trong chat Zalo')}
          ${renderFeatureCard('📝', 'Soạn văn bản', 'Tạo file DOCX/XLSX và gửi trực tiếp trong cuộc trò chuyện')}
          ${renderFeatureCard('🖼️', 'Đọc & Vẽ ảnh', 'Nhận dạng ảnh, đọc văn bản, vẽ ảnh AI theo yêu cầu')}
          ${renderFeatureCard('🌐', 'Tìm kiếm web', 'Tra cứu thông tin từ nhiều nguồn: Google, Wikipedia, GitHub')}
          ${renderFeatureCard('⏰', 'Lịch hẹn', 'Đặt lịch nhắc nhở tự động: một lần, lặp lại, hoặc cron')}
          ${renderFeatureCard('🧠', 'Trí nhớ bền', 'Ghi nhớ thông tin cá nhân, sống qua nhiều phiên chat')}
        </div>
      </div>
    </div>
  `;

  // Bind QR button
  const btnQR = contentEl.querySelector('#btn-create-qr');
  btnQR.addEventListener('click', () => startQRLogin(contentEl));
}

function renderFeatureCard(icon, title, desc) {
  return `
    <div class="zalobot-feature-card">
      <div class="zalobot-feature-icon">${icon}</div>
      <div class="zalobot-feature-title">${title}</div>
      <div class="zalobot-feature-desc">${desc}</div>
    </div>
  `;
}

// ============ TAB 2: CHAT VỚI VBAI BOT ============
function renderVbaibotTab(contentEl) {
  cleanupSSE();

  contentEl.innerHTML = `
    <div class="zalobot-section">
      <div class="zalobot-card zalobot-card-chat">
        <div class="zalobot-card-header">
          <div class="zalobot-card-icon zalobot-card-icon-chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <h3>Nhắn tin cho Bot VBAI</h3>
            <p class="zalobot-card-desc">Quét mã QR hoặc nhấn nút bên dưới để nhắn tin trực tiếp cho bot VBAI trên Zalo</p>
          </div>
        </div>

        <div class="zalobot-qr-area zalobot-qr-static">
          <div class="zalobot-qr-frame" id="vbai-qr-display">
            <img src="/zalo-qr-vbai.png" alt="QR Code VBAI Bot" class="zalobot-qr-image" 
                 onerror="this.parentElement.innerHTML='<div class=\\'zalobot-qr-fallback\\'><p>Quét mã QR trong ảnh được cung cấp<br/>hoặc nhấn nút bên dưới</p></div>'" />
          </div>
          <div class="zalobot-qr-info">
            <div class="zalobot-qr-name">Bot VBAI - Trợ lý Pháp luật</div>
            <div class="zalobot-qr-desc">Trợ lý AI tra cứu pháp luật, soạn văn bản, phân tích tình huống</div>
          </div>
        </div>

        <div class="zalobot-actions">
          <a href="https://zalo.me/0984310011" target="_blank" rel="noopener noreferrer" class="btn btn-primary zalobot-btn-chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Nhắn tin trên Zalo
          </a>
          <button class="btn btn-outline zalobot-btn-copy" id="btn-copy-zalo-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Sao chép link
          </button>
        </div>
      </div>

      <div class="zalobot-how-to">
        <h3>Cách sử dụng</h3>
        <div class="zalobot-how-grid">
          <div class="zalobot-how-item">
            <div class="zalobot-how-num">1</div>
            <div>
              <strong>Quét mã QR hoặc nhấn "Nhắn tin"</strong>
              <p>Mở Zalo → Quét mã QR bên trên, hoặc nhấn nút "Nhắn tin trên Zalo"</p>
            </div>
          </div>
          <div class="zalobot-how-item">
            <div class="zalobot-how-num">2</div>
            <div>
              <strong>Gửi câu hỏi pháp luật</strong>
              <p>Ví dụ: "Luật Đất đai 2024 quy định gì về thu hồi đất?"</p>
            </div>
          </div>
          <div class="zalobot-how-item">
            <div class="zalobot-how-num">3</div>
            <div>
              <strong>Nhận câu trả lời AI</strong>
              <p>Bot tự tra cứu, phân tích và trả lời có trích dẫn nguồn</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Copy link button
  const btnCopy = contentEl.querySelector('#btn-copy-zalo-link');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText('https://zalo.me/0984310011').then(() => {
        btnCopy.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Đã sao chép!
        `;
        setTimeout(() => {
          btnCopy.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Sao chép link
          `;
        }, 2000);
      });
    });
  }
}

// ============ QR LOGIN LOGIC ============
async function startQRLogin(contentEl) {
  const qrArea = contentEl.querySelector('#qr-login-area');
  const btn = contentEl.querySelector('#btn-create-qr');
  if (!qrArea || !btn) return;

  // Disable button
  btn.disabled = true;
  btn.innerHTML = `
    <div class="zalobot-spinner"></div>
    Đang tạo mã QR...
  `;

  try {
    // One-click: create account + enable + start QR login
    const res = await fetch(`${ZALOBOT_API_BASE}/quick-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'VBAI Web User' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Lỗi khởi tạo: ${res.status}`);
    }

    const data = await res.json();
    _currentAccountId = data.accountId;
    _loginState = 'waiting_qr';

    // Start polling immediately
    pollQRStatus(contentEl, data.accountId);

  } catch (err) {
    console.error('QR login error:', err);
    _loginState = 'error';
    qrArea.innerHTML = `
      <div class="zalobot-qr-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--rose-500)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>${err.message || 'Không thể kết nối đến bot server'}</p>
        <p class="zalobot-qr-error-hint">Kiểm tra kết nối đến zalo-agent</p>
      </div>
    `;
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      Thử lại
    `;
  }
}

async function pollQRStatus(contentEl, accountId) {
  const qrArea = contentEl.querySelector('#qr-login-area');
  const btn = contentEl.querySelector('#btn-create-qr');
  if (!qrArea) return;

  try {
    const res = await fetch(`${ZALOBOT_API_BASE}/accounts/${accountId}/login/status`);
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    
    const data = await res.json();
    // zalo-agent returns: { status: 'starting'|'waiting_scan'|'scanned'|'success'|'declined'|'error'|'timeout'|'idle', qrDataUri?, error? }
    const st = data.status;

    if ((st === 'waiting_scan' || st === 'starting') && data.qrDataUri) {
      _loginState = 'waiting_qr';
      qrArea.innerHTML = `
        <div class="zalobot-qr-live">
          <div class="zalobot-qr-frame zalobot-qr-frame-active">
            <img src="${data.qrDataUri}" alt="QR Code Zalo Login" class="zalobot-qr-image zalobot-qr-pulse" />
          </div>
          <div class="zalobot-qr-status">
            <div class="zalobot-status-dot zalobot-status-waiting"></div>
            <span>Đang chờ quét mã QR...</span>
          </div>
          <p class="zalobot-qr-hint">Mở app Zalo → Quét QR → Xác nhận đăng nhập</p>
        </div>
      `;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <div class="zalobot-spinner"></div>
          Đang chờ quét QR...
        `;
      }
    } else if (st === 'starting') {
      // QR chưa sẵn sàng, đang khởi tạo
      qrArea.innerHTML = `
        <div class="zalobot-qr-live">
          <div class="zalobot-qr-placeholder">
            <div class="zalobot-spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(0,119,139,0.2);border-top-color:var(--brand-primary);"></div>
            <p>Đang khởi tạo phiên đăng nhập...</p>
          </div>
        </div>
      `;
    } else if (st === 'scanned') {
      _loginState = 'scanned';
      qrArea.innerHTML = `
        <div class="zalobot-qr-live">
          <div class="zalobot-qr-success-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div class="zalobot-qr-status">
            <div class="zalobot-status-dot zalobot-status-scanned"></div>
            <span>Đã quét! Xác nhận trên điện thoại...</span>
          </div>
        </div>
      `;
    } else if (st === 'success') {
      _loginState = 'success';
      qrArea.innerHTML = `
        <div class="zalobot-qr-live">
          <div class="zalobot-qr-success-icon zalobot-success-bounce">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div class="zalobot-qr-status zalobot-status-success">
            <div class="zalobot-status-dot zalobot-status-done"></div>
            <span>🎉 Bot đã kích hoạt thành công!</span>
          </div>
          <p class="zalobot-qr-hint">Bot AI đang chạy trên Zalo của bạn. Hãy thử nhắn tin!</p>
        </div>
      `;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Đã kích hoạt ✓
        `;
        btn.classList.add('btn-success');
      }
      return; // Stop polling
    } else if (st === 'timeout') {
      qrArea.innerHTML = `
        <div class="zalobot-qr-live">
          <div class="zalobot-qr-error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--daquy-400)" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>Mã QR đã hết hạn (3 phút)</p>
          </div>
        </div>
      `;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          Tạo mã QR mới
        `;
      }
      _loginState = 'idle';
      return; // Stop polling
    } else if (st === 'declined' || st === 'error') {
      _loginState = 'error';
      qrArea.innerHTML = `
        <div class="zalobot-qr-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--rose-500)" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p>${st === 'declined' ? 'Đăng nhập bị từ chối trên điện thoại' : (data.error || 'Đăng nhập thất bại')}</p>
        </div>
      `;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          Thử lại
        `;
      }
      return; // Stop polling
    }

    // Continue polling every 1.5s
    if (_loginState !== 'success' && _loginState !== 'error') {
      setTimeout(() => pollQRStatus(contentEl, accountId), 1500);
    }

  } catch (err) {
    console.error('Poll QR status error:', err);
    // Retry after delay
    setTimeout(() => pollQRStatus(contentEl, accountId), 3000);
  }
}

function cleanupSSE() {
  if (_eventSource) {
    _eventSource.close();
    _eventSource = null;
  }
  _loginState = 'idle';
}

