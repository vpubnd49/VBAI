# Ví dụ sử dụng

## 1. Soát nhanh một công văn

**Input:**  
“Rà soát câu cú và chính tả công văn này.”

**Output cốt lõi:**  
Chỉ nêu lỗi chắc chắn, lỗi logic lớn và câu sửa đề xuất.

## 2. Đối chiếu góp ý - tiếp thu - dự thảo

**Input:**  
“Đọc 3 file này và xem dự thảo đã tiếp thu đúng chưa.”

**Luồng:**  
- phân vai `comment`, `response_matrix`, `draft`;
- đối chiếu từng ý;
- trả bảng `ý kiến → tiếp thu → bản cuối → trạng thái`.

## 3. Mâu thuẫn báo cáo

**Input:**  
“Đoạn này vừa yêu cầu Sở Tư pháp định kỳ tổng hợp, vừa không yêu cầu đơn vị báo cáo riêng, có ổn không?”

**Kết quả:**  
Phát hiện thiếu nguồn dữ liệu; đề xuất dùng dữ liệu báo cáo hiện hành và quyền yêu cầu cập nhật bổ sung khi thiếu; cân nhắc bỏ `định kỳ` nếu chưa có kỳ báo cáo.

## 4. Số hiệu gần nhau

**Input:**  
“Dự thảo ghi 05/CTQH nhưng Công văn 879 nhắc 06/CTQH, sửa thành 06 không?”

**Kết quả:**  
Không tự sửa. Yêu cầu/đọc văn bản gốc. Có thể là hai văn bản độc lập.

## 5. Sửa file Word

**Input:**  
“Sửa dự thảo và chú thích từng chỗ sửa.”

**Output:**  
- `HOAN_THIEN.docx`
- `HOAN_THIEN_co_chu_thich.docx`
- bảng tóm tắt thay đổi nếu người dùng cần.

## 6. Kiểm tra trước trình ký

**Input:**  
“Kiểm tra lần cuối xem trình Chủ tịch ký được chưa.”

**Output:**  
`signing_readiness` + danh sách `must_fix` trước tiên; chỉ kết luận `ready` khi không còn lỗi bắt buộc.
