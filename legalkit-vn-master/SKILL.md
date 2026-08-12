---
name: legalkit-vn
description: >
  NỀN TẢNG PHÁP LÝ AI TÍCH HỢP CHO PHÁP LUẬT VIỆT NAM — Kết hợp 3 năng lực chính:
  (A) RESEARCH: Tra cứu VBQPPL thực tế qua PDCA Cascade, xây SOT trích dẫn nguyên văn
  có tọa độ (VB–Số hiệu–Điều–Khoản–Điểm), lưu vết Immutable Ledger.
  (B) DRAFT: Soạn thảo hợp đồng từ 10 template chuẩn, hệ thống 3 tầng điều khoản
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

# legalkit-vn — Nền Tảng Pháp Lý AI Tích Hợp

> **Công thức:** Research Engine (PDCA + SOT) × Draft Engine (3-tier + Lint) = Vòng pháp lý khép kín.

---

## 0. Chọn Mode — Đọc Trước Khi Làm Gì

```
Phân tích tình huống?          → Mode A (Research)
Soạn hợp đồng cụ thể?         → Mode B (Draft)
Cả hai, hoặc không chắc?       → Mode C (Integrated) — mặc định khi tình huống có HĐ liên quan
```

| Dấu hiệu nhận biết | Mode |
|---|---|
| "bị kiện", "tranh chấp", "luật quy định thế nào", "tôi phải làm gì" | A |
| "soạn HĐ lao động", "cần mẫu thuê nhà", "ký HĐ vay tiền" | B |
| "ký HĐ lao động thử việc 2 tháng, có đúng luật không?" | C |

---

## 1. TRIẾT LÝ CỐT LÕI (áp dụng cho cả 3 Mode)

1. **SOT là nền tảng.** Mọi phân tích và tư vấn phải truy ngược về Source of Truth — tập trích dẫn NGUYÊN VĂN có tọa độ (VB – Số hiệu – Điều – Khoản – Điểm).
2. **Thời điểm quyết định tất cả.** Cùng vấn đề, khác thời điểm → khác VB áp dụng.
3. **Bắt buộc hành động + lưu vết.** Không tự suy luận quá 1 bước mà không gọi tool. Mọi phiên nghiên cứu phải ghi vết vào file phase.
4. **3-tier điều khoản.** Mọi hợp đồng phải phân biệt: bắt buộc / có mặc định của luật / tùy chọn.
5. **Disclaimer.** Hỗ trợ sơ bộ — không thay thế luật sư.

---

## MODE A — RESEARCH (Tư Vấn Đường Lối)

*Kế thừa đầy đủ từ tu-van-phap-luat-v1.0. Xem chi tiết bên dưới.*

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
3. Đọc `resources/domains/` module tương ứng (Mục A.5) → sinh SOT thô
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

**(1) Tóm tắt tình huống và Vấn đề pháp lý:** 5 trục + vấn đề cốt lõi
**(2) Căn cứ pháp lý: Bảng SOT:** trích dẫn nguyên văn, thứ bậc, trạng thái, án lệ liên quan
**(3) Phân tích phương án:** ≥2 phương án, đánh giá Pháp lý/Rủi ro/Khả thi (1 đến 5)
**(4) Khuyến nghị đường lối và Lộ trình:** hồ sơ cần chuẩn bị, cơ quan thụ lý, thời hạn
**(5) Cảnh báo và Bước tiếp theo:** rủi ro, khi nào cần luật sư, Disclaimer

> Khung chat chỉ chứa tóm tắt 1 đoạn + link trỏ đến file Report. KHÔNG dump nội dung dài lên chat.

### A.5 — Danh mục Domain Module

| Nhóm | File | Keyword |
|---|---|---|
| Dân sự & Gia đình | `resources/domains/01-dan-su.md` | hợp đồng, vay mượn, bồi thường, thừa kế, ly hôn, tài sản chung |
| Hình sự & Hành chính | `resources/domains/02-hinh-su-hanh-chinh.md` | tội phạm, khởi tố, án treo, khiếu nại, tố cáo, phạt vi phạm |
| Doanh nghiệp & Lao động | `resources/domains/03-doanh-nghiep-lao-dong.md` | thành lập công ty, sa thải, lương, BHXH, hợp đồng lao động |
| Đất đai & Xây dựng | `resources/domains/04-dat-dai-xay-dung.md` | sổ đỏ, đền bù, chuyển nhượng, giấy phép xây dựng, BĐS |
| Thuế & Tài chính | `resources/domains/05-thue-tai-chinh.md` | khai thuế, hoàn thuế, TNCN, TNDN, VAT, hóa đơn |
| Chuyên ngành Khác | `resources/domains/06-chuyen-nganh-khac.md` | an ninh mạng, AI, nhãn hiệu, bản quyền, GPLX |
| Hợp đồng Templates | `resources/domains/07-hop-dong-catalog.md` | keyword nhận diện loại HĐ cần soạn thảo |

---

## MODE B — DRAFT (Soạn Thảo Hợp Đồng)

### B.0 — Nhận diện loại hợp đồng

1. Đọc `resources/domains/07-hop-dong-catalog.md`
2. Scan keyword trong yêu cầu user → xác định template file
3. Nếu không tìm được → thông báo và chuyển Mode A để phân tích tình huống

### B.1 — Thu thập thông tin

1. Load `templates/contracts/[ten-hop-dong].json`
2. Đọc `resources/contract-schema.md` để hiểu cấu trúc
3. Lần lượt thu thập thông tin theo từng `field` trong JSON:
   - `required`: bắt buộc hỏi, block nếu thiếu
   - `default`: giải thích mặc định của luật, hỏi user có muốn ghi đè không
   - `optional`: hỏi user có cần không

### B.2 — Validate ràng buộc pháp lý

1. Load `resources/lint-rules.md` cho domain tương ứng
2. So sánh dữ liệu user nhập với lint rules:
   - `error`: cảnh báo đỏ, yêu cầu sửa trước khi xuất
   - `warning`: cảnh báo vàng, vẫn cho xuất
   - `note`: hiển thị thông tin trong phần Lưu ý

### B.3 — Render & Xuất hợp đồng

1. Thay thế `{{key}}` bằng giá trị đã thu thập
2. Bỏ qua các điều khoản `optional` không được điền
3. Điền `defaultText` cho các field `default` không được ghi đè (kèm điều luật)
4. Chạy `scripts/contract_builder.py` để xuất file `.docx`
5. Thông báo kết quả + path file đầu ra

### B.4 — Verify notes

Sau khi render, ghi vào `verifyNotes` của JSON:
- Ngày tạo, người tạo, giá trị đã điền
- Lint warnings (nếu có)
- Lưu ý kiểm định thêm nếu cần

---

## MODE C — INTEGRATED (Tích Hợp)

*Dùng khi tình huống vừa cần phân tích vừa cần soạn thảo.*

### Quy trình

```
Phase 1: [Mode A] Research
  → Chạy đầy đủ PDCA Cascade
  → Xây SOT với tọa độ pháp lý
  → Xác định loại HĐ phù hợp tình huống

Phase 2: [Mode B] Draft
  → Load template từ Phase 1
  → Pre-fill một số field từ kết quả SOT (thời điểm, các bên, điều khoản đặc thù)
  → Validate lint với context cụ thể của tình huống
  → Nhúng tọa độ SOT vào điều khoản liên quan trong HĐ (format: [VB, Điều X, Khoản Y])

Output kép:
  → legal_report_[chủ_đề].md (analysis)
  → [ten-hop-dong]-[ngay].docx (draft contract với SOT embedded)
```

### Ví dụ Mode C

> User: "Tôi muốn ký hợp đồng lao động với nhân viên kỹ thuật, thử việc 2 tháng, lương thử việc 8 triệu, lương chính thức 10 triệu."

```
Phase 1: Research
  ĐỐI TƯỢNG: NSDLĐ + NLĐ kỹ thuật
  HÀNH VI: Ký HĐLĐ + thử việc
  THỜI ĐIỂM: 07/2026

  SOT: BLLĐ 2019, Điều 25 (thử việc ≤60 ngày cho kỹ thuật ✅)
       BLLĐ 2019, Điều 26, Khoản 3 (lương TT ≥ 85% lương CT)

  Kiểm tra: 8tr/10tr = 80% < 85% → LINT ERROR ⚠️

Phase 2: Draft
  Template: hop-dong-lao-dong.json
  Pre-fill: thoi_gian_thu_viec=60, vi_tri=kỹ thuật
  Lint alert: "Lương thử việc 8tr < 8.5tr (85% của 10tr) — vi phạm Điều 26 BLLĐ"
  → Yêu cầu user điều chỉnh trước khi xuất HĐ
```

---

## QUALITY GATE — 15 điểm

Kiểm tra trước khi xuất bất kỳ output nào:

**Mode A (12 điểm):**
1. ✅ Đã tạo `legal_research_*/legal_phase_X.md`?
2. ✅ 5 trục đã xác định đầy đủ (đặc biệt THỜI ĐIỂM)?
3. ✅ File phase có Baseline, Target, Exit Condition?
4. ✅ SOT có ≥3 trích dẫn nguyên văn?
5. ✅ Mỗi trích dẫn có tọa độ đầy đủ (VB–Số hiệu–Điều–Khoản–Điểm)?
6. ✅ Trạng thái hiệu lực đúng mốc thời điểm user?
7. ✅ VB sửa đổi đã cross-reference đủ 3 chiều?
8. ✅ File phase đã lưu vết IPO mỗi vòng PDCA?
9. ✅ Đã tổng kết Truth/Actionable/Gap?
10. ✅ Đã tạo `legal_report_*.md` với cấu trúc 5 phần?
11. ✅ Phương án xử lý đã đánh giá so sánh?
12. ✅ Khung chat chỉ chứa tóm tắt + link file?

**Mode B (3 điểm bổ sung):**
13. ✅ Tất cả field `required` đã được điền?
14. ✅ Lint rules đã chạy, không còn `error` chưa giải quyết?
15. ✅ `verifyNotes` đã ghi nhận session hiện tại?

---

## NGUYÊN TẮC VẬN HÀNH

- Mọi kết luận kèm **tọa độ pháp lý** trỏ về SOT
- Thiếu dữ kiện → `[Giả định]` kèm tác động, hoặc hỏi user
- Nguồn tra web → `[Web]` kèm URL
- Ngày tháng: DD/MM/YYYY
- Không tự bịa nội dung VB — phải copy nguyên văn từ nguồn
- **Skill hỗ trợ nghiên cứu và soạn thảo sơ bộ; không thay thế ý kiến pháp lý chính thức**

---

## THỨ BẬC VBQPPL VN (Tham chiếu nhanh)

```
① Hiến pháp
② Bộ luật / Luật / Nghị quyết (Quốc hội)
③ Pháp lệnh / Nghị quyết (UBTVQH)
④ Lệnh / Quyết định (Chủ tịch nước)
⑤ Nghị định / Nghị quyết (Chính phủ)
⑥ Quyết định (Thủ tướng)
⑦ Nghị quyết (Hội đồng Thẩm phán TANDTC)
⑧ Thông tư (Bộ trưởng, Chánh án TANDTC...)
⑨ Thông tư liên tịch
⑩–⑮ Văn bản địa phương (HĐND/UBND tỉnh → xã)
```

**Xung đột:** Lex Superior > Lex Posterior > Lex Specialis
Load `resources/legal-system.md` để tra cứu chi tiết.

---

## BẢN ĐỒ RESOURCES

| File | Nội dung | Load khi nào |
|---|---|---|
| `resources/legal-system.md` | Thứ bậc, hiệu lực, xung đột | Mode A: phân loại + giải xung đột |
| `resources/cross-reference-guide.md` | Tra chéo 3 chiều | Mode A: search & cross-ref |
| `resources/citation-format.md` | Chuẩn trích dẫn + template SOT | Mode A: trích dẫn |
| `resources/search-sources.md` | Nguồn tin cậy + cú pháp search | Mode A: search |
| `resources/contract-schema.md` | Schema JSON chuẩn | Mode B/C: đọc/tạo template |
| `resources/lint-rules.md` | Ràng buộc pháp lý | Mode B/C: validate |
| `resources/nd30-format-standard.md` | Tài liệu tiêu chuẩn trình bày NĐ 30 | Mode B/C/D: đối chiếu trình bày |
| `references/quy_tac_the_thuc.md` | Thông số kỹ thuật chi tiết NĐ 30 | Mode D: pixel-perfect formatting |
| `references/phan_quyen_ky.md` | Ma trận quyền hạn ký văn bản | Mode D: thẩm quyền ký |
| `resources/domains/01–06` | Khung xương sống NĐ/TT theo lĩnh vực | Mode A: sinh SOT thô |
| `resources/domains/07-hop-dong-catalog.md` | Keyword nhận diện loại HĐ | Mode B/C: chọn template |
| `templates/contracts/*.json` | 10 template hợp đồng | Mode B/C: render HĐ |
| `scripts/contract_builder.py` | Render .docx HĐ chuẩn NĐ 30 (Python) | Mode B/C: xuất HĐ |
| `scripts/sot_validator.py` | Validate SOT format | Mode A: QA trích dẫn |
| `scripts/law_updater.py` | Kiểm tra VB cập nhật | Định kỳ hoặc khi lint rules cần review |
| `scripts/generate_cong_van.js` | Sinh công văn chuẩn NĐ 30 (Node.js) | Mode D: xuất công văn |
| `scripts/generate_quyet_dinh.js` | Sinh quyết định chuẩn NĐ 30 (Node.js) | Mode D: xuất quyết định |

---

## MODE D — NĐ30 FORMATTING (Văn Bản Hành Chính)

*Kế thừa đầy đủ từ Skill_The_Thuc_VB_ND30. Sử dụng khi người dùng yêu cầu tạo, kiểm tra, hoặc sửa công văn, quyết định hành chính.*

### D.1 — Tạo mới văn bản (Node.js)

1. Thu thập thông tin đầu vào:
   - **Loại văn bản**: Công văn hay Quyết định?
   - **Cơ quan ban hành**: Cơ quan cấp trên và cơ quan ban hành.
   - **Kính gửi** (đối với công văn).
   - **Nội dung chính**.
   - **Người ký & Cấp ký**: Đối chiếu quyền hạn ký TM/KT/TL trong `references/phan_quyen_ky.md`.
2. Tạo file JSON đầu vào dạng:
   ```json
   {
     "co_quan_chu_quan": "TÊN CƠ QUAN CẤP TRÊN",
     "co_quan_ban_hanh": "TÊN CƠ QUAN BAN HÀNH",
     "don_vi_soan_thao": "Tên viết tắt đơn vị",
     "trich_yeu": "V/v ...",
     "kinh_gui": ["Nơi nhận chính"],
     "noi_dung": "Nội dung...",
     "cap_ky": "TM | KT | TL | TUQ",
     "chuc_vu_ky": "Chức vụ người ký",
     "nguoi_ky": "Tên người ký",
     "noi_nhan": ["Nơi nhận 1", "Lưu: VT..."]
   }
   ```
3. Chạy script để xuất file `.docx` chuẩn:
   - Công văn: `node scripts/generate_cong_van.js --input <input.json> --output <output.docx>`
   - Quyết định: `node scripts/generate_quyet_dinh.js --input <input.json> --output <output.docx>`

### D.2 — Rà soát & Sửa lỗi thể thức

Khi người dùng gửi file `.docx` hoặc dán văn bản hành chính yêu cầu đối chiếu thể thức:
1. Đọc nội dung văn bản.
2. Kiểm tra checklist 10 hạng mục trong `references/quy_tac_the_thuc.md`.
3. Đối chiếu thẩm quyền ký và cách trình bày chữ ký trong `references/phan_quyen_ky.md`.
4. Xuất bảng báo cáo kết quả lỗi kèm đề xuất sửa cụ thể.
5. Nếu người dùng đồng ý, chuyển đổi thông tin thành JSON và chạy script Node.js tương ứng để sinh lại file `.docx` chuẩn 100% thể thức.
