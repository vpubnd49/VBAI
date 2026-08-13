---
name: tra-cuu-hanh-chinh-vn
description: Tra cứu và chuẩn hóa dữ liệu hành chính - pháp lý Việt Nam theo nguồn có cấu trúc, tập trung vào địa giới 34 tỉnh/thành sau sắp xếp, mô hình chính quyền địa phương 2 cấp, cơ cấu 06 Sở mới của tỉnh Lâm Đồng năm 2025, căn cứ Nghị định 30/Nghị quyết 60/Kế hoạch 141 và các snapshot chỉ số CCHC. Dùng khi người dùng hỏi tên cơ quan cũ/mới, tỉnh/thành sau sắp xếp, cơ quan tiếp nhận nhiệm vụ, số/ký hiệu/ngày văn bản, mốc áp dụng, PAR Index/SIPAS/PAPI/PCI/Bộ chỉ số 766, hoặc cần kiểm tra một câu/đoạn văn theo dữ liệu nguồn. Luôn phân biệt dữ liệu lịch sử với dữ liệu hiện hành, trả kết quả có nguồn, mốc thời gian và cảnh báo độ mới.
---

# Tra cứu hành chính - pháp lý Việt Nam

## 1. Mục tiêu

Thực hiện tra cứu theo tư duy:

**"đúng thực thể + đúng mốc thời gian + đúng nguồn + đúng tên chuẩn + đúng phạm vi áp dụng"**.

Skill này dùng để:
- chuẩn hóa tên đơn vị hành chính, cơ quan, Sở;
- tra mapping trước/sau sắp xếp;
- tra số, ký hiệu, ngày và nội dung căn cứ đã có trong dữ liệu;
- nhận diện tên cơ quan cũ trong văn bản mới;
- cung cấp context cho mô-đun soạn thảo văn bản hành chính;
- tra các snapshot PAR Index, SIPAS, PAPI, PCI, Bộ chỉ số 766 và chỉ tiêu CCHC;
- cảnh báo khi câu hỏi đòi hỏi dữ liệu hiện hành nhưng nguồn đóng gói chỉ là snapshot.

Không được biến dữ liệu nền/snapshot thành khẳng định "hiện nay" nếu chưa có nguồn mới hơn.

## 2. Nguyên tắc bắt buộc

1. **Mốc thời gian trước, kết luận sau.**  
   Phải xác định câu hỏi đang nói về thời điểm nào: trước sắp xếp, giai đoạn chuyển tiếp, sau sắp xếp hay hiện tại.

2. **Nguồn trước, suy luận sau.**  
   Không tự tạo số hiệu, ngày tháng, tên văn bản, điều/khoản, chức danh hoặc số liệu.

3. **Tên chuẩn phải gắn với ngữ cảnh thời gian.**  
   Tên cơ quan cũ không mặc nhiên là sai nếu câu đang mô tả giai đoạn lịch sử hoặc có ghi "(cũ)", "trước sắp xếp".

4. **Phân biệt 04 trạng thái kết quả:**
   - `found`: có dữ liệu đủ để trả lời;
   - `not_found`: không có dữ liệu tương ứng;
   - `conflict`: các nguồn có điểm mâu thuẫn cần đối chiếu;
   - `needs_freshness_check`: có dữ liệu nền nhưng không đủ để khẳng định hiện trạng.

5. **Không đồng nhất ngày văn bản với ngày tổ chức đi vào hoạt động.**  
   Với các Nghị quyết 390-395/NQ-HĐND của HĐND tỉnh Lâm Đồng:
   - ngày thông qua/ngày văn bản: 18/02/2025;
   - các Sở mới đi vào hoạt động: 01/03/2025.

6. **Dữ liệu chỉ số phải có kỳ và ngày chốt.**  
   Không trả một tỷ lệ/số điểm mà thiếu `period` hoặc `as_of` nếu dữ liệu nguồn có mốc này.

7. **Ưu tiên nguồn chính thức hơn dữ liệu dẫn xuất.**  
   Nếu có văn bản gốc/chính thức, dùng văn bản đó để kết luận; CSV/JSON chỉ là lớp tra cứu nhanh.

8. **Nếu câu hỏi có từ "hiện nay", "mới nhất", "đang có hiệu lực", "đang áp dụng", "hôm nay"** và nguồn đóng gói không đủ mới:
   - không khẳng định;
   - trả `needs_freshness_check`;
   - nếu ứng dụng có connector pháp luật/nguồn chính thức thì phải tra connector trước khi trả kết luận.

9. **Không tự sửa dữ liệu nguồn.**  
   Nếu phát hiện lỗi chính tả trong dữ liệu dẫn xuất, giữ nguyên `source_text` và chỉ chuẩn hóa ở trường `canonical_name` khi có căn cứ chắc chắn.

10. **Khi dùng cho soạn thảo văn bản**, Skill này chỉ cấp dữ liệu/context.  
    Việc sinh DOCX, kiểm tra thể thức Nghị định 30 hoặc rà soát logic văn bản phải chuyển cho skill/mô-đun tương ứng nếu có.

## 3. Chế độ đầu vào

Nhận các dạng yêu cầu:

- Câu hỏi tự nhiên:
  - "Bình Thuận sau sắp xếp thuộc tỉnh nào?"
  - "Sở Giao thông vận tải Lâm Đồng bây giờ là Sở nào?"
  - "Nghị quyết thành lập Sở Xây dựng Lâm Đồng số bao nhiêu?"
  - "Tỷ lệ hồ sơ trực tuyến toàn trình của Lâm Đồng năm 2025 là bao nhiêu?"
- Đoạn văn cần kiểm tra:
  - "Giao Sở Giao thông vận tải tỉnh Lâm Đồng..."
  - "UBND huyện..."
- JSON từ ứng dụng:
```json
{
  "intent": "lookup_entity",
  "query": "Sở Giao thông vận tải tỉnh Lâm Đồng",
  "as_of": "2025-12-01",
  "domain": "lam_dong_organization"
}
```
- Context từ skill soạn thảo/rà soát văn bản.

## 4. Phân loại ý định

Tự phân loại thành một trong các intent sau:

| Intent | Dùng khi |
|---|---|
| `lookup_entity` | Tra tên đơn vị hành chính/cơ quan/Sở |
| `compare_before_after` | So sánh trước và sau sắp xếp |
| `lookup_legal_basis` | Tra số hiệu, ngày, tên/căn cứ |
| `lookup_metric` | Tra PAR Index, SIPAS, PAPI, PCI, Bộ chỉ số 766, tỷ lệ CCHC |
| `validate_text` | Kiểm tra tên cơ quan/địa danh/căn cứ trong đoạn văn |
| `draft_context` | Cấp dữ liệu chuẩn cho mô-đun soạn thảo |
| `current_status` | Người dùng hỏi tình trạng hiện hành/mới nhất |

Nếu một câu có nhiều intent, xử lý theo thứ tự:
`current_status` → `lookup_legal_basis` → `lookup_entity` → `validate_text` → `draft_context`.

## 5. Quy trình tra cứu 6 bước

### Bước 1 — Chuẩn hóa câu hỏi

Trích ra:
- thực thể chính;
- tên cũ/tên mới nếu có;
- địa phương;
- mốc thời gian;
- loại thông tin cần trả;
- từ khóa chỉ độ mới: "hiện nay", "mới nhất", "đang áp dụng"...

### Bước 2 — Chọn miền dữ liệu

1. `geography_34`: địa giới cấp tỉnh.
2. `lam_dong_organization`: 06 Sở Lâm Đồng.
3. `legal_baseline`: NĐ30, NQ60, KH141 và các Nghị quyết 390-395/NQ-HĐND.
4. `cchc_snapshot`: chỉ số CCHC.
5. `text_validation`: kiểm tra câu/đoạn theo các miền trên.

### Bước 3 — So khớp thực thể

Ưu tiên:
1. exact match;
2. bỏ khác biệt hoa/thường;
3. bỏ tiền tố "tỉnh", "thành phố", "Sở";
4. alias/tên cũ;
5. fuzzy match chỉ để đề xuất, không dùng để tự kết luận nếu có nhiều ứng viên.

### Bước 4 — Kiểm tra thời gian

Xác định:
- `source_date`;
- `effective_from`;
- `operational_from`;
- `as_of`;
- thời điểm người dùng hỏi.

Nếu dữ liệu không bao phủ thời điểm yêu cầu, trả `needs_freshness_check`.

### Bước 5 — Kiểm tra nguồn

Thứ tự ưu tiên:
1. văn bản gốc/chính thức;
2. tài liệu chính thức người dùng cung cấp;
3. dữ liệu cấu trúc được trích từ nguồn đó;
4. tài liệu tổng hợp/snapshot;
5. suy luận — chỉ dùng để giải thích, không dùng làm căn cứ pháp lý.

### Bước 6 — Trả kết quả

Luôn có tối thiểu:
- kết luận ngắn;
- tên chuẩn;
- mốc thời gian;
- nguồn/căn cứ;
- cảnh báo nếu có.

## 6. Dữ liệu nền — 34 tỉnh/thành sau sắp xếp

### 6.1. 11 tỉnh/thành không nêu hợp nhất trong nguồn dữ liệu

- Thành phố Hà Nội
- Thành phố Huế
- Tỉnh Lai Châu
- Tỉnh Điện Biên
- Tỉnh Sơn La
- Tỉnh Lạng Sơn
- Tỉnh Quảng Ninh
- Tỉnh Thanh Hoá
- Tỉnh Nghệ An
- Tỉnh Hà Tĩnh
- Tỉnh Cao Bằng

### 6.2. 23 đơn vị hình thành sau hợp nhất

| STT | Đơn vị mới | Đơn vị hợp nhất | Trung tâm chính trị - hành chính theo nguồn |
|---|---|---|---|
| 1 | Tỉnh Tuyên Quang | Tuyên Quang + Hà Giang | tại tỉnh Tuyên Quang hiện nay |
| 2 | Tỉnh Lào Cai | Lào Cai + Yên Bái | tại tỉnh Yên Bái hiện nay |
| 3 | Tỉnh Thái Nguyên | Bắc Kạn + Thái Nguyên | tại tỉnh Thái Nguyên hiện nay |
| 4 | Tỉnh Phú Thọ | Vĩnh Phúc + Phú Thọ + Hoà Bình | tại tỉnh Phú Thọ hiện nay |
| 5 | Tỉnh Bắc Ninh | Bắc Ninh + Bắc Giang | tại tỉnh Bắc Giang hiện nay |
| 6 | Tỉnh Hưng Yên | Hưng Yên + Thái Bình | tại tỉnh Hưng Yên hiện nay |
| 7 | Thành phố Hải Phòng | Hải Dương + Hải Phòng | tại thành phố Hải Phòng hiện nay |
| 8 | Tỉnh Ninh Bình | Hà Nam + Ninh Bình + Nam Định | tại tỉnh Ninh Bình hiện nay |
| 9 | Tỉnh Quảng Trị | Quảng Bình + Quảng Trị | tại tỉnh Quảng Bình hiện nay |
| 10 | Thành phố Đà Nẵng | Quảng Nam + Đà Nẵng | tại thành phố Đà Nẵng hiện nay |
| 11 | Tỉnh Quảng Ngãi | Kon Tum + Quảng Ngãi | tại tỉnh Quảng Ngãi hiện nay |
| 12 | Tỉnh Gia Lai | Gia Lai + Bình Định | tại tỉnh Bình Định |
| 13 | Tỉnh Khánh Hoà | Ninh Thuận + Khánh Hoà | tại tỉnh Khánh Hoà hiện nay |
| 14 | Tỉnh Lâm Đồng | Lâm Đồng + Đắk Nông + Bình Thuận | tại tỉnh Lâm Đồng hiện nay |
| 15 | Tỉnh Đắk Lắk | Đắk Lắk + Phú Yên | tại tỉnh Đắk Lắk hiện nay |
| 16 | Thành phố Hồ Chí Minh | Bà Rịa - Vũng Tàu + Bình Dương + Thành phố Hồ Chí Minh | tại Thành phố Hồ Chí Minh hiện nay |
| 17 | Tỉnh Đồng Nai | Đồng Nai + Bình Phước | tại tỉnh Đồng Nai hiện nay |
| 18 | Tỉnh Tây Ninh | Tây Ninh + Long An | tại tỉnh Long An |
| 19 | Thành phố Cần Thơ | Cần Thơ + Sóc Trăng + Hậu Giang | tại thành phố Cần Thơ hiện nay |
| 20 | Tỉnh Vĩnh Long | Bến Tre + Vĩnh Long + Trà Vinh | tại tỉnh Vĩnh Long hiện nay |
| 21 | Tỉnh Đồng Tháp | Tiền Giang + Đồng Tháp | tại tỉnh Tiền Giang |
| 22 | Tỉnh Cà Mau | Bạc Liêu + Cà Mau | tại tỉnh Cà Mau hiện nay |
| 23 | Tỉnh An Giang | An Giang + Kiên Giang | tại tỉnh Kiên Giang |

### Quy tắc tra địa giới

- Nếu người dùng hỏi tên tỉnh cũ, trả tên tỉnh/thành mới tương ứng.
- Nếu câu hỏi ở mốc trước sắp xếp, không thay tên lịch sử.
- Nếu cần khẳng định hiệu lực pháp lý hiện hành của địa giới, phải đối chiếu văn bản pháp lý gốc/nguồn chính thức; bảng trên là dữ liệu tra cứu nền.
- Với Lâm Đồng mới, khi mô tả nguồn gốc có thể ghi: "Lâm Đồng, Đắk Nông, Bình Thuận (trước sắp xếp)" khi cần phân biệt lịch sử.

## 7. Dữ liệu nền — 06 Sở mới của tỉnh Lâm Đồng

Các Nghị quyết 390-395/NQ-HĐND đều được HĐND tỉnh Lâm Đồng khóa X, Kỳ họp thứ 22 thông qua ngày 18/02/2025. Các Sở tương ứng đi vào hoạt động từ ngày 01/03/2025.

| Nghị quyết | Tên cơ quan mới | Cơ sở hình thành/chức năng tiếp nhận |
|---|---|---|
| 390/NQ-HĐND | Sở Nông nghiệp và Môi trường tỉnh Lâm Đồng | Hợp nhất Sở Nông nghiệp và Phát triển nông thôn + Sở Tài nguyên và Môi trường |
| 391/NQ-HĐND | Sở Khoa học và Công nghệ tỉnh Lâm Đồng | Hợp nhất Sở Khoa học và Công nghệ + Sở Thông tin và Truyền thông |
| 392/NQ-HĐND | Sở Nội vụ tỉnh Lâm Đồng | Hợp nhất Sở Lao động - Thương binh và Xã hội + Sở Nội vụ |
| 393/NQ-HĐND | Sở Xây dựng tỉnh Lâm Đồng | Hợp nhất Sở Xây dựng + Sở Giao thông vận tải |
| 394/NQ-HĐND | Sở Tài chính tỉnh Lâm Đồng | Hợp nhất Sở Kế hoạch và Đầu tư + Sở Tài chính |
| 395/NQ-HĐND | Sở Dân tộc và Tôn giáo tỉnh Lâm Đồng | Ban Dân tộc tiếp nhận chức năng, nhiệm vụ, tổ chức bộ máy quản lý nhà nước về tôn giáo từ Sở Nội vụ |

### Quy tắc mapping bắt buộc

- `Sở Giao thông vận tải tỉnh Lâm Đồng` → `Sở Xây dựng tỉnh Lâm Đồng`.
- `Sở Xây dựng tỉnh Lâm Đồng` sau 01/03/2025 là cơ quan mới sau hợp nhất; không coi tên này là "tên cũ" chỉ vì trước đó cũng tồn tại Sở Xây dựng.
- `Sở Kế hoạch và Đầu tư tỉnh Lâm Đồng` → `Sở Tài chính tỉnh Lâm Đồng`.
- `Sở Tài nguyên và Môi trường tỉnh Lâm Đồng` → `Sở Nông nghiệp và Môi trường tỉnh Lâm Đồng`.
- `Sở Nông nghiệp và Phát triển nông thôn tỉnh Lâm Đồng` → `Sở Nông nghiệp và Môi trường tỉnh Lâm Đồng`.
- `Sở Thông tin và Truyền thông tỉnh Lâm Đồng` → `Sở Khoa học và Công nghệ tỉnh Lâm Đồng`.
- `Sở Lao động - Thương binh và Xã hội tỉnh Lâm Đồng` → `Sở Nội vụ tỉnh Lâm Đồng`.
- Chức năng quản lý nhà nước về tôn giáo từ Sở Nội vụ → Sở Dân tộc và Tôn giáo.
- `Ban Dân tộc tỉnh Lâm Đồng` → `Sở Dân tộc và Tôn giáo tỉnh Lâm Đồng`.

### Cảnh báo thời gian

Nếu văn bản có ngày từ 01/03/2025 trở đi mà vẫn dùng tên Sở cũ:
- gắn cảnh báo `legacy_entity_name`;
- đề xuất tên mới;
- ngoại lệ: câu đang mô tả lịch sử, bàn giao, hồ sơ của cơ quan cũ hoặc có "(cũ)"/"trước sắp xếp".

## 8. Dữ liệu nền — căn cứ tổ chức, hành chính

Dữ liệu nền đang có gồm:
- Nghị định số 30/2020/NĐ-CP về công tác văn thư — dùng làm căn cứ thể thức/kỹ thuật trình bày khi mô-đun soạn thảo hoặc rà soát cần.
- Nghị quyết số 60-NQ/TW ngày 12/04/2025 — dùng trong bộ dữ liệu để nhận diện bối cảnh sắp xếp tổ chức và mô hình chính quyền địa phương 2 cấp.
- Kế hoạch số 141/KH-BCĐTKNQ18 ngày 06/12/2024 — dùng trong bộ dữ liệu nền về sắp xếp tổ chức bộ máy.
- Nghị quyết 390-395/NQ-HĐND ngày 18/02/2025 của HĐND tỉnh Lâm Đồng — căn cứ trực tiếp cho 06 Sở nêu tại Mục 7.

### Quy tắc dùng căn cứ

- Không tự chèn NQ60/KH141 vào mọi văn bản chỉ vì có từ "sắp xếp".
- Chỉ trả căn cứ phù hợp với câu hỏi hoặc nhiệm vụ.
- Khi người dùng hỏi "văn bản nào đang có hiệu lực", phải xác minh nguồn pháp lý hiện hành nếu ứng dụng có khả năng tra cứu; dữ liệu nền không thay thế bước kiểm chứng hiện hành.
- Với 06 Sở Lâm Đồng, ưu tiên Nghị quyết cụ thể 390-395/NQ-HĐND thay vì chỉ viện dẫn chung "các Nghị quyết Kỳ họp thứ 22".

## 9. Dữ liệu nền — snapshot CCHC tỉnh Lâm Đồng

### 9.1. Snapshot năm 2025, chốt đến 27/11/2025

| Chỉ số | Giá trị | Mục tiêu/xếp hạng |
|---|---:|---|
| Bộ chỉ số 766 | 90,09/100 điểm | xếp 11/34 |
| Tỷ lệ hồ sơ giải quyết đúng hẹn | 97,28% | mục tiêu tối thiểu 98% |
| Tỷ lệ giải ngân kế hoạch đầu tư vốn NSNN | 32,23% | — |
| Tỷ lệ số hóa hồ sơ, kết quả giải quyết TTHC | 82% | mục tiêu tối thiểu 80% |
| Tỷ lệ khai thác, sử dụng lại thông tin, dữ liệu số hóa | 83,76% | mục tiêu tối thiểu 50% |
| Tỷ lệ hồ sơ trực tuyến toàn trình | 51,79% | mục tiêu tối thiểu 70% |
| Tỷ lệ hồ sơ thanh toán trực tuyến | 78,61% | mục tiêu tối thiểu 60% |
| Tỷ lệ xử lý văn bản, hồ sơ công việc toàn trình trên môi trường điện tử | 100% | — |

### 9.2. Kết quả năm 2024 của Lâm Đồng trước sắp xếp

| Chỉ số | Giá trị | Xếp hạng |
|---|---:|---:|
| PAR Index | 83,1/100 | 62/63 |
| SIPAS | 83,0% | 39/63 |
| PAPI | 41,02/80 | 54/63 |
| PCI | 65,08/100 | 54/63 |

### Quy tắc trả số liệu

- Luôn ghi rõ "theo snapshot đến 27/11/2025" với dữ liệu 2025.
- Luôn ghi "Lâm Đồng (trước sắp xếp)" với bộ số liệu 2024 nêu trên.
- Không gọi các số liệu trên là "mới nhất" nếu câu hỏi được đặt sau mốc dữ liệu mà chưa có nguồn cập nhật.
- Nếu có nguồn mới hơn, dùng nguồn mới hơn và giữ snapshot này để so sánh lịch sử nếu cần.

## 10. Kiểm tra đoạn văn

Khi `intent=validate_text`, rà theo thứ tự:

1. Tìm tên địa phương cũ.
2. Tìm tên Sở cũ.
3. Tìm căn cứ có số/ký hiệu/ngày không khớp dữ liệu nền.
4. Tìm câu dùng dữ liệu CCHC nhưng thiếu kỳ/mốc.
5. Xác định mốc văn bản.
6. Phân loại từng phát hiện:

- `ERROR`: chắc chắn sai theo dữ liệu và mốc thời gian.
- `WARNING`: có khả năng cũ/sai nhưng cần xác minh.
- `INFO`: tên lịch sử hợp lệ trong ngữ cảnh.
- `FRESHNESS`: cần nguồn hiện hành.

### Mẫu trả kiểm tra văn bản

```markdown
## Kết quả kiểm tra

| Mức | Vị trí | Nội dung | Đánh giá | Đề xuất |
|---|---|---|---|---|
| ERROR | ... | ... | Dùng tên Sở cũ sau 01/03/2025 | Đổi thành ... |
| FRESHNESS | ... | ... | Số liệu chỉ có snapshot 27/11/2025 | Kiểm tra nguồn mới |

## Căn cứ dữ liệu
- ...
```

## 11. Mẫu đầu ra mặc định

### 11.1. Đầu ra hội thoại

Trả ngắn gọn theo thứ tự:
1. Kết quả.
2. Mốc áp dụng.
3. Căn cứ/nguồn.
4. Cảnh báo nếu có.

Ví dụ:

```markdown
Sở Giao thông vận tải tỉnh Lâm Đồng được hợp nhất vào **Sở Xây dựng tỉnh Lâm Đồng** theo Nghị quyết số **393/NQ-HĐND ngày 18/02/2025**. Sở Xây dựng mới đi vào hoạt động từ **01/03/2025**.

Nếu văn bản của bạn có mốc từ 01/03/2025 trở đi, nên dùng tên **Sở Xây dựng tỉnh Lâm Đồng**, trừ khi đang nói về cơ quan cũ trong giai đoạn trước sắp xếp.
```

### 11.2. Đầu ra JSON cho ứng dụng

```json
{
  "status": "found",
  "intent": "lookup_entity",
  "query": "Sở Giao thông vận tải tỉnh Lâm Đồng",
  "canonical_name": "Sở Xây dựng tỉnh Lâm Đồng",
  "effective_context": {
    "resolution_date": "2025-02-18",
    "operational_from": "2025-03-01"
  },
  "sources": [
    {
      "number": "393/NQ-HĐND",
      "date": "2025-02-18",
      "issuer": "HĐND tỉnh Lâm Đồng"
    }
  ],
  "warnings": []
}
```

### 11.3. Khi cần kiểm tra độ mới

```json
{
  "status": "needs_freshness_check",
  "query": "PAR Index Lâm Đồng mới nhất",
  "available_snapshot": {
    "period": "2024",
    "value": 83.1,
    "rank": "62/63"
  },
  "reason": "Nguồn đóng gói không đủ để khẳng định số liệu mới nhất tại thời điểm truy vấn.",
  "next_action": "Tra nguồn chính thức/connector hiện hành."
}
```

## 12. Trả context cho mô-đun soạn thảo

Khi `intent=draft_context`, trả tối thiểu:

```json
{
  "canonical_entity": "...",
  "legacy_entities": ["..."],
  "legal_bases": ["..."],
  "time_context": {
    "before": "...",
    "after": "..."
  },
  "transition_fields": [
    "nhiệm vụ chuyển giao",
    "hồ sơ đang xử lý",
    "tài sản/tài chính",
    "nhân sự",
    "đơn vị tiếp nhận",
    "thời điểm bàn giao"
  ],
  "warnings": []
}
```

Không tự viết toàn văn hành chính nếu ứng dụng đang gọi Skill này chỉ để tra dữ liệu.

## 13. Quy tắc chống trả lời sai thường gặp

### Mẫu A — Tên cũ nhưng ngữ cảnh lịch sử

**Sai:** thấy "Sở Giao thông vận tải" là tự động thay mọi nơi.  
**Đúng:** kiểm tra ngày và ngữ cảnh; nếu là "Sở Giao thông vận tải tỉnh Lâm Đồng (cũ)" trong điều khoản bàn giao thì giữ nguyên.

### Mẫu B — Nhầm ngày nghị quyết với ngày hoạt động

**Sai:** "Nghị quyết có hiệu lực từ 01/03/2025".  
**Đúng theo dữ liệu nguồn:** Nghị quyết 390-395/NQ-HĐND được thông qua và có hiệu lực từ 18/02/2025; các Sở đi vào hoạt động từ 01/03/2025.

### Mẫu C — Snapshot thành dữ liệu hiện hành

**Sai:** "Hiện nay tỷ lệ hồ sơ trực tuyến toàn trình là 51,79%."  
**Đúng:** "Theo snapshot đến 27/11/2025, tỷ lệ là 51,79%."

### Mẫu D — Gộp sai chức năng tôn giáo

**Sai:** coi toàn bộ Sở Nội vụ chuyển sang Sở Dân tộc và Tôn giáo.  
**Đúng:** chỉ chức năng, nhiệm vụ và tổ chức bộ máy quản lý nhà nước về tôn giáo được tiếp nhận theo Nghị quyết 395/NQ-HĐND.

### Mẫu E — Dùng dữ liệu địa giới làm bằng chứng hiệu lực pháp lý

**Sai:** CSV ghi vậy nên khẳng định pháp lý hiện hành.  
**Đúng:** CSV là dữ liệu cấu trúc để tra nhanh; khi cần xác nhận hiệu lực phải đối chiếu văn bản pháp lý gốc/nguồn chính thức.

## 14. Tích hợp với Antigravity

Đặt file này tại:

```text
<workspace>/.agents/skills/tra-cuu-hanh-chinh-vn/SKILL.md
```

Nếu Antigravity dùng thư mục Skill khác, giữ nguyên tên file entrypoint là:

```text
SKILL.md
```

### Cách gọi đề xuất

Antigravity có thể chuyển câu người dùng thành payload:

```json
{
  "intent": "auto",
  "query": "{{user_query}}",
  "as_of": "{{document_date_or_null}}",
  "output": "json"
}
```

Skill tự phân loại `intent` và trả cấu trúc tại Mục 11.

### Khi workspace có các skill khác

Ưu tiên phối hợp:
- `tra-cuu-hanh-chinh-vn`: tra dữ liệu, chuẩn hóa thực thể, mốc thời gian;
- `ra-soat-van-ban-hanh-chinh`: rà câu chữ, logic giao nhiệm vụ, chuỗi hồ sơ;
- `tu-van-phap-luat`: kiểm tra hiệu lực, điều/khoản, thẩm quyền pháp lý;
- skill NĐ30/DOCX: thể thức và xuất file Word.

Không dùng Skill này để thay thế các mô-đun chuyên sâu nêu trên.

## 15. Checklist trước khi trả kết quả

- [ ] Đã xác định đúng thực thể?
- [ ] Đã xác định mốc thời gian?
- [ ] Đã phân biệt tên cũ/tên mới?
- [ ] Đã phân biệt ngày văn bản và ngày cơ quan hoạt động?
- [ ] Có nguồn/căn cứ cho kết luận?
- [ ] Dữ liệu chỉ số có kỳ và ngày chốt?
- [ ] Câu hỏi "hiện nay/mới nhất" có cần kiểm tra độ mới?
- [ ] Có nguy cơ nhầm dữ liệu lịch sử thành hiện hành?
- [ ] Có mâu thuẫn nguồn cần trả `conflict`?
- [ ] Đầu ra đủ để ứng dụng xử lý tiếp?

## 16. Giới hạn

- Không tự bịa văn bản, điều/khoản, chức danh, số liệu.
- Không thay thế việc kiểm tra hiệu lực pháp luật hiện hành khi người dùng hỏi tình trạng pháp lý "đang có hiệu lực".
- Không tự suy luận thẩm quyền ký phức tạp chỉ từ tên cơ quan.
- Không sửa tên lịch sử nếu ngữ cảnh cần giữ để mô tả giai đoạn trước sắp xếp.
- Không kết luận dữ liệu snapshot là "mới nhất" nếu chưa có nguồn cập nhật.
- Không tự biến dữ liệu tổng hợp thành nguồn pháp lý gốc.
- Không tự động soạn toàn bộ văn bản hành chính nếu người dùng chỉ yêu cầu tra cứu.
