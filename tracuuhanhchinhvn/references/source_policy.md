# Chính sách nguồn và độ mới

## Thứ tự ưu tiên

1. Văn bản gốc hoặc dữ liệu chính thức có mốc thời gian rõ.
2. Dữ liệu có cấu trúc được trích từ văn bản gốc.
3. Báo cáo/snapshot của cơ quan nhà nước.
4. Tài liệu hướng dẫn nội bộ hoặc bản tóm tắt của người dùng.

Không biến tài liệu tóm tắt thành căn cứ pháp lý gốc.

## Phân biệt dữ liệu tĩnh và biến động

- Tương đối tĩnh: thể thức NĐ30, mapping cơ cấu theo một nghị quyết cụ thể, dữ liệu lịch sử.
- Có thể biến động: hiệu lực văn bản, chức danh/người ký, địa giới sau các nghị quyết mới, số liệu PAR/SIPAS/PAPI/PCI/Bộ chỉ số 766.

Với dữ liệu biến động, nếu `as_of` của nguồn cũ hơn mốc người dùng hỏi và không có nguồn cập nhật, trả `needs_freshness_check`.

## Xử lý xung đột

Nếu hai nguồn cho kết quả khác nhau:
- Không tự chọn nguồn chỉ vì mới hơn tên file.
- So ngày nội dung, phạm vi áp dụng và loại nguồn.
- Trả `conflict`, nêu rõ từng nguồn và điểm khác nhau.
- Chỉ kết luận sau khi có nguồn đủ thẩm quyền.

## Quy tắc pháp lý cho ứng dụng

Skill này hỗ trợ truy xuất và chuẩn hóa dữ liệu, không tự coi snapshot đóng gói là pháp luật hiện hành vĩnh viễn. Khi ứng dụng có connector tra cứu văn bản chính thức, ưu tiên connector đó cho câu hỏi “đang có hiệu lực/hiện nay/mới nhất”.

## Dấu vết nguồn

Mỗi câu trả lời phải kèm ít nhất một `source_id`, số/ký hiệu văn bản hoặc tên file snapshot tương ứng. Không tạo số văn bản, điều khoản, ngày tháng không có trong nguồn.
