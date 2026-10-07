---
name: ra-soat-van-ban-hanh-chinh-vn
description: Rà soát chuyên sâu văn bản hành chính tiếng Việt, đặc biệt công văn, tờ trình, quyết định, thông báo và dự thảo của UBND/cơ quan nhà nước. Dùng khi người dùng yêu cầu rà soát, soát lỗi, kiểm tra câu cú, chính tả, thể thức, logic giao nhiệm vụ, đánh giá tính phù hợp, đối chiếu góp ý - tiếp thu - dự thảo, hoặc sửa DOCX/PDF. Kiểm tra đồng thời ngôn ngữ, thể thức Nghị định 30, số hiệu/ngày tháng/căn cứ, thẩm quyền, logic chủ trì-phối hợp-báo cáo, nguồn dữ liệu báo cáo, tính nhất quán giữa nhiều hồ sơ và phát hiện mâu thuẫn trước khi trình ký.
triggers: ['rà soát', 'soát lỗi', 'kiểm tra văn bản', 'hiệu đính', 'đối chiếu dự thảo', 'sửa lỗi chính tả', 'thẩm định']
---

# Rà soát văn bản hành chính Việt Nam

## Mục tiêu

Rà soát theo nguyên tắc:

**đúng câu chữ + đúng thể thức + đúng nguồn + đúng logic giao việc + đúng chuỗi hồ sơ**

Không chỉ sửa chính tả. Phải phát hiện cả lỗi có thể làm văn bản bị trả lại, giao sai trách nhiệm hoặc làm thay đổi ý chí chỉ đạo.

## Luồng xử lý

1. Xác định `intent`:
   - `quick_review`: soát nhanh lỗi lớn;
   - `full_review`: rà soát toàn diện;
   - `cross_document_review`: đối chiếu nhiều tài liệu;
   - `cross_level_implementation_review`: đối chiếu dự thảo triển khai cấp dưới (tỉnh/huyện/xã) so với văn bản cấp trên (Chính phủ, Thủ tướng, Bộ ngành TW);
   - `nd30_review`: tập trung thể thức;
   - `edit_docx`: sửa trực tiếp file Word;
   - `pre_signing_check`: kiểm tra trước trình ký.
2. Xác định loại tài liệu và vai trò từng file trong hồ sơ.
3. Chạy kiểm tra sơ bộ bằng `scripts/review.py` nếu có file/text máy đọc được.
4. Rà soát theo 7 lớp tại `references/review_workflow.md`.
5. Đối chiếu nguồn theo `references/source_policy.md`.
6. Nếu kiểm tra thể thức, đọc `references/nd30_checklist.md` và kiểm tra trực quan DOCX/PDF khi môi trường hỗ trợ.
7. Trả kết quả theo hợp đồng tại `references/data_model.md`.
8. Nếu sửa file Word, giữ bản gốc, tạo bản sạch và bản có chú thích khi người dùng yêu cầu.

## Quy tắc bắt buộc

- **Nguồn trước, sửa sau.** Không tự sửa số hiệu, ngày, tên cơ quan hoặc tên văn bản chỉ vì thấy một số hiệu gần giống ở tài liệu khác.
- Tách rõ 4 mức:
  - `must_fix`: lỗi chắc chắn, phải sửa;
  - `verify`: nghi vấn cần đối chiếu nguồn;
  - `should_fix`: nên sửa để rõ/đúng logic;
  - `editorial`: biên tập câu chữ, không đổi nội dung.
- Không tự thêm nghĩa vụ báo cáo, thời hạn, đầu mối, chế tài hoặc nơi nhận nếu hồ sơ nguồn không giao.
- Không đổi luồng báo cáo:
  - `báo cáo trực tiếp Bộ` ≠ `tham mưu UBND tỉnh báo cáo Bộ`;
  - `gửi Sở để tổng hợp` ≠ `báo cáo UBND tỉnh`.
- Một nhiệm vụ phải truy được chuỗi:
  `chủ thể → hành động → phối hợp → sản phẩm → thời hạn → nơi nhận → nguồn dữ liệu → trách nhiệm`.
- Nếu giao cơ quan đầu mối tổng hợp/báo cáo, phải chỉ ra dữ liệu lấy từ đâu.
- Không dùng từ `định kỳ` nếu chưa có kỳ báo cáo hoặc căn cứ giao báo cáo định kỳ.
- Không kết luận “đúng thể thức” chỉ từ text extraction; với DOCX/PDF phải kiểm tra trang thực tế nếu công cụ cho phép.
- Ưu tiên sửa tối thiểu tại đúng vị trí, không viết lại toàn văn nếu không cần.
- **Bảo toàn nguyên bản 100% về cấu trúc dòng, khung viền và font chữ (Zero Structure Mutation Engine):** Khi người dùng yêu cầu chỉnh sửa, cập nhật nội dung trên một file mẫu có sẵn hoặc file người dùng gửi lên (đặc biệt là Phiếu trình, Phiếu chuyển, Mẫu 2C, Biểu mẫu rà soát, hợp đồng):
  - **CẤM TUYỆT ĐỐI** bóc tách nội dung ra để tạo lại file DOCX mới từ đầu (re-generate from scratch bằng markdown/pandoc/docx-js) vì sẽ phá hủy toàn bộ viền khung, bảng biểu, cột, lề và ô vuông checkbox `☐`.
  - **CẤM TUYỆT ĐỐI** gán thô `paragraph.text = ...` hoặc `cell.text = ...` trong python-docx vì sẽ xóa sạch thẻ `<w:r>`, làm mất định dạng font, cỡ chữ, và in đậm/nghiêng của từng đoạn.
  - **BẮT BUỘC** áp dụng cơ chế **Edit In-Place (Sửa tại chỗ ở cấp độ Run)** bằng `scripts/edit_docx_template_in_place.py` hoặc `scripts/edit_phieu_trinh_template.py`: giữ nguyên file DOCX gốc, chỉ thay thế text bên trong các Run (`<w:t>`), bảo toàn 100% thuộc tính khung viền, bảng biểu, ô gộp, khoảng cách dòng và font chữ của file gốc.
- Không coi mọi góp ý là bắt buộc tiếp thu.
- Khi hồ sơ có góp ý và bảng tiếp thu, phải đối chiếu 3 chiều:
  `ý kiến gốc ↔ tiếp thu/giải trình ↔ dự thảo sau tiếp thu`.

- Nếu thiếu văn bản gốc hoặc nguồn có thẩm quyền, ghi `verify`; không đoán.

## Bản đồ hồ sơ

Khi có nhiều file, phân loại:

| Vai trò | Ví dụ | Dùng để |
|---|---|---|
| `source_superior` | Công văn/kết luận cấp trên | Xác định nhiệm vụ gốc |
| `signed_local` | Văn bản UBND đã ký | Xác định đầu mối/trách nhiệm đã giao |
| `comment` | Ý kiến góp ý | Xác định đề nghị chỉnh |
| `response_matrix` | Bảng tiếp thu/giải trình | Kiểm tra tuyên bố tiếp thu |
| `submission` | Tờ trình/Phiếu trình | Kiểm tra căn cứ, quá trình |
| `draft` | Dự thảo chờ ký | Đối tượng rà soát chính |

Nếu hai tài liệu mâu thuẫn, ưu tiên nguồn theo `references/source_policy.md`.

## Các lỗi phải chủ động săn

Đọc `references/common_error_patterns.md` để nhận diện các mẫu lỗi thực tế, đặc biệt:

- số hiệu gần nhau nhưng là hai văn bản khác nhau;
- báo cáo định kỳ/đột xuất nhưng không có nguồn dữ liệu;
- ghi “tiếp thu” nhưng bản cuối không sửa đúng;
- biên tập làm đổi `báo cáo trực tiếp` thành `tham mưu báo cáo`;
- nhiều đầu mối nhưng không rõ ai chịu trách nhiệm chung;
- vai trò đã giao ở văn bản trước bị mất trong dự thảo mới;
- ngày tháng nội tại vô lý;
- dùng sai động từ theo giai đoạn `nghiên cứu → xây dựng → trình → ban hành → tổ chức thực hiện`.

## Kiểm tra câu cú, chính tả

Phải kiểm tra:

- lỗi chính tả, dấu tiếng Việt, ký tự lỗi;
- lỗi dấu câu, câu quá dài, dấu `;`/`,` không đúng cấp ý;
- chủ thể hành động không rõ;
- thiếu chủ ngữ/vị ngữ;
- cụm bổ nghĩa đặt sai vị trí;
- liệt kê không song song;
- lặp ý hoặc lặp căn cứ;
- thuật ngữ, viết hoa và viết tắt không thống nhất;
- lỗi điển hình như `thầm quyền` thay vì `thẩm quyền`.

Không “làm đẹp” câu nếu việc sửa làm đổi thẩm quyền, chủ thể, sản phẩm, thời hạn hoặc nơi báo cáo.

## Kiểm tra logic giao nhiệm vụ

Với từng câu giao việc, trả lời được 8 câu:

1. Ai chủ trì?
2. Ai phối hợp?
3. Làm việc gì?
4. Kết quả/sản phẩm là gì?
5. Khi nào hoàn thành?
6. Gửi/báo cáo cho ai?
7. Dữ liệu/hồ sơ đầu vào lấy từ đâu?
8. Ai chịu trách nhiệm nếu chậm hoặc có vướng mắc?

Cảnh báo nếu một hoặc nhiều trường quan trọng bị thiếu trong nhiệm vụ có tính chất bắt buộc.

## Kiểm tra thể thức

Đọc `references/nd30_checklist.md`.

Nếu workspace có skill/tài liệu riêng về Nghị định 30 như:
- `quy_tac_the_thuc.md`;
- `phan_quyen_ky.md`;
- skill tạo văn bản hành chính;

thì dùng chúng làm nguồn kỹ thuật chi tiết hơn.

## Dùng script rà soát sơ bộ

```bash
python scripts/review.py --file "du-thao.docx"
python scripts/review.py --file "du-thao.pdf"
python scripts/review.py --text "Nội dung cần rà soát..."
python scripts/review.py --file "gop-y.docx" --file "tiep-thu.docx" --file "du-thao.docx"
```

Script chỉ phát hiện tín hiệu cơ học. Agent phải đọc ngữ cảnh và quyết định mức lỗi.

## Đầu ra

Mặc định trả:
- kết luận có thể trình ký hay chưa;
- bảng lỗi theo mức `must_fix/verify/should_fix/editorial`;
- kiểm tra logic giao nhiệm vụ;
- kiểm tra thể thức;
- đoạn sửa đề xuất;
- checklist trước trình ký.

Nếu ứng dụng cần JSON, dùng schema trong `references/data_model.md`.

## Đối chiếu văn bản triển khai cấp dưới với cấp trên (`cross_level_implementation_review`)

Áp dụng khi người dùng yêu cầu kiểm tra xem dự thảo văn bản của cấp tỉnh/huyện/xã đã bám sát quyết định, chỉ thị, kế hoạch của cấp trên (Thủ tướng, Chính phủ, Bộ ngành) hay chưa.

Quy trình bắt buộc gồm **Tư duy 5 bước** và **Đầu ra 4 phần**:

### 1. Chuỗi tư duy 5 bước:
- **Bước 1 (Trích yếu & Bản chất):** Xác định văn bản là "giao tham mưu xây dựng kế hoạch" hay "trực tiếp giao việc triển khai". Trích yếu phải khớp với toàn bộ nội dung.
- **Bước 2 (Lọc độ phủ nhiệm vụ):** Lọc toàn bộ nhiệm vụ của cấp dưới trong văn bản TW (cả việc *chủ trì tại địa phương* và việc *phối hợp với Bộ ngành TW*). Không bê nhiệm vụ của Bộ ngành TW thành trách nhiệm của tỉnh.
- **Bước 3 (Thẩm quyền & Quan hệ thể chế):** Kiểm tra cơ quan trong hệ thống UBND (dùng "giao/yêu cầu") vs ngoài hệ thống như Tòa án, Viện Kiểm sát, MTTQ (dùng "đề nghị/phối hợp"). Soi phạm vi rà soát văn bản (phải rà soát theo ngành/lĩnh vực để kiến nghị cấp có thẩm quyền xử lý, không được co hẹp chỉ rà soát văn bản do tỉnh ban hành).
- **Bước 4 (Mốc thời gian 2 tầng & Chu kỳ):** Phân biệt mốc TW ấn định (bắt buộc) vs mốc nội bộ địa phương tự đặt sớm hơn để tạo khoảng đệm (buffer). Tách bạch việc ngắn hạn (hội nghị, quán triệt) với việc thường xuyên dài hạn (tuyên truyền, phổ biến).
- **Bước 5 (Chu trình quản trị & Kinh phí):** Nhiệm vụ phải có "tổ chức thực hiện", "tổng hợp khó khăn vướng mắc", "sơ kết/tổng kết". Trách nhiệm kinh phí: cơ quan chủ trì lập dự toán ngân sách chi thường xuyên, Sở Tài chính thẩm định tham mưu bố trí (tránh dồn hết cho Sở Tài chính).

### 2. Cấu trúc đầu ra chuẩn 4 phần:
1. **Nhận định sơ bộ (Executive Summary):** Xác nhận đã đọc toàn bộ văn bản nguồn và dự thảo; chốt ngay kết luận tổng quan (mức độ bám sát, có cần viết lại hay chỉ chỉnh cục bộ).
2. **Những nội dung đã bám sát:** Bảng ma trận 3 cột `[Nội dung trong Dự thảo | Căn cứ trong Văn bản cấp trên | Đánh giá / Nhận xét]`.
3. **Những điểm cần chỉnh sửa, bổ sung (Bóc tách chuyên sâu):** Từng mục phân tích rõ: *Hiện trạng dự thảo $\rightarrow$ Quy định cấp trên $\rightarrow$ Phân tích rủi ro/điểm vênh $\rightarrow$ Đề xuất câu chữ chỉnh sửa (actionable wording)*.
4. **Đánh giá kỹ thuật văn bản, thể thức & Khuyến nghị trình ký:** Thể thức NĐ 30, dấu kết thúc `./.`, tính tương thích của trích yếu, khuyến nghị lựa chọn phương án trình ký.

## Sửa file DOCX & Bảo toàn Biểu mẫu gốc

Khi `intent=edit_docx` hoặc khi người dùng gửi file mẫu/biểu mẫu nhờ đánh giá, sửa đổi, cập nhật:

1. **Giữ nguyên 100% mẫu ban đầu của file gốc:**
   - Khổ trang: File gốc khổ ngang (Landscape) như Phiếu tự đánh giá thì BẮT BUỘC xuất khổ ngang, KHÔNG chuyển thành khổ dọc (Portrait). File gốc khổ dọc thì giữ khổ dọc.
   - Font & cỡ chữ: Giữ nguyên Times New Roman 13pt (hoặc cỡ chữ nguyên bản), KHÔNG tự ý tăng lên 14pt.
   - Bảng biểu & Màu nền (Shading): Giữ nguyên số cột, tiêu đề, đường kẻ bảng, màu nền ô tiêu đề (như màu cam/be nhạt #FCE4D6 của Phiếu tự đánh giá).
   - Trình bày dòng thông tin: Mỗi mục thông tin cá nhân (Họ tên, Ngạch, Đơn vị, Người quản lý) là một dòng/đoạn riêng biệt. CẤM gộp thành một đoạn dính liền chứa ký tự `\n` trần hiển thị trên mặt chữ Word.
   - TUYỆT ĐỐI KHÔNG TỰ SUY DIỄN MẪU KHÁC (tham khảo các mẫu chuẩn trong `bosung/lylich/`).
2. **Chỉ thay đổi nội dung và số liệu:** Cập nhật đúng các trường số liệu, tiêu chí đánh giá, kết quả theo yêu cầu vào đúng ô/dòng.
3. **Quy tắc khung chat:** Khi trao đổi, giải thích, liệt kê điểm sửa trong chat, TUYỆT ĐỐI KHÔNG xuất các thẻ thô `<b>`, `</b>`, `<r>`, `</r>`, `<red>`, `</red>`, `<span>`, `</span>`. Chỉ dùng định dạng markdown tự nhiên như `**in đậm**` hoặc `~~từ cũ~~ -> **từ mới**`.
4. Tạo `HOAN_THIEN.docx` (sửa tối thiểu tại đúng vị trí).
5. Nếu user yêu cầu giải thích, tạo `HOAN_THIEN_co_chu_thich.docx`.
6. Chỉ giao file sau khi kiểm tra không vỡ bố cục.

## Tích hợp Antigravity

Đọc `references/antigravity_integration.md`.

Cấu trúc skill được thiết kế để nhúng trực tiếp vào:

```text
<workspace>/.agents/skills/ra-soat-van-ban-hanh-chinh-vn/
```

Không bắt buộc connector. Nếu ứng dụng có connector pháp luật chính thức, dùng connector đó khi cần xác minh văn bản hiện hành/số hiệu/căn cứ thay vì suy đoán.
