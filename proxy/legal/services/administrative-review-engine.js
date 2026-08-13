/**
 * VBAI Legal Pro V2 — Administrative Review Engine (7-Layer Document Review)
 * Integrates rasoatvanbanhanhchinhvn skill rules:
 * - 7-Layer Document Review (Thể thức NĐ30, Tên cơ quan/số hiệu, Logic giao việc, Báo cáo/nơi nhận, Căn cứ pháp lý, Chuỗi hồ sơ tiếp thu, Biên tập câu chữ)
 * - 4-Tier Error Classification (must_fix, verify, should_fix, editorial)
 */
const { normalizeVietnamese } = require('../domain/normalize-vietnamese');

function detectAdminReviewIntent(queryText = '') {
  if (!queryText) return false;
  const norm = normalizeVietnamese(queryText);
  return /(?:rà soát|ra soat|soát lỗi|soat loi|kiểm tra văn bản|kiem tra van ban|dự thảo|du thao|tờ trình|to trinh|trình ký|thể thức|the thuc|đối chiếu|doi chieu|sửa công văn|sua cong van)/i.test(queryText) ||
         norm.includes('ra soat') || norm.includes('soat loi') || norm.includes('kiem tra van ban') || norm.includes('trinh ky');
}

function buildAdminReviewPrompt(userQuery = '') {
  const lines = [
    `\n\n=== HỆ THỐNG KÍCH HOẠT SKILL RÀ SOÁT VĂN BẢN HÀNH CHÍNH CHUYÊN SÂU (7 LỚP RÀ SOÁT & NĐ30) ===`,
    `MỤC TIÊU: Đúng câu chữ + Đúng thể thức NĐ30 + Đúng nguồn + Đúng logic giao việc + Đúng chuỗi hồ sơ trình ký.`,
    `YÊU CẦU PHÂN LOẠI LỖI THEO 4 MỨC ĐỘ TRONG BẢNG RÀ SOÁT:`,
    `1. [MUST_FIX] - Lỗi bắt buộc phải sửa (Sai thể thức NĐ30, sai căn cứ pháp lý hết hiệu lực, sai tên cơ quan/thẩm quyền, sai thẩm quyền ký TM/KT/TL/TUQ).`,
    `2. [VERIFY] - Nghi vấn cần kiểm tra đối chiếu nguồn (Số hiệu/ngày tháng chưa thống nhất, trích dẫn văn bản chưa chắc chắn).`,
    `3. [SHOULD_FIX] - Nên sửa để đúng logic chỉ đạo (Giao việc thiếu đầu mối chủ trì, lặp ý, chuỗi báo cáo chưa rõ nguồn dữ liệu).`,
    `4. [EDITORIAL] - Biên tập câu chữ (Chính tả, dấu câu, ngắt đoạn, viết hoa thuật ngữ).`,
    `QUY TẮC BẮT BUỘC RÀ SOÁT VĂN BẢN:`,
    `- Nguồn trước, sửa sau. Không tự đổi số hiệu hay ngày tháng khi chưa đối chiếu nguồn.`,
    `- Không làm thay đổi luồng báo cáo (Ví dụ: "Báo cáo trực tiếp Bộ" khác với "Tham mưu UBND tỉnh báo cáo Bộ").`,
    `- Kiểm tra khối chữ ký: TM. (Thay mặt), KT. (Ký thay), TL. (Thừa lệnh), TUQ. (Thừa ủy quyền).`,
    `- Đảm bảo logic giao nhiệm vụ 8 yếu tố: Chủ thể -> Hành động -> Phối hợp -> Sản phẩm -> Thời hạn -> Nơi nhận -> Nguồn dữ liệu -> Trách nhiệm.`,
    `=== KẾT THÚC SKILL RÀ SOÁT VĂN BẢN ===\n`
  ];

  return lines.join('\n');
}

module.exports = {
  detectAdminReviewIntent,
  buildAdminReviewPrompt,
};
