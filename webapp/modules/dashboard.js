import { renderChatUI } from "./chat-assistant.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from '../firebase-config.js';

/**
 * Dashboard Module — Landing page with stats and module cards
 */
export async function renderDashboard(container, navigateTo) {
  container.innerHTML = `
    <div class="dashboard-hero">
      <h1 class="hero-title">Trợ Lý Soạn Văn Bản AI</h1>
      <p class="hero-sub">Soạn văn bản hành chính & văn bản Đảng chuẩn thể thức — nhanh chóng, chính xác, chuyên nghiệp</p>
    </div>

    <!-- Chat Assistant Panel (Full-width, Top) -->
    <div id="chat-assistant-container" style="margin-bottom: 32px;"></div>

    <section>
      <h2 style="font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">Chọn Công Cụ Soạn Thảo</h2>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">Bắt đầu soạn văn bản hoặc xử lý tài liệu</p>

      <div class="modules-grid" id="skills-grid">
        <div style="grid-column: 1/-1; text-align: center; padding: 20px;">
          <div class="spinner"></div>
          <p style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">Đang tải danh sách kỹ năng...</p>
        </div>
      </div>
    </section>
    
    <!-- Contact Section -->
    <section id="contact-section" style="margin-top: 48px; animation: pageIn 0.6s ease-out 0.2s both;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
        <div style="width: 32px; height: 3px; background: var(--accent); border-radius: 2px;"></div>
        <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px;">Liên Hệ Hỗ Trợ</h2>
      </div>
      
      <div class="stats-row" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        <a href="https://m.me/haichau2404" target="_blank" class="stat-card" style="text-decoration: none; display: flex; align-items: center; gap: 20px; padding: 24px; border-radius: var(--radius-xl); background: linear-gradient(135deg, rgba(0, 132, 255, 0.1), rgba(0, 132, 255, 0.05)); border: 1px solid rgba(0, 132, 255, 0.2);">
          <div style="width: 56px; height: 56px; border-radius: 16px; background: #0084ff; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 20px rgba(0, 132, 255, 0.3); flex-shrink: 0;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.453 5.502 3.734 7.254.195.15.316.386.324.64l.035 2.128c.008.497.53.818.966.576l2.368-1.314a.786.786 0 01.597-.064c.94.27 1.942.42 2.978.42 5.523 0 10-4.145 10-9.258S17.523 2 12 2zm.893 12.35l-2.585-2.756-5.044 2.756 5.544-5.885 2.585 2.756 5.044-2.756-5.544 5.885z"/></svg>
          </div>
          <div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Messenger</div>
            <div style="font-size: 0.85rem; color: #0084ff; font-weight: 600;">@haichau2404</div>
          </div>
        </a>

        <a href="https://zalo.me/0911677209" target="_blank" class="stat-card" style="text-decoration: none; display: flex; align-items: center; gap: 20px; padding: 24px; border-radius: var(--radius-xl); background: linear-gradient(135deg, rgba(0, 104, 255, 0.1), rgba(0, 104, 255, 0.05)); border: 1px solid rgba(0, 104, 255, 0.2);">
          <div style="width: 56px; height: 56px; border-radius: 16px; background: #0068ff; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 20px rgba(0, 104, 255, 0.3); flex-shrink: 0; font-weight: 900; font-size: 1.2rem; font-family: 'Inter', sans-serif;">
            Z
          </div>
          <div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Zalo</div>
            <div style="font-size: 0.85rem; color: #0068ff; font-weight: 600;">0911.677.209</div>
          </div>
        </a>
      </div>
    </section>

    <footer class="app-footer">
      <div class="footer-line">Phiên bản v1.2.6 — Văn phòng UBND tỉnh Lâm Đồng</div>
      <div class="footer-line">PHÁT TRIỂN BỞI: <a href="https://www.facebook.com/haichau2404" target="_blank" rel="noopener" class="footer-link">TRƯƠNG HẢI CHÂU</a></div>
      <div class="footer-line" style="margin-top: 8px;">
        <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(230,162,0,0.15); padding:4px 12px; border-radius:20px; border:1px solid rgba(230,162,0,0.3); font-size:0.7rem; color:var(--daquy-400)">
          👁 LƯỢT TRUY CẬP: <strong id="visit-count" style="font-size:0.8rem">...</strong>
        </span>
      </div>
    </footer>
  `;

  // === Render Skills Dynamically ===
  const skillsGrid = container.querySelector('#skills-grid');
  try {
    const response = await fetch('./skills-manifest.json');
    const skills = await response.json();
    
    // Add "Ghi Âm → Thông Báo" manually as it's a core feature, or ensure it's in manifest
    // For now, let's just render what's in the manifest
    const friendlyBadges = {
      'Skill_The_Thuc_VB_Dang_HD36': 'Nghị quyết, Chỉ thị...',
      'Skill_The_Thuc_VB_ND30': 'Quyết định, Báo cáo...',
      'Skill_PDF': 'Merge • OCR • Text',
      'Skill_DOCX': 'Chỉnh sửa • Tạo mới'
    };

    skillsGrid.innerHTML = skills.map(skill => `
      <div class="module-card" data-accent="${skill.accent}" data-page="${skill.page}" id="card-${skill.id}">
        <div class="module-icon ${skill.accent}">${skill.icon}</div>
        <div class="module-title">${skill.name}</div>
        <div class="module-desc">${skill.description.substring(0, 80)}...</div>
        <div class="module-badge">${friendlyBadges[skill.id] || 'Tiện ích'}</div>
      </div>
    `).join('') + `
      <div class="module-card" data-accent="daquy" data-page="spell-check" id="card-spell-check">
        <div class="module-icon daquy">🔍</div>
        <div class="module-title">Kiểm Tra Văn Bản</div>
        <div class="module-desc">Rà soát chính tả & thể thức</div>
        <div class="module-badge">NĐ30 • HD36 • AI</div>
      </div>
      <div class="module-card" data-accent="pine" data-page="meeting-minutes" id="card-meeting-minutes">
        <div class="module-icon pine">🎙️</div>
        <div class="module-title">Ghi Âm → Thông Báo</div>
        <div class="module-desc">Chuyển ghi âm thành thông báo</div>
        <div class="module-badge">STT • NĐ30 • HD36</div>
      </div>
    `;

    // Re-attach clicks
    skillsGrid.querySelectorAll('.module-card').forEach(card => {
      card.addEventListener('click', () => navigateTo(card.dataset.page));
    });

  } catch (error) {
    console.warn("Lỗi tải Skills manifest:", error);
    skillsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--daquy-500);">Không thể tải danh sách kỹ năng.</p>';
  }

  // === Global Visit Counter (Firebase Firestore) ===
  const visitEl = container.querySelector('#visit-count');
  const SESSION_KEY = 'vbai_session_firestore';
  const isNewSession = !sessionStorage.getItem(SESSION_KEY);

  // Initialize Firebase
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const visitDocRef = doc(db, 'stats', 'visits');

    // 1. Listen for real-time updates
    onSnapshot(visitDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.count && visitEl) {
          visitEl.textContent = data.count.toLocaleString('vi-VN');
        }
      }
    });

    // 2. Increment count if it's a new session
    if (isNewSession) {
      setDoc(visitDocRef, { count: increment(1) }, { merge: true })
        .then(() => sessionStorage.setItem(SESSION_KEY, '1'))
        .catch(err => console.warn("Firestore Error:", err));
    }
  } catch (error) {
    console.warn("Firebase Init Error:", error);
    if (visitEl) visitEl.textContent = '1,200+';
  }

  // Render Chat UI
  const chatContainer = container.querySelector('#chat-assistant-container');
  renderChatUI(chatContainer);
}

