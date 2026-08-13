---
name: ra-soat-van-ban-hanh-chinh
description: Rà soát chuyên sâu văn bản hành chính tiếng Việt, đặc biệt công văn, tờ trình, quyết định, thông báo và dự thảo của UBND/cơ quan nhà nước. Dùng khi người dùng yêu cầu "rà soát", "soát lỗi", "kiểm tra câu cú", "chính tả", "thể thức", "logic giao nhiệm vụ", "đánh giá tính phù hợp", "đối chiếu góp ý - tiếp thu - dự thảo", hoặc sửa file DOCX/PDF. Kiểm tra đồng thời ngôn ngữ, thể thức Nghị định 30, số hiệu/ngày tháng/căn cứ, thẩm quyền, logic chủ trì-phối hợp-báo cáo, tính nhất quán giữa nhiều hồ sơ và phát hiện mâu thuẫn ẩn trước khi trình ký.
---

# Rà soát văn bản hành chính Việt Nam

## 1. Mục tiêu

Thực hiện rà soát theo tư duy **"đúng câu chữ + đúng thể thức + đúng nguồn + đúng logic giao việc + đúng chuỗi hồ sơ"**.

Không chỉ sửa chính tả. Phải phát hiện cả các lỗi có thể làm văn bản:
- giao sai hoặc không rõ trách nhiệm;
- mâu thuẫn giữa các câu, các mục hoặc các tài liệu liên quan;
- viện dẫn nhầm số hiệu, ngày tháng, tên văn bản;
- tiếp thu ý kiến nhưng dự thảo cuối không phản ánh đúng;
- quy định chế độ báo cáo nhưng không có nguồn dữ liệu để tổng hợp;
- thay đổi bản chất nhiệm vụ khi biên tập câu chữ;
- sai thể thức, khối ký, nơi nhận hoặc kỹ thuật trình bày.

## 2. Nguyên tắc bắt buộc

1. **Giữ nguyên ý chí chỉ đạo.** Chỉ sửa nội dung khi có lỗi, mâu thuẫn, thiếu rõ ràng hoặc có căn cứ nguồn.
2. **Nguồn trước, sửa sau.** Không tự sửa số hiệu, ngày tháng, cơ quan ban hành hoặc tên văn bản chỉ vì thấy một số hiệu khác xuất hiện ở tài liệu liên quan.
3. **Phân loại chắc chắn.** Tách rõ:
   - `BẮT BUỘC SỬA`: lỗi chắc chắn;
   - `CẦN XÁC MINH`: có dấu hiệu sai nhưng chưa đủ nguồn;
   - `NÊN SỬA`: câu chữ/logic chưa tối ưu;
   - `BIÊN TẬP`: đề xuất làm gọn, không làm thay đổi nội dung.
4. **Không tạo thêm nghĩa vụ ngoài nguồn.** Không tự thêm chế độ báo cáo, thời hạn, đầu mối, trách nhiệm hoặc chế tài nếu hồ sơ nguồn không giao.
5. **Không thay đổi luồng báo cáo.** "Báo cáo trực tiếp Bộ..." khác với "tham mưu UBND tỉnh báo cáo..."; chỉ chuyển đổi khi có căn cứ hoặc yêu cầu rõ.
6. **Một nhiệm vụ phải truy được chuỗi thực hiện:** chủ thể → hành động → phối hợp → sản phẩm → thời hạn → nơi nhận → nguồn dữ liệu → trách nhiệm.
7. **Không kết luận thể thức thị giác chỉ từ text extraction.** Với DOCX/PDF, nếu có khả năng render/xem trang thì phải kiểm tra trực quan trước khi kết luận.
8. **Sửa tối thiểu nhưng đủ.** Ưu tiên sửa tại đúng câu/đoạn, không viết lại toàn văn nếu không cần.
9. **Khi sửa file**, luôn giữ một bản sạch; nếu người dùng yêu cầu giải thích, tạo thêm bản có chú thích/track changes hoặc bảng thay đổi.
10. **Không che giấu sự không chắc chắn.** Nếu thiếu văn bản gốc, ghi rõ cần đối chiếu nguồn nào.

## 3. Chế độ đầu vào

Nhận một hoặc nhiều loại dữ liệu:

- Nội dung người dùng dán trực tiếp.
- File `.docx`, `.doc`, `.pdf`.
- PDF scan/ảnh chụp văn bản.
- Bộ hồ sơ gồm: văn bản cấp trên, văn bản giao nhiệm vụ, dự thảo, tờ trình, phiếu trình, ý kiến góp ý, bảng tiếp thu/giải trình, dự thảo sau tiếp thu.
- Nhiều phiên bản của cùng một dự thảo.

### Khi có nhiều file

Lập nhanh **Bản đồ hồ sơ** trước khi rà soát:

| Nhóm | Ví dụ | Giá trị đối chiếu |
|---|---|---|
| Nguồn cấp trên | Công văn, thông báo, kết luận, kế hoạch | Xác định nhiệm vụ gốc |
| Văn bản đã ký của tỉnh | Công văn giao nhiệm vụ trước | Xác định đầu mối, trách nhiệm đã giao |
| Ý kiến góp ý | Công văn góp ý của sở/ngành/địa phương | Xác định yêu cầu chỉnh |
| Bảng tiếp thu | Tổng hợp ý kiến, giải trình | Xác định nội dung tuyên bố đã tiếp thu |
| Tờ trình | Tờ trình xin ban hành | Kiểm tra căn cứ và mô tả quá trình |
| Dự thảo cuối | Văn bản chờ ký | Đối tượng rà soát chính |

Ưu tiên tài liệu **đã ký/chính thức** hơn tài liệu dự thảo khi có xung đột.

## 4. Quy trình rà soát 7 lớp

### Lớp 1 — Kiểm tra nhận dạng và nguồn

Xác định:
- loại văn bản;
- cơ quan ban hành;
- người/chức danh ký dự kiến;
- đối tượng nhận;
- mục tiêu văn bản;
- văn bản nguồn/căn cứ trực tiếp;
- mốc thời gian áp dụng.

Kiểm tra từng viện dẫn:
- số, ký hiệu;
- ngày ban hành;
- cơ quan/người ban hành;
- trích yếu/tên văn bản;
- quan hệ giữa các văn bản.

**Quy tắc chống sửa nhầm:**  
Nếu thấy `05/CTQH` ở một căn cứ và `06/CTQH` ở một văn bản khác, không được tự suy luận số 05 là sai. Phải kiểm tra văn bản gốc. Hai số hiệu khác nhau có thể cùng hợp lệ và phục vụ hai nhánh nhiệm vụ khác nhau.

Kiểm tra bất thường thời gian:
- văn bản tháng 7 nhưng ghi "nhận được" văn bản ngày 04/8;
- ngày dẫn chiếu sau ngày ký dự kiến;
- hạn báo cáo xảy ra trước ngày giao nhiệm vụ.

### Lớp 2 — Kiểm tra logic giao nhiệm vụ

Với mỗi nhiệm vụ, tạo ngầm ma trận:

`AI / CƠ QUAN NÀO` → `LÀM GÌ` → `PHỐI HỢP VỚI AI` → `SẢN PHẨM GÌ` → `KHI NÀO` → `GỬI CHO AI` → `DỮ LIỆU TỪ ĐÂU`

Kiểm tra các lỗi sau:

#### 2.1. Chủ trì - phối hợp không rõ
- Có đúng một đầu mối chủ trì không?
- Cơ quan phối hợp có nhiệm vụ thực chất hay chỉ được liệt kê?
- Có giao hai cơ quan cùng "chủ trì" một sản phẩm không?

#### 2.2. Sai luồng báo cáo
Phân biệt:
- báo cáo trực tiếp cơ quan Trung ương;
- tham mưu UBND tỉnh ký báo cáo;
- báo cáo UBND tỉnh để theo dõi;
- gửi Sở đầu mối để tổng hợp.

Không hoán đổi các luồng trên khi chưa có căn cứ.

#### 2.3. Mâu thuẫn về chế độ báo cáo và nguồn dữ liệu
Nếu giao một cơ quan:
> "theo dõi, đôn đốc, tổng hợp; định kỳ/đột xuất tham mưu báo cáo"

thì phải trả lời được:
> "Thông tin và số liệu để tổng hợp lấy từ đâu?"

Cảnh báo mâu thuẫn nếu cùng lúc quy định:
> "không yêu cầu các cơ quan, đơn vị báo cáo riêng"

nhưng không có:
- chế độ báo cáo hiện hành chứa đủ dữ liệu; hoặc
- cơ chế đề nghị cung cấp/cập nhật bổ sung khi thiếu.

Cách viết an toàn:
> "Việc tổng hợp sử dụng thông tin, số liệu từ các chế độ báo cáo hiện hành và dữ liệu do cơ quan, đơn vị cung cấp; trường hợp chưa đáp ứng yêu cầu tổng hợp, cơ quan đầu mối đề nghị cung cấp, cập nhật bổ sung; hạn chế tối đa phát sinh chế độ báo cáo riêng."

Không tự dùng từ **"định kỳ"** nếu chưa xác định kỳ báo cáo/căn cứ giao báo cáo định kỳ.

#### 2.4. Thay đổi bản chất nhiệm vụ
Phát hiện các cặp dễ bị đổi nghĩa:
- `chủ trì thực hiện` ↔ `tham mưu thực hiện`;
- `báo cáo trực tiếp` ↔ `tham mưu UBND báo cáo`;
- `xây dựng` ↔ `ban hành`;
- `rà soát, đề xuất` ↔ `quyết định`;
- `theo dõi, tổng hợp` ↔ `chủ trì chuyên môn`.

Khi thay từ, phải kiểm tra thẩm quyền và giai đoạn công việc.

#### 2.5. Nhiệm vụ không phù hợp chức năng
Kiểm tra cơ quan được giao có:
- chức năng chuyên môn;
- quyền ban hành/quyết định;
- dữ liệu cần thiết;
- khả năng điều phối;
- vai trò đã được giao trong văn bản trước.

Nếu văn bản đã ký trước đó giao một sở làm đầu mối theo dõi, đôn đốc, tổng hợp, dự thảo mới không được âm thầm loại bỏ vai trò này nếu không có chủ trương thay đổi.

### Lớp 3 — Kiểm tra tính nhất quán giữa các tài liệu

Khi có góp ý + bảng tiếp thu + dự thảo cuối, đối chiếu 3 chiều:

`Ý kiến gốc` ↔ `Nội dung tiếp thu/giải trình` ↔ `Dự thảo sau tiếp thu`

Kiểm tra:
- ghi "Tiếp thu" nhưng dự thảo không sửa;
- chỉ tiếp thu một phần nhưng bảng ghi "Tiếp thu";
- dự thảo thêm nội dung vượt quá ý kiến góp ý;
- cụm từ quan trọng bị mất khi chuyển bản;
- số lượng cơ quan/ý kiến trong Tờ trình diễn đạt không chính xác;
- nội dung đã được giao ở văn bản trước nhưng dự thảo mới bỏ sót.

**Quy tắc:**  
Nếu bảng ghi "Tiếp thu", nội dung cuối phải phản ánh được ý kiến đó. Nếu không phản ánh đầy đủ, đổi thành "Tiếp thu một phần" và giải thích phần không tiếp thu.

### Lớp 4 — Kiểm tra câu cú, chính tả và kỹ thuật diễn đạt

Kiểm tra lần lượt:

#### 4.1. Chính tả
- sai dấu;
- thiếu/thừa chữ;
- dính ký tự lỗi;
- nhầm "thẩm quyền/thầm quyền";
- nhầm từ gần âm/gần nghĩa;
- viết tắt không thống nhất.

#### 4.2. Dấu câu
- câu quá dài chỉ dùng dấu phẩy;
- dùng `;` và `,` không đúng cấp ý;
- dấu chấm sau ngoặc kép;
- dấu `./.` kết thúc văn bản;
- liệt kê không song song.

#### 4.3. Cấu trúc câu
Phát hiện:
- thiếu chủ ngữ/vị ngữ;
- chủ thể hành động không rõ;
- nhiều mệnh đề chồng nhau;
- câu dẫn chiếu quá dài;
- quan hệ nguyên nhân/kết quả không rõ;
- cụm bổ nghĩa đặt xa đối tượng;
- câu có thể hiểu theo hai nghĩa.

#### 4.4. Trùng ý và rườm rà
- hai gạch đầu dòng cùng giao "rà soát, đánh giá, kiến nghị";
- lặp "theo quy định" nhiều lần;
- lặp tên văn bản khi đã có ký hiệu viết tắt;
- diễn đạt lại nguyên văn nguồn nhưng không tạo nhiệm vụ cụ thể.

#### 4.5. Thuật ngữ và viết hoa
Giữ thống nhất:
- `Ủy ban nhân dân (UBND)` khi giới thiệu lần đầu nếu cần viết tắt;
- tên cơ quan, chức danh;
- `sở, ban, ngành` khi dùng như danh từ chung;
- số/ký hiệu văn bản;
- tên loại văn bản;
- ngày tháng theo cùng một chuẩn.

### Lớp 5 — Kiểm tra thể thức văn bản hành chính

Nếu workspace có các tài liệu sau, ưu tiên đọc trước khi kết luận:
- `quy_tac_the_thuc.md`;
- `phan_quyen_ky.md`;
- tài liệu/skill về Nghị định 30/2020/NĐ-CP.

Kiểm tra tối thiểu:

1. Khổ giấy A4.
2. Lề trang.
3. Font Times New Roman, Unicode.
4. Cỡ chữ theo từng thành phần.
5. Tên cơ quan ban hành.
6. Quốc hiệu - Tiêu ngữ.
7. Số, ký hiệu.
8. Địa danh, ngày tháng.
9. Trích yếu.
10. `Kính gửi`.
11. Bố cục nội dung.
12. Khối ký: `TM.`, `KT.`, `TL.`, `TUQ.` nếu có.
13. Chức vụ và họ tên người ký.
14. `Nơi nhận`.
15. Ký hiệu người soạn/lưu hồ sơ nếu cơ quan sử dụng.
16. Căn lề, khoảng cách đoạn, giãn dòng.
17. Không rớt chữ, vỡ bảng, chồng chữ, sai ngắt trang.

**Bắt buộc với DOCX/PDF có khả năng render:**  
Render/xem từng trang trước khi xác nhận "đúng thể thức". Text extraction không đủ để kiểm tra căn lề, rớt dòng, khối chữ ký và bảng.

### Lớp 6 — Kiểm tra thẩm quyền và tính phù hợp hành chính

Không biến bước này thành tư vấn pháp lý dài dòng. Chỉ kiểm tra các điểm liên quan trực tiếp đến dự thảo:

- cơ quan được giao có đúng vai trò không;
- hành động dùng động từ đúng thẩm quyền không;
- người ký/cấp ký có phù hợp dạng văn bản không;
- nhiệm vụ mới có vượt nguồn chỉ đạo không;
- có vô tình tạo thủ tục/hồ sơ/chế độ báo cáo mới không;
- có tạo nghĩa vụ cho cơ quan không nằm trong đối tượng nhận không;
- thời hạn có khả thi và phù hợp văn bản nguồn không.

Nếu cần xác minh pháp luật hoặc văn bản hiện hành, chuyển sang quy trình tra cứu pháp lý/nguồn chính thức; không đoán.

### Lớp 7 — QA cuối trước khi kết luận

Tự hỏi 12 câu:

1. Có lỗi số hiệu/ngày tháng nào chưa được đối chiếu nguồn?
2. Có câu nào sửa nhưng làm đổi bản chất nhiệm vụ?
3. Có nhiệm vụ nào không có đầu mối chủ trì?
4. Có nhiệm vụ tổng hợp/báo cáo mà không rõ nguồn dữ liệu?
5. Có hai luồng báo cáo mâu thuẫn?
6. Có thời hạn không khả thi hoặc sai so với nguồn?
7. Có ý kiến ghi "tiếp thu" nhưng chưa đi vào dự thảo?
8. Có nội dung trong dự thảo cuối không xuất hiện ở nguồn/chỉ đạo?
9. Có lỗi chính tả, dấu câu, viết hoa, viết tắt?
10. Có lỗi thể thức hoặc khối ký?
11. Có thay đổi vai trò cơ quan so với văn bản đã ký trước đó?
12. Nếu người dùng ký ngay bản này, còn điểm nào có khả năng bị trả lại vì lỗi kỹ thuật/logic không?

Chỉ kết luận "có thể trình ký" khi không còn lỗi `BẮT BUỘC SỬA`.

## 5. Thứ tự ưu tiên nguồn khi có xung đột

Áp dụng thứ tự thực hành sau:

1. Bản gốc/chính thức của văn bản cấp trên.
2. Văn bản đã ký của UBND/cơ quan có thẩm quyền.
3. Văn bản góp ý chính thức của cơ quan liên quan.
4. Bảng tổng hợp, tiếp thu, giải trình.
5. Tờ trình.
6. Dự thảo cuối.
7. Ghi chú nội bộ hoặc suy luận.

Không sửa nguồn cấp cao hơn để "khớp" với dự thảo cấp dưới.

## 6. Mẫu đầu ra mặc định

### 6.1. Khi người dùng hỏi "rà soát/đánh giá"

Dùng cấu trúc:

```markdown
## Kết luận
[3-7 câu: mức độ phù hợp, có nên trình ký chưa, số lỗi bắt buộc sửa]

## Các lỗi/điểm cần xử lý

| Mức | Vị trí | Nội dung hiện tại | Vấn đề | Đề xuất |
|---|---|---|---|---|
| BẮT BUỘC SỬA | ... | ... | ... | ... |
| CẦN XÁC MINH | ... | ... | ... | ... |
| NÊN SỬA | ... | ... | ... | ... |

## Kiểm tra logic giao nhiệm vụ
[Chủ trì - phối hợp - sản phẩm - thời hạn - nơi báo cáo - nguồn dữ liệu]

## Kiểm tra thể thức
[Chỉ nêu lỗi thực sự kiểm tra được]

## Đoạn sửa đề xuất
[Chỉ đưa các đoạn cần sửa, trừ khi user yêu cầu toàn văn]

## Checklist trước trình ký
- [ ] Số hiệu/ngày tháng đúng nguồn
- [ ] Góp ý và tiếp thu khớp
- [ ] Chủ trì/phối hợp rõ
- [ ] Báo cáo có nguồn dữ liệu
- [ ] Thể thức/khối ký đúng
```

### 6.2. Khi người dùng yêu cầu "soát nhanh"

Chỉ trả:
- lỗi bắt buộc sửa;
- lỗi logic lớn;
- lỗi chính tả rõ;
- 01 phương án câu sửa.

Không mở rộng phân tích nếu không cần.

### 6.3. Khi người dùng yêu cầu "sửa file Word"

Thực hiện:
1. Giữ nguyên file gốc.
2. Sửa tối thiểu tại đúng vị trí.
3. Tạo bản `HOAN_THIEN.docx`.
4. Nếu user yêu cầu chú thích, tạo thêm bản `HOAN_THIEN_co_chu_thich.docx`.
5. Ghi chú mỗi thay đổi theo mẫu:
   - vị trí;
   - nguyên văn;
   - nội dung sửa;
   - lý do;
   - nguồn đối chiếu.
6. Render/xem toàn bộ trang nếu môi trường hỗ trợ.
7. Chỉ giao file sau khi kiểm tra không vỡ bố cục.

## 7. Bộ lỗi điển hình rút ra từ lịch sử xử lý thực tế

Đây là các mẫu lỗi phải chủ động săn tìm ở mọi hồ sơ tương tự.

### Mẫu A — Bẫy số hiệu gần nhau
**Hiện tượng:** thấy số 05 ở một câu và số 06 ở câu khác nên cho rằng một số bị gõ sai.  
**Bài học:** phải đọc văn bản gốc; hai số có thể là hai văn bản khác nhau cùng liên quan.

### Mẫu B — Báo cáo nhưng không có nguồn số liệu
**Hiện tượng:** giao cơ quan đầu mối "định kỳ/đột xuất tổng hợp báo cáo" nhưng đồng thời cấm các đơn vị báo cáo riêng.  
**Bài học:** phải thiết kế nguồn dữ liệu từ chế độ báo cáo hiện hành và cơ chế yêu cầu bổ sung khi thiếu.

### Mẫu C — Tiếp thu trên giấy nhưng không vào dự thảo
**Hiện tượng:** bảng giải trình ghi "Tiếp thu", nhưng cụm từ cốt lõi của ý kiến góp ý bị bỏ ở dự thảo cuối.  
**Bài học:** đối chiếu 3 chiều ý kiến - tiếp thu - bản cuối.

### Mẫu D — Đổi luồng báo cáo khi biên tập
**Hiện tượng:** nguồn yêu cầu đơn vị báo cáo trực tiếp Bộ nhưng dự thảo lại viết "tham mưu UBND tỉnh báo cáo Bộ".  
**Bài học:** đây là thay đổi bản chất, không phải sửa câu chữ.

### Mẫu E — Đầu mối bị phân tán
**Hiện tượng:** Sở A và Trung tâm B được giao các đoạn tách rời, dẫn đến khó xác định ai chịu trách nhiệm chung.  
**Bài học:** khi mục tiêu cần một đầu mối xuyên suốt, diễn đạt "giao Sở A chủ trì, phối hợp B..." và làm rõ trách nhiệm tiến độ.

### Mẫu F — Vai trò đã giao ở văn bản trước bị mất
**Hiện tượng:** văn bản đã ký giao một sở "theo dõi, đôn đốc, tổng hợp", nhưng dự thảo mới chỉ còn nhiệm vụ chuyên môn hẹp.  
**Bài học:** so sánh lịch sử giao nhiệm vụ trước khi kết luận dự thảo đầy đủ.

### Mẫu G — Sai thời gian nội tại
**Hiện tượng:** văn bản đề tháng 7 nhưng nội dung ghi nhận văn bản ngày 04/8.  
**Bài học:** kiểm tra logic thời gian độc lập với chính tả.

### Mẫu H — Dùng động từ sai giai đoạn
**Hiện tượng:** dùng "ban hành kế hoạch" khi cơ quan mới đang được giao nghiên cứu/xây dựng.  
**Bài học:** phân biệt `nghiên cứu` → `xây dựng` → `trình` → `ban hành` → `tổ chức thực hiện`.

## 8. Quy tắc biên tập câu chỉ đạo

Ưu tiên cấu trúc:

> **Giao [cơ quan chủ trì] chủ trì, phối hợp với [cơ quan phối hợp] [hành động cụ thể]; [sản phẩm/kết quả]; [nơi gửi/báo cáo] trước [thời hạn]. Trong quá trình thực hiện, [cơ chế xử lý vướng mắc/trách nhiệm].**

Khi văn bản chỉ chuyển giao nhiệm vụ từ cấp trên:

> **[UBND tỉnh] nhận được [văn bản nguồn] về [trích yếu] (sao gửi kèm). Giao [cơ quan] chủ trì, phối hợp [cơ quan liên quan] nghiên cứu, triển khai thực hiện theo yêu cầu; tổng hợp, báo cáo [đúng nơi nhận] trong thời hạn quy định, đồng thời báo cáo UBND tỉnh kết quả thực hiện để theo dõi/chỉ đạo (nếu cần).**

Không thêm "đồng thời báo cáo UBND tỉnh" nếu yêu cầu này gây phát sinh nghĩa vụ không cần thiết và user không muốn.

## 9. Tích hợp với Antigravity

Đặt file này tại:

```text
<workspace>/.agents/skills/ra-soat-van-ban-hanh-chinh/SKILL.md
```

hoặc thư mục skill mà Antigravity đang cấu hình.

Nếu workspace đã có skill Nghị định 30, sử dụng song song:
- skill này: **logic, câu chữ, chính tả, đối chiếu hồ sơ, QA trước trình ký**;
- skill NĐ30: **thông số thể thức chi tiết và sinh DOCX**.

Khi phát hiện file `quy_tac_the_thuc.md` hoặc `phan_quyen_ky.md` trong workspace, đọc các file đó trước khi kết luận về thể thức hoặc thẩm quyền ký.

## 10. Giới hạn

- Không tự bịa số hiệu, ngày tháng hoặc nội dung văn bản nguồn.
- Không kết luận thẩm quyền pháp lý phức tạp nếu chưa tra cứu căn cứ.
- Không coi mọi góp ý là bắt buộc tiếp thu.
- Không "làm đẹp câu" bằng cách đổi chủ thể, thời hạn, nơi báo cáo hoặc sản phẩm.
- Không tuyên bố "đúng Nghị định 30" nếu chưa kiểm tra phần trình bày thực tế.
- Không sửa bản chính thức đã ký; tạo bản dự thảo/phiên bản mới để người dùng xem xét.
