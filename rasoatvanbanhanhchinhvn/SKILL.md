---
name: ra-soat-van-ban-hanh-chinh-vn
description: Rà soát chuyên sâu văn bản hành chính tiếng Việt, đặc biệt công văn, tờ trình, quyết định, thông báo và dự thảo của UBND/cơ quan nhà nước. Dùng khi người dùng yêu cầu rà soát, soát lỗi, kiểm tra câu cú, chính tả, thể thức, logic giao nhiệm vụ, đánh giá tính phù hợp, đối chiếu góp ý - tiếp thu - dự thảo, hoặc sửa DOCX/PDF. Kiểm tra đồng thời ngôn ngữ, thể thức Nghị định 30, số hiệu/ngày tháng/căn cứ, thẩm quyền, logic chủ trì-phối hợp-báo cáo, nguồn dữ liệu báo cáo, tính nhất quán giữa nhiều hồ sơ và phát hiện mâu thuẫn trước khi trình ký.
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

## Sửa file DOCX

Khi `intent=edit_docx`:

1. Giữ nguyên file gốc.
2. Sửa tối thiểu tại đúng vị trí.
3. Tạo `HOAN_THIEN.docx`.
4. Nếu user yêu cầu giải thích, tạo `HOAN_THIEN_co_chu_thich.docx`.
5. Mỗi thay đổi phải có: vị trí, nguyên văn, nội dung sửa, lý do, nguồn đối chiếu.
6. Render/xem toàn bộ trang nếu môi trường hỗ trợ.
7. Chỉ giao file sau khi kiểm tra không vỡ bố cục.

## Tích hợp Antigravity

Đọc `references/antigravity_integration.md`.

Cấu trúc skill được thiết kế để nhúng trực tiếp vào:

```text
<workspace>/.agents/skills/ra-soat-van-ban-hanh-chinh-vn/
```

Không bắt buộc connector. Nếu ứng dụng có connector pháp luật chính thức, dùng connector đó khi cần xác minh văn bản hiện hành/số hiệu/căn cứ thay vì suy đoán.
