/**
 * VBAI Zalo Bot Integration Module
 * 
 * Chat with VBAI Bot on Zalo — legal AI assistant
 */

// ============ RENDER ============
export function renderZaloBot(container) {
  container.innerHTML = `
    <div class="zalobot-page">
      <!-- Hero Section -->
      <div class="zalobot-hero">
        <div class="zalobot-hero-bg"></div>
        <div class="zalobot-hero-content">
          <div class="zalobot-hero-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Zalo Bot
          </div>
          <h1 class="zalobot-hero-title">Trợ lý Pháp luật AI<br/>ngay trên <span class="zalobot-hero-highlight">Zalo</span></h1>
          <p class="zalobot-hero-desc">Tra cứu văn bản, soạn thảo, phân tích tình huống pháp lý — tất cả chỉ bằng một tin nhắn Zalo</p>
        </div>
      </div>

      <!-- Main Content: QR + Steps side by side -->
      <div class="zalobot-main">
        <div class="zalobot-qr-card">
          <div class="zalobot-qr-card-inner">
            <div class="zalobot-qr-frame" id="vbai-qr-display">
              <img src="/zalo-qr-vbai.png" alt="QR Code VBAI Bot" class="zalobot-qr-image" 
                   onerror="this.parentElement.innerHTML='<div class=\\'zalobot-qr-fallback\\'><p>Mở app Zalo<br/>quét mã QR để bắt đầu</p></div>'" />
            </div>
            <div class="zalobot-qr-label">
              <div class="zalobot-qr-name">Bot VBAI</div>
              <div class="zalobot-qr-phone">Trợ lý Pháp luật AI</div>
            </div>
          </div>
          <div class="zalobot-cta-group">
            <a href="https://zalo.me/0984310011" target="_blank" rel="noopener noreferrer" class="zalobot-btn-primary" id="btn-zalo-chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Nhắn tin trên Zalo
            </a>
            <button class="zalobot-btn-secondary" id="btn-copy-zalo-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Sao chép link
            </button>
          </div>
        </div>

        <div class="zalobot-steps-card">
          <h3 class="zalobot-steps-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Bắt đầu trong 30 giây
          </h3>
          <div class="zalobot-steps-list">
            <div class="zalobot-step-item">
              <div class="zalobot-step-num">1</div>
              <div class="zalobot-step-content">
                <strong>Quét mã QR hoặc nhấn "Nhắn tin"</strong>
                <p>Mở app Zalo → Quét mã QR bên trái hoặc nhấn nút nhắn tin</p>
              </div>
            </div>
            <div class="zalobot-step-connector"></div>
            <div class="zalobot-step-item">
              <div class="zalobot-step-num">2</div>
              <div class="zalobot-step-content">
                <strong>Gửi câu hỏi pháp luật</strong>
                <p>Ví dụ: <em>"Luật Đất đai 2024 quy định gì về thu hồi đất?"</em></p>
              </div>
            </div>
            <div class="zalobot-step-connector"></div>
            <div class="zalobot-step-item">
              <div class="zalobot-step-num">3</div>
              <div class="zalobot-step-content">
                <strong>Nhận câu trả lời AI</strong>
                <p>Bot tự tra cứu, phân tích và trả lời có trích dẫn nguồn pháp luật</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Cards -->
      <div class="zalobot-features-section">
        <div class="zalobot-features-header">
          <h2 class="zalobot-features-heading">Bot làm được gì?</h2>
          <p class="zalobot-features-sub">Tất cả tính năng có sẵn ngay trong cuộc trò chuyện Zalo</p>
        </div>
        <div class="zalobot-features-grid">
          ${renderFeatureCard('search', 'Tra cứu pháp luật', 'Tìm và phân tích văn bản pháp luật ngay trong chat Zalo', '#0891b2')}
          ${renderFeatureCard('edit', 'Soạn văn bản', 'Tạo file DOCX/XLSX và gửi trực tiếp trong cuộc trò chuyện', '#0284c7')}
          ${renderFeatureCard('image', 'Đọc & Vẽ ảnh', 'Nhận dạng ảnh, đọc văn bản, vẽ ảnh AI theo yêu cầu', '#7c3aed')}
          ${renderFeatureCard('globe', 'Tìm kiếm web', 'Tra cứu thông tin từ nhiều nguồn: Google, Wikipedia, GitHub', '#059669')}
          ${renderFeatureCard('clock', 'Lịch hẹn', 'Đặt lịch nhắc nhở tự động: một lần, lặp lại, hoặc cron', '#d97706')}
          ${renderFeatureCard('brain', 'Trí nhớ bền', 'Ghi nhớ thông tin cá nhân, sống qua nhiều phiên chat', '#dc2626')}
        </div>
      </div>
    </div>
  `;

  // Copy link button
  const btnCopy = container.querySelector('#btn-copy-zalo-link');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText('https://zalo.me/0984310011').then(() => {
        btnCopy.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Đã sao chép!
        `;
        btnCopy.classList.add('zalobot-btn-copied');
        setTimeout(() => {
          btnCopy.classList.remove('zalobot-btn-copied');
          btnCopy.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Sao chép link
          `;
        }, 2000);
      });
    });
  }
}

function getFeatureIcon(type) {
  const icons = {
    search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    edit: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    image: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    globe: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    brain: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A5.5 5.5 0 0 0 5 5.5c0 .3 0 .6.1.9A4.5 4.5 0 0 0 2 10.5a4.5 4.5 0 0 0 3.1 4.3 5.5 5.5 0 0 0 4.4 7.2 5.5 5.5 0 0 0 5-3.2 4.5 4.5 0 0 0 4.5-4.5c0-1.7-1-3.2-2.4-4A5.5 5.5 0 0 0 14.5 2a5.5 5.5 0 0 0-5 3.2"/><path d="M12 2v20"/></svg>'
  };
  return icons[type] || icons.search;
}

function renderFeatureCard(iconType, title, desc, accentColor) {
  return `
    <div class="zalobot-feature-card" style="--feature-accent: ${accentColor}">
      <div class="zalobot-feature-icon-wrap">
        ${getFeatureIcon(iconType)}
      </div>
      <div class="zalobot-feature-title">${title}</div>
      <div class="zalobot-feature-desc">${desc}</div>
    </div>
  `;
}

