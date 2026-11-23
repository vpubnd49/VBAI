/**
 * Digital Learning Hub — Góc "Học tập số" & Cẩm nang AI Công vụ
 * Hưởng ứng phong trào "Học tập số" toàn dân theo Nghị quyết 11/NQ-CP ngày 14/01/2026
 */

const PROMPT_TEMPLATES = [
  {
    category: 'Nghị quyết 57 & Chuyển đổi số',
    title: 'Tra cứu điểm mới Nghị quyết 11/NQ-CP năm 2026',
    prompt: 'Nghị quyết số 11/NQ-CP ngày 14/01/2026 sửa đổi, bổ sung những chỉ tiêu và nhiệm vụ trọng tâm nào của Nghị quyết 71/NQ-CP thực hiện Nghị quyết 57-NQ/TW?',
  },
  {
    category: 'Khung kiến trúc quốc gia số',
    title: '4 lớp của Khung kiến trúc QĐ 1425/QĐ-TTg',
    prompt: 'Trình bày cấu trúc 4 lớp và các nguyên tắc AI First, Data-Centric, Security-by-design của Khung kiến trúc tổng thể quốc gia số theo Quyết định 1425/QĐ-TTg ngày 29/07/2026.',
  },
  {
    category: 'Chính quyền 2 cấp Lâm Đồng',
    title: 'Cơ cấu 6 Sở mới tỉnh Lâm Đồng',
    prompt: 'Liệt kê đầy đủ 6 Sở mới của tỉnh Lâm Đồng sau sắp xếp theo Nghị quyết 390-395/NQ-HĐND ngày 18/02/2025, chức năng tiếp nhận và mốc đi vào hoạt động.',
  },
  {
    category: 'Chế độ CĐS',
    title: 'Mức hỗ trợ 5 triệu/tháng cho cán bộ chuyên trách CĐS',
    prompt: 'Đối tượng, điều kiện và hồ sơ hưởng mức hỗ trợ 5.000.000 đồng/tháng theo Nghị định 179/2025/NĐ-CP ngày 01/07/2025 và Thông tư 23/2025/TT-BKHCN ngày 20/10/2025?',
  },
  {
    category: 'Soạn thảo hành chính NĐ30',
    title: 'Soạn Công văn đôn đốc báo cáo nq57.vn',
    prompt: 'Soạn dự thảo Công văn của UBND tỉnh Lâm Đồng đôn đốc các Sở, ban, ngành và UBND các xã, phường, đặc khu khẩn trương cập nhật tiến độ nhiệm vụ lên hệ thống nq57.vn trước ngày 30/11/2026.',
  },
  {
    category: 'Rà soát văn bản',
    title: 'Rà soát 7 lớp dự thảo công văn trước khi trình ký',
    prompt: 'Hướng dẫn quy trình rà soát 7 lớp dự thảo văn bản hành chính trước khi trình ký lãnh đạo UBND tỉnh (thể thức NĐ30, ngày DD/MM/YYYY, thẩm quyền ký TM/KT/TL, logic giao việc).',
  },
];

const SECURITY_RULES = [
  'TUYỆT ĐỐI KHÔNG đưa tài liệu đóng dấu MẬT, TỐI MẬT, TUYỆT MẬT hoặc có ký hiệu mật (.../UBND-M, ...-TM) lên các công cụ AI đám mây. Hệ thống VBAI sẽ tự động chặn cứng khi phát hiện.',
  'Không nhập số CCCD 12 chữ số, số tài khoản ngân hàng, số điện thoại cá nhân của công dân khi không cần thiết (VBAI tự động che ẩn PII ở tầng Proxy).',
  'Thực hiện đúng nguyên tắc "AI First có kiểm soát" (QĐ 1425/QĐ-TTg): AI hỗ trợ tổng hợp, tra cứu, dự thảo; cán bộ công chức luôn kiểm tra căn cứ pháp lý và chịu trách nhiệm cuối cùng trước khi trình ký.',
  'Thống nhất định dạng ngày văn bản theo chuẩn hệ thống: ngày DD/MM/YYYY (ví dụ: ngày 23/10/2026) trong toàn bộ báo cáo, công văn và tờ trình.',
];

export function renderDigitalLearning(container, navigateTo) {
  container.innerHTML = `
    <div class="page-wrapper" style="max-width:1200px;margin:0 auto;padding:16px 20px;">
      <div style="margin-bottom:18px;">
        <h2 style="margin:0;font-size:1.4rem;color:var(--text-main);">🎓 Góc Học tập số & Cẩm nang AI Công vụ</h2>
        <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.92rem;">Triển khai phong trào <strong>"Học tập số"</strong> theo Nghị quyết 11/NQ-CP ngày 14/01/2026 — hỗ trợ cán bộ cấp Tỉnh, Sở và Xã/Phường làm chủ Trợ lý AI an toàn, hiệu quả.</p>
      </div>

      <div class="panel-group" style="margin-bottom:18px;border-left:4px solid #dc2626;background:#fef2f2;">
        <h3 style="margin:0 0 10px;font-size:1.05rem;color:#991b1b;">🛡️ 4 Nguyên tắc An toàn thông tin khi dùng AI trong cơ quan nhà nước (Security-by-design)</h3>
        <ul style="margin:0;padding-left:20px;line-height:1.65;font-size:0.92rem;color:#7f1d1d;">
          ${SECURITY_RULES.map((r) => `<li style="margin-bottom:4px;">${r}</li>`).join('')}
        </ul>
      </div>

      <div class="panel-group" style="margin-bottom:18px;">
        <h3 style="margin:0 0 12px;font-size:1.05rem;">⚡ Bộ Câu lệnh Mẫu thực hành ngay (Bấm 1 chạm để hỏi Trợ lý AI)</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;">
          ${PROMPT_TEMPLATES.map((item, idx) => `
            <div style="border:1px solid var(--border-color);border-radius:10px;padding:14px;background:var(--bg-card,#fff);display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
              <div>
                <div style="font-size:0.78rem;font-weight:700;color:#0f766e;text-transform:uppercase;margin-bottom:4px;">${item.category}</div>
                <div style="font-weight:700;font-size:0.98rem;margin-bottom:6px;">${item.title}</div>
                <div style="font-size:0.86rem;color:var(--text-muted);line-height:1.5;">"${item.prompt}"</div>
              </div>
              <button class="btn btn-sm btn-primary dl-try-prompt" data-idx="${idx}" style="align-self:flex-start;">Thử ngay với Trợ lý AI →</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="panel-group">
        <h3 style="margin:0 0 10px;font-size:1.05rem;">🗺️ Sổ tay nhanh 4 lớp Khung kiến trúc tổng thể quốc gia số (QĐ 1425/QĐ-TTg ngày 29/07/2026)</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;font-size:0.88rem;">
          <div style="padding:12px;border-radius:8px;border:1px solid var(--border-color);">
            <strong>Lớp 1: Hạ tầng & An ninh mạng</strong>
            <p style="margin:6px 0 0;color:var(--text-muted);">Hạ tầng số dùng chung, 5G, mạng TSLCD, Security-by-design, bảo vệ bí mật nhà nước.</p>
          </div>
          <div style="padding:12px;border-radius:8px;border:1px solid var(--border-color);">
            <strong>Lớp 2: Dữ liệu & Nền tảng lõi</strong>
            <p style="margin:6px 0 0;color:var(--text-muted);">Dữ liệu "Đúng–Đủ–Sạch–Sống–Thống nhất–Dùng chung", kết nối 79 nền tảng số quốc gia & Đề án 06.</p>
          </div>
          <div style="padding:12px;border-radius:8px;border:1px solid var(--border-color);">
            <strong>Lớp 3: Ứng dụng & Nghiệp vụ</strong>
            <p style="margin:6px 0 0;color:var(--text-muted);">AI First có kiểm soát: Tự động hóa soạn thảo NĐ30, đôn đốc NQ 57, tổng hợp báo cáo Sở/Xã.</p>
          </div>
          <div style="padding:12px;border-radius:8px;border:1px solid var(--border-color);">
            <strong>Lớp 4: Tương tác & Đo lường</strong>
            <p style="margin:6px 0 0;color:var(--text-muted);">Cổng DVCQG, VNeID, nq57.vn, pakn.nq57.vn, đo lường hài lòng qua Bộ chỉ số 766 & DTI.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.dl-try-prompt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = PROMPT_TEMPLATES[Number(btn.dataset.idx)];
      if (item && typeof navigateTo === 'function') {
        navigateTo('chat-assistant', item.prompt);
      }
    });
  });
}
