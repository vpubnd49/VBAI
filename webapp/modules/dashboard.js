import { renderChatUI } from "./chat-assistant.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Dashboard Module — Landing page with stats and module cards
 */
export function renderDashboard(container, navigateTo) {
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

      <div class="modules-grid">
        <div class="module-card" data-accent="pine" data-page="vb-dang" id="card-vb-dang">
          <div class="module-icon pine">📜</div>
          <div class="module-title">Văn Bản Đảng (HD36)</div>
          <div class="module-desc">Chuẩn Hướng dẫn 36-HD/VPTW</div>
          <div class="module-badge">Nghị quyết, Chỉ thị...</div>
        </div>

        <div class="module-card" data-accent="mist" data-page="vb-nd30" id="card-vb-nd30">
          <div class="module-icon mist">📋</div>
          <div class="module-title">Hành Chính (NĐ30)</div>
          <div class="module-desc">Chuẩn NĐ 30/2020/NĐ-CP</div>
          <div class="module-badge">Quyết định, Báo cáo...</div>
        </div>

        <div class="module-card" data-accent="earth" data-page="pdf-tool" id="card-pdf-tool">
          <div class="module-icon earth">📄</div>
          <div class="module-title">Xử Lý PDF</div>
          <div class="module-desc">Trích xuất nội dung, OCR</div>
          <div class="module-badge">Merge • OCR • Text</div>
        </div>

        <div class="module-card" data-accent="rose" data-page="docx-tool" id="card-docx-tool">
          <div class="module-icon rose">📝</div>
          <div class="module-title">Tạo File DOCX</div>
          <div class="module-desc">Soạn thảo văn bản Word</div>
          <div class="module-badge">Chỉnh sửa • Tạo mới</div>
        </div>
      </div>
    </section>

    <footer class="app-footer">
      <div class="footer-line">Ver 1.0 - Văn phòng UBND tỉnh Lâm Đồng</div>
      <div class="footer-line">PHÁT TRIỂN BỞI: <a href="https://www.facebook.com/haichau2404" target="_blank" rel="noopener" class="footer-link">TRƯƠNG HẢI CHÂU</a></div>
      <div class="footer-line" style="margin-top: 8px;">
        <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(230,162,0,0.15); padding:4px 12px; border-radius:20px; border:1px solid rgba(230,162,0,0.3); font-size:0.7rem; color:var(--daquy-400)">
          👁 LƯỢT TRUY CẬP: <strong id="visit-count" style="font-size:0.8rem">...</strong>
        </span>
      </div>
    </footer>
  `;

  // === Global Visit Counter (Firebase Firestore) ===
  const visitEl = container.querySelector('#visit-count');
  const SESSION_KEY = 'vbai_session_firestore';
  const isNewSession = !sessionStorage.getItem(SESSION_KEY);

  // Initialize Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyAmdSiD2byxr19cZZ7xc2HUpbsAWDChZzw",
    authDomain: "vbai-a1729.firebaseapp.com",
    projectId: "vbai-a1729",
    storageBucket: "vbai-a1729.firebasestorage.app",
    messagingSenderId: "691819234622",
    appId: "1:691819234622:web:d34caa7684c1949a5c986f",
    measurementId: "G-XLHHMNXRND"
  };

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const visitDocRef = doc(db, 'stats', 'visits');

    // 1. Listen for real-time updates (everyone sees the same number instantly)
    onSnapshot(visitDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.count && visitEl) {
          visitEl.textContent = data.count.toLocaleString('vi-VN');
        }
      }
    }, (error) => {
      console.warn("Firestore Read Error:", error);
    });

    // 2. Increment count if it's a new session using Atomic Increment
    if (isNewSession) {
      setDoc(visitDocRef, { count: increment(1) }, { merge: true })
        .then(() => {
          sessionStorage.setItem(SESSION_KEY, '1');
        })
        .catch((error) => {
          console.warn("Firestore Increment Error:", error);
        });
    }
  } catch (error) {
    console.warn("Firebase Init Error:", error);
    // Ultimate Fallback
    if (visitEl && visitEl.textContent === '...') visitEl.textContent = '1,200+';
  }

  // Render Chat UI
  const chatContainer = container.querySelector('#chat-assistant-container');
  renderChatUI(chatContainer);

  // Module card clicks
  container.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.page));
  });
}

