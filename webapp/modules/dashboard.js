import { firebaseConfig } from '../firebase-config.js';

/**
 * Dashboard Module - chat-first workspace with compact shortcuts.
 */
export function renderDashboard(container, navigateTo) {
  container.innerHTML = `
    <div class="dashboard-home">
      <section class="dashboard-chat-shell">
        <div class="dashboard-compact-hero">
          <div class="dashboard-brand-row">
            <img src="/admin-assistant-logo.svg" alt="Trợ lý hành chính" class="dashboard-main-logo">
            <div>
              <h1 class="hero-title">Trợ lý hành chính</h1>
              <p class="hero-sub">Hỗ trợ hành chính số, tra cứu quy định, soạn thảo văn bản và xử lý nghiệp vụ hằng ngày cho cơ quan, đơn vị.</p>
            </div>
          </div>
          <div class="dashboard-focus-badge">Ưu tiên tra cứu</div>
        </div>
        <div id="chat-assistant-container" class="dashboard-chat-primary">
          <div class="chat-panel-skeleton">
            <div class="chat-panel-skeleton-row"></div>
            <div class="chat-panel-skeleton-row short"></div>
            <div class="chat-panel-skeleton-box"></div>
          </div>
        </div>
      </section>

      <section class="dashboard-quick-tools">
        <div class="dashboard-section-head">
          <h2>Các chức năng</h2>
          <span>Lối tắt nghiệp vụ</span>
        </div>
        <div class="modules-grid dashboard-tools-grid" id="skills-grid">
          <div style="grid-column: 1/-1; text-align: center; padding: 12px;">
            <div class="spinner"></div>
            <p style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">Đang tải danh sách kỹ năng...</p>
          </div>
        </div>
      </section>

      <section id="contact-section" class="dashboard-support">
        <div class="dashboard-section-head">
          <h2>Liên hệ hỗ trợ</h2>
          <span>Khi cần cấu hình hoặc xử lý lỗi</span>
        </div>
        <div class="stats-row dashboard-support-grid">
          <a href="https://m.me/haichau2404" target="_blank" class="stat-card dashboard-support-card">
            <div class="dashboard-support-icon messenger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.453 5.502 3.734 7.254.195.15.316.386.324.64l.035 2.128c.008.497.53.818.966.576l2.368-1.314a.786.786 0 01.597-.064c.94.27 1.942.42 2.978.42 5.523 0 10-4.145 10-9.258S17.523 2 12 2zm.893 12.35l-2.585-2.756-5.044 2.756 5.544-5.885 2.585 2.756 5.044-2.756-5.544 5.885z"/></svg>
            </div>
            <div>
              <div class="dashboard-support-title">Messenger</div>
              <div class="dashboard-support-value">@haichau2404</div>
            </div>
          </a>

          <a href="https://zalo.me/0911677209" target="_blank" class="stat-card dashboard-support-card">
            <div class="dashboard-support-icon zalo">Z</div>
            <div>
              <div class="dashboard-support-title">Zalo</div>
              <div class="dashboard-support-value">0911.677.209</div>
            </div>
          </a>
        </div>
      </section>


      <footer class="app-footer dashboard-footer">
        <div class="footer-line">Phiên bản v1.2.6 - Văn phòng UBND tỉnh Lâm Đồng</div>
        <div class="footer-line">PHÁT TRIỂN BỞI: <a href="https://www.facebook.com/haichau2404" target="_blank" rel="noopener" class="footer-link">TRƯƠNG HẢI CHÂU</a></div>
        <div class="footer-line" style="margin-top: 8px;">
          <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(230,162,0,0.15); padding:4px 12px; border-radius:20px; border:1px solid rgba(230,162,0,0.3); font-size:0.7rem; color:var(--daquy-400)">
            LƯỢT TRUY CẬP: <strong id="visit-count" style="font-size:0.8rem">...</strong>
          </span>
        </div>
      </footer>
    </div>
  `;

  const chatContainer = container.querySelector('#chat-assistant-container');
  import('./chat-assistant.js').then(({ renderChatUI }) => {
    renderChatUI(chatContainer);
  }).catch(err => {
    console.error('Lỗi tải chat-assistant:', err);
    chatContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger)">Không thể tải khung tra cứu. Vui lòng tải lại trang.</div>';
  });

  void hydrateSkills(container, navigateTo);
  void hydrateVisitCounter(container);
}

function hydrateSkills(container, navigateTo) {
  const skillsGrid = container.querySelector('#skills-grid');
  if (!skillsGrid) return;

  const skills = [
    {
      id: "Skill_The_Thuc_VB_Dang_HD36",
      name: "Soạn VB Đảng (HD36)",
      description: "Tạo văn bản Đảng (.docx) dùng thể thức theo Hướng dẫn 36-HD/VPTW. Hỗ trợ TẤT CẢ loại VB Đảng: Nghị quyết, Chỉ thị, Kết luận, Quyết định...",
      icon: "✍️",
      accent: "daquy",
      page: "vb-dang"
    },
    {
      id: "Skill_The_Thuc_VB_ND30",
      name: "Soạn VB Hành chính (NĐ30)",
      description: "Tạo văn bản hành chính chuẩn Nghị định số 30/2020/NĐ-CP. Hỗ trợ tất cả loại VBHC: công văn, quyết định, thông báo, báo cáo...",
      icon: "📄",
      accent: "ocean",
      page: "vb-nd30"
    },
    {
      id: "Skill_PDF",
      name: "Xử lý PDF / OCR",
      description: "Trích xuất nội dung từ file PDF. Hỗ trợ đọc, trích xuất văn bản/bảng biểu, gộp, tách, xoay trang, thêm hình mờ...",
      icon: "⚙️",
      accent: "sunset",
      page: "pdf-tool"
    },
    {
      id: "Skill_DOCX",
      name: "Tạo & Xuất DOCX",
      description: "Soạn thảo văn bản Word. Hỗ trợ tạo, đọc, chỉnh sửa tài liệu Word (.docx). Định dạng chuyên nghiệp, chèn bảng biểu...",
      icon: "📝",
      accent: "pine",
      page: "docx-tool"
    }
  ];

  const friendlyBadges = {
    Skill_The_Thuc_VB_Dang_HD36: 'Nghị quyết, Chỉ thị...',
    Skill_The_Thuc_VB_ND30: 'Quyết định, Báo cáo...',
    Skill_PDF: 'Merge - OCR - Text',
    Skill_DOCX: 'Chỉnh sửa - Tạo mới',
  };

  skillsGrid.innerHTML = skills.map((skill) => `
    <div class="module-card" data-accent="${skill.accent}" data-page="${skill.page}" id="card-${skill.id}">
      <div class="module-icon ${skill.accent}">${skill.icon}</div>
      <div class="module-title">${skill.name}</div>
      <div class="module-desc">${skill.description.substring(0, 54)}...</div>
      <div class="module-badge">${friendlyBadges[skill.id] || 'Tiện ích'}</div>
    </div>
  `).join('') + `
    <div class="module-card" data-accent="daquy" data-page="spell-check" id="card-spell-check">
      <div class="module-icon daquy">🔍</div>
      <div class="module-title">Kiểm tra chính tả và thể thức</div>
      <div class="module-desc">Rà soát chính tả và thể thức văn bản...</div>
      <div class="module-badge">NĐ30 - HD36 - AI</div>
    </div>
    <div class="module-card" data-accent="pine" data-page="meeting-minutes" id="card-meeting-minutes">
      <div class="module-icon pine">🎙️</div>
      <div class="module-title">Xử lý ghi âm cuộc họp</div>
      <div class="module-desc">Chuyển ghi âm thành thông báo...</div>
      <div class="module-badge">STT - NĐ30 - HD36</div>
    </div>
  `;

  skillsGrid.querySelectorAll('.module-card').forEach((card) => {
    card.addEventListener('click', () => navigateTo(card.dataset.page));
  });
}

async function hydrateVisitCounter(container) {
  const visitEl = container.querySelector('#visit-count');
  const SESSION_KEY = 'vbai_session_firestore';
  const isNewSession = !sessionStorage.getItem(SESSION_KEY);

  try {
    const [firebaseApp, firebaseFirestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js')
    ]);

    const { initializeApp, getApps, getApp } = firebaseApp;
    const { getFirestore, doc, onSnapshot, setDoc, increment } = firebaseFirestore;

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const visitDocRef = doc(db, 'stats', 'visits');

    onSnapshot(visitDocRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      if (data.count && visitEl) {
        visitEl.textContent = data.count.toLocaleString('vi-VN');
      }
    });

    if (isNewSession) {
      setDoc(visitDocRef, { count: increment(1) }, { merge: true })
        .then(() => sessionStorage.setItem(SESSION_KEY, '1'))
        .catch((err) => console.warn('Firestore Error:', err));
    }
  } catch (error) {
    console.warn('Firebase Init Error:', error);
    if (visitEl) visitEl.textContent = '1,200+';
  }
}
