import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmdSiD2byxr19cZZ7xc2HUpbsAWDChZzw",
  authDomain: "vbai-a1729.firebaseapp.com",
  projectId: "vbai-a1729",
  storageBucket: "vbai-a1729.firebasestorage.app",
  messagingSenderId: "691819234622",
  appId: "1:691819234622:web:d34caa7684c1949a5c986f",
  measurementId: "G-XLHHMNXRND"
};

export function renderAdminPanel(container) {
  if (localStorage.getItem('vbai_admin') !== 'true') {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Truy cập bị từ chối.</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="panel-group" style="margin-bottom:20px;">
      <div class="panel-header">
        <div class="panel-header-icon">🛡️</div>
        Quản Trị Hệ Thống - Vết Tra Cứu (Mới nhất)
        <div style="flex:1"></div>
        <button id="refresh-logs-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.8rem">Làm mới</button>
      </div>
      <div class="panel-body" style="padding:0; overflow-x:auto">
        <table style="width:100%; border-collapse: collapse; font-size:0.85rem">
          <thead>
            <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border-color); text-align:left">
              <th style="padding:12px; width:140px">Thời gian</th>
              <th style="padding:12px">Câu hỏi của người dùng</th>
              <th style="padding:12px; width:200px">Model xử lý</th>
            </tr>
          </thead>
          <tbody id="logs-table-body">
            <tr><td colspan="3" style="padding:20px; text-align:center; color:var(--text-muted)">Đang tải dữ liệu...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  loadLogs(container);

  container.querySelector('#refresh-logs-btn').addEventListener('click', () => {
    loadLogs(container);
  });
}

async function loadLogs(container) {
  const tbody = container.querySelector('#logs-table-body');
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    
    // Fetch last 100 logs ordered by timestamp descending
    const q = query(collection(db, "search_logs"), orderBy("timestamp", "desc"), limit(100));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="3" style="padding:20px; text-align:center; color:var(--text-muted)">Chưa có dữ liệu tra cứu.</td></tr>';
      return;
    }

    let html = '';
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const timeStr = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN') : 'Mới đây';
      
      html += `
        <tr style="border-bottom:1px solid var(--border-color)">
          <td style="padding:12px; color:var(--text-secondary)">${timeStr}</td>
          <td style="padding:12px; font-weight:500; color:var(--text-primary)">${escapeHtml(data.query)}</td>
          <td style="padding:12px; color:var(--text-muted)"><span class="module-badge" style="display:inline-block">${escapeHtml(data.model || 'Unknown')}</span></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (error) {
    console.error("Error loading logs:", error);
    tbody.innerHTML = `<tr><td colspan="3" style="padding:20px; text-align:center; color:#ef4444">Lỗi tải dữ liệu. Cần tạo Index trong Firestore nếu chưa có.</td></tr>`;
  }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
