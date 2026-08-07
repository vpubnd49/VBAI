---
name: tu-van-phap-luat
description: >
  NỀN TẢNG PHÁP LÝ AI TÍCH HỢP CHO PHÁP LUẬT VIỆT NAM — Kết hợp 4 năng lực chính:
  (A) RESEARCH: Tra cứu VBQPPL thực tế qua PDCA Cascade, xây SOT trích dẫn nguyên văn
  có tọa độ (VB–Số hiệu–Điều–Khoản–Điểm), lưu vết Immutable Ledger.
  (B) DRAFT: Soạn thảo hợp đồng từ 20 template chuẩn, hệ thống 3 tầng điều khoản
  (required/default/optional), validate ràng buộc pháp lý realtime (lint).
  (C) INTEGRATED: Research tình huống → SOT tự động nhúng vào hợp đồng soạn thảo.
  (D) NĐ30 FORMATTING: Sinh và rà soát văn bản hành chính (công văn, quyết định) đúng chuẩn
  thể thức Nghị định 30/2020/NĐ-CP với công cụ Node.js docx-js.
  Trigger (A): 'pháp luật', 'tư vấn luật', 'tranh chấp', 'bị kiện', 'khiếu nại',
  'bồi thường', 'nghị định', 'xử lý tình huống', 'luật quy định thế nào'.
  Trigger (B): 'soạn hợp đồng', 'mẫu hợp đồng', 'ký hợp đồng', 'cần hợp đồng',
  'lao động', 'thuê nhà', 'vay tiền', 'dịch vụ', 'NDA', 'ủy quyền', 'đặt cọc'.
  Trigger (C): Kết hợp cả hai — phân tích tình huống + soạn thảo văn bản cùng lúc.
  Trigger (D): 'công văn', 'quyết định', 'văn bản hành chính', 'ND30', 'tạo văn bản',
  'soạn văn bản', 'trình ký', 'gửi công văn', 'rà soát', 'kiểm tra văn bản', 'sửa văn bản'.
  KHÔNG dùng: luật nước ngoài, nghiên cứu phi pháp lý.
  DISCLAIMER: Hỗ trợ nghiên cứu và soạn thảo sơ bộ — không thay thế ý kiến
  pháp lý chính thức từ luật sư hoặc cơ quan có thẩm quyền.
---

# legalkit-vn / tu-van-phap-luat — Nền Tảng Pháp Lý AI Tích Hợp V3

> **Công thức:** Research Engine (PDCA + SOT) × Draft Engine (3-tier + Lint) × ND30 Engine = Vòng pháp lý khép kín.

---

## 0. Chọn Mode — Đọc Trước Khi Làm Gì

```
Phân tích tình huống?          → Mode A (Research)
Soạn hợp đồng cụ thể?         → Mode B (Draft)
Cả hai, hoặc không chắc?       → Mode C (Integrated) — mặc định khi tình huống có HĐ liên quan
Văn bản hành chính NĐ30?       → Mode D (ND30 Formatting)
```

| Dấu hiệu nhận biết | Mode |
|---|---|
| "bị kiện", "tranh chấp", "luật quy định thế nào", "tôi phải làm gì" | A |
| "soạn HĐ lao động", "cần mẫu thuê nhà", "ký HĐ vay tiền" | B |
| "ký HĐ lao động thử việc 2 tháng, có đúng luật không?" | C |
| "tạo công văn", "soạn quyết định", "kiểm tra thể thức ND30" | D |

---

## 1. TRIẾT LÝ CỐT LÕI (áp dụng cho tất cả Mode)

1. **SOT là nền tảng.** Mọi phân tích và tư vấn phải truy ngược về Source of Truth — tập trích dẫn NGUYÊN VĂN có tọa độ (VB – Số hiệu – Điều – Khoản – Điểm).
2. **Thời điểm quyết định tất cả.** Cùng vấn đề, khác thời điểm → khác VB áp dụng.
3. **Bắt buộc hành động + lưu vết.** Không tự suy luận quá 1 bước mà không gọi tool. Mọi phiên nghiên cứu phải ghi vết vào file phase.
4. **3-tier điều khoản.** Mọi hợp đồng phải phân biệt: bắt buộc / có mặc định của luật / tùy chọn.
5. **Disclaimer.** Hỗ trợ sơ bộ — không thay thế luật sư.

---

## MODE A — RESEARCH (Tư Vấn Đường Lối)

### A.0 — Định danh & Khởi tạo

Trước khi tra cứu, PHẢI khởi tạo không gian làm việc:

| Trục | Câu hỏi | Ví dụ |
|---|---|---|
| **ĐỐI TƯỢNG** | Ai? Cái gì? | Người lao động; Hợp đồng thuê nhà |
| **HÀNH VI** | Làm gì? (động từ pháp lý) | Sa thải; Đơn phương chấm dứt |
| **TÁC ĐỘNG** | Hệ quả? | Bồi thường; Truy cứu hình sự |
| **PHẠM VI** | Ở đâu? Loại hình? | TP.HCM; Doanh nghiệp FDI |
| **THỜI ĐIỂM** | Khi nào? ★ Quan trọng nhất | 15/07/2026 |

**Quy trình khởi tạo:**
1. Tạo thư mục `legal_research_[chủ_đề]/` + file `legal_phase_1.md`
2. Điền 5 trục. Thiếu → hỏi user.
3. Đọc `resources/domains/` module tương ứng → sinh SOT thô
4. Xác định Target (câu hỏi cốt lõi) + Exit Condition

### A.1: Động cơ PDCA Cascade (Tích hợp Án lệ)

**[P] Plan (Lập kế hoạch):** Đặt câu hỏi về SOT hiện tại:
*   Chiều xuống: "Luật này có NĐ/TT nào hướng dẫn không?"
*   Chiều ngang: "VB này đã bị sửa đổi, thay thế chưa?"
*   Chiều án lệ: "Có án lệ nào liên quan đến tình huống này không? (Tra cứu trong file resources/precedents-catalog.json)"
*   Chiều thời điểm: "Phiên bản nào hiệu lực tại mốc THỜI ĐIỂM của user?"
*   Chiều rộng: "Có vướng pháp luật chuyên ngành nào khác không?"

→ Load `resources/cross-reference-guide.md` + `resources/search-sources.md` + `resources/precedents-catalog.json`

**[D] Do (Thực hiện tra cứu):**
*   Dùng `search_web` / `read_url_content`
*   Tra cứu án lệ: Lọc các án lệ có từ khóa trùng khớp từ `resources/precedents-catalog.json`
*   BẮT BUỘC trích dẫn: Tọa độ (VB-Số hiệu-Điều-Khoản-Điểm hoặc Án lệ số [XX]/[YYYY]/AL) + Nguyên văn nội dung quy tắc pháp lý + Trạng thái hiệu lực

**[C] Check (Kiểm tra và So khớp):**
*   Bổ sung → làm giàu SOT
*   Đối chiếu án lệ: Đánh giá xem hành vi của đương sự có khớp với tình huống án lệ không.
*   Xung đột (cảnh báo): áp dụng quy tắc Lex Superior, Lex Posterior, Lex Specialis
*   Dư thừa → hướng đã cạn

**[A] Act (Lưu vết và Quyết định):** Ghi nhận vết IPO vào `legal_phase_X.md`
*   I (Input): Giả thuyết vòng này
*   P (Process): Tool và dữ liệu gốc (bao gồm án lệ áp dụng)
*   O (Output): Mâu thuẫn, quyết định cập nhật SOT
*   → Quay lại [P] hoặc dừng khi đạt Exit Condition

### A.2: Đóng gói và Xuất Report

Khi SOT đầy đủ, tổng kết vào `legal_phase_X.md`:
*   **Truth:** Phát hiện có SOT đối chứng
*   **Actionable:** Giải pháp thực tế (bao gồm cách áp dụng án lệ vào lập luận bảo vệ quyền lợi)
*   **Next Gap:** Rủi ro, điểm mờ còn lại

→ Tạo `legal_report_[chủ_đề].md` với cấu trúc 5 phần bắt buộc:
**(1) Tóm tắt tình huống và Vấn đề pháp lý**
**(2) Căn cứ pháp lý: Bảng SOT**
**(3) Phân tích phương án**
**(4) Khuyến nghị đường lối và Lộ trình**
**(5) Cảnh báo và Bước tiếp theo**

---

## MODE B — DRAFT (Soạn Thảo Hợp Đồng)

### B.0 — Nhận diện loại hợp đồng
1. Đọc `resources/domains/07-hop-dong-catalog.md`
2. Scan keyword trong yêu cầu user → xác định template file trong `templates/contracts/*.json`
3. Nếu không tìm được → thông báo và chuyển Mode A để phân tích tình huống

### B.1 — Thu thập thông tin & Validate Lint
1. Load `templates/contracts/[ten-hop-dong].json`
2. Đọc `resources/contract-schema.md` & `resources/lint-rules.md`
3. Lần lượt thu thập thông tin theo từng field (required/default/optional)
4. Validate lint constraints real-time

---

## MODE C — INTEGRATED (Tích Hợp)

Phase 1: [Mode A] Research → Chạy PDCA Cascade, xây SOT
Phase 2: [Mode B] Draft → Pre-fill template từ SOT, validate lint, nhúng SOT coordinates
Output kép: `legal_report_[chủ_đề].md` + contract `.docx` / `.json`

---

## MODE D — NĐ30 FORMATTING (Văn Bản Hành Chính)

1. Tham chiếu `resources/nd30-format-standard.md`, `references/quy_tac_the_thuc.md` và `references/phan_quyen_ky.md`
2. Tạo công văn/quyết định đúng chuẩn thể thức Nghị định 30/2020/NĐ-CP.

---

## BẢN ĐỒ RESOURCES & TEMPLATES

| File | Nội dung |
|---|---|
| `resources/legal-system.md` | Thứ bậc, hiệu lực, xung đột |
| `resources/cross-reference-guide.md` | Tra chéo 3 chiều |
| `resources/citation-format.md` | Chuẩn trích dẫn + template SOT |
| `resources/search-sources.md` | Nguồn tin cậy + cú pháp search |
| `resources/contract-schema.md` | Schema JSON chuẩn |
| `resources/lint-rules.md` | Ràng buộc pháp lý |
| `resources/monitored-laws.json` | Danh mục văn bản theo dõi hiệu lực |
| `resources/precedents-catalog.json` | Catalog án lệ áp dụng |
| `resources/nd30-format-standard.md` | Chuẩn trình bày NĐ30 |
| `references/quy_tac_the_thuc.md` | Quy tắc thể thức chi tiết |
| `references/phan_quyen_ky.md` | Ma trận quyền hạn ký |
| `templates/contracts/*.json` | 20 mẫu hợp đồng chuẩn |
