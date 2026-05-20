# Tài liệu triển khai tính năng Đính kèm file (PDF, Word, Excel) vào Chatbot VBAI

## 1. Tổng quan tính năng
Nhằm mở rộng năng lực trợ lý ảo của Chatbot VBAI, chúng tôi đã triển khai tính năng đính kèm tài liệu trực tiếp vào khung Chat để cán bộ công chức có thể tra cứu, hỏi đáp và tóm tắt văn bản một cách nhanh chóng. Toàn bộ logic trích xuất văn bản được xử lý trực tiếp tại trình duyệt (client-side) để đảm bảo tốc độ tối đa và tối ưu hóa tài nguyên máy chủ.

---

## 2. Các tệp tin đã điều chỉnh

### 2.1. Thiết kế Giao diện (CSS)
**File:** [webapp/style.css](file:///e:/OneDrive/HSCV/Antigravity/VBAI/webapp/style.css)
- Thêm lớp CSS `.chat-attachment-preview-area` hiển thị thẻ xem trước tệp đính kèm với dải màu gradient sang trọng, phù hợp với phong cách Dalat Edition tối giản và tinh tế.
- Tạo phong cách và bố cục cho biểu tượng định dạng tệp (`.file-icon`), thông tin chi tiết (`.file-info`), trạng thái xử lý (`.file-status`), và nút gỡ tệp `.btn-remove` có hiệu ứng micro-animation khi tương tác.

### 2.2. Xử lý logic và Tích hợp Chatbot
**File:** [webapp/modules/chat-assistant.js](file:///e:/OneDrive/HSCV/Antigravity/VBAI/webapp/modules/chat-assistant.js)

1. **Khai báo biến trạng thái**:
   - `attachedFile`: Lưu trữ đối tượng tệp tin hiện tại đang hoạt động gồm `{ name, text, size, type }`.

2. **Xây dựng module trích xuất văn bản từ tệp tin (`processAttachedFile`)**:
   - **Tệp PDF**: Sử dụng thư viện `PDF.js` để đọc văn bản của từng trang. Đặc biệt tích hợp cơ chế **tự động chuyển sang chế độ AI OCR** (quét chữ từ hình ảnh bằng mô hình Gemini-2.5-Flash) nếu nội dung văn bản trích xuất thuần túy dưới 50 ký tự (nhận diện các tệp tài liệu dạng scan ảnh). Hỗ trợ quét tối đa 10 trang đầu để đảm bảo tốc độ phản hồi nhanh.
   - **Tệp Word (`.docx`)**: Tải động thư viện `JSZip` qua ES Module để mở cấu trúc tệp Open XML, phân tích `word/document.xml` và bóc tách cấu trúc đoạn văn, tiêu đề cũng như bảng dữ liệu dạng bảng biểu Markdown.
   - **Tệp Excel (`.xlsx`)**: Tải động thư viện `SheetJS (XLSX)` từ CDN và xuất toàn bộ các sheet thành định dạng CSV để mô hình AI dễ dàng đối chiếu và tra cứu thông tin theo hàng/cột.

3. **Thiết lập giao diện người dùng và Ràng buộc sự kiện (`renderChatUI`)**:
   - Chèn thẻ `<input type="file">` ẩn và nút đính kèm biểu tượng kẹp giấy vào `.chat-input-wrapper`.
   - Chèn phần tử `#chat-attachment-preview` để hiển thị quá trình xử lý tệp theo thời gian thực (đọc file, render trang ảnh, gọi AI OCR...).
   - Reset trạng thái `attachedFile = null` khi bắt đầu vẽ UI mới để tránh rò rỉ dữ liệu cũ.
   - Cài đặt nút gỡ đính kèm để người dùng chủ động kiểm soát tài liệu nào được gửi đi.

4. **Nâng cấp logic gửi tin nhắn (`sendMessage` & `handleSend`)**:
   - Hỗ trợ gửi tin nhắn trống khi có file đính kèm (hệ thống tự điền yêu cầu mặc định: *"Hãy tóm tắt và phân tích tài liệu đính kèm"*).
   - Khi có tệp đính kèm, định dạng hiển thị tin nhắn của người dùng trong chat feed sẽ chứa thông báo rõ ràng: `📄 [Đính kèm: <tên_file>]`.
   - Trong `sendMessage`, nếu phát hiện có `attachedFile`, hệ thống sẽ **bỏ qua bộ nhớ đệm (bypass cache), bỏ qua bước tìm kiếm web (web search) và bước yêu cầu nhập số hiệu văn bản đầy đủ**. Thay vào đó, toàn bộ nội dung văn bản trích xuất được sẽ được gói trong cặp thẻ phân định:
     ```text
     [DƯỚI ĐÂY LÀ NỘI DUNG TÀI LIỆU ĐƯỢC NGƯỜI DÙNG ĐÍNH KÈM (Tên file: ...)]
     ========================================
     <Nội dung văn bản trích xuất>
     ========================================
     ```
     Và chèn trực tiếp vào prompt của người dùng để gửi lên mô hình Gemini.

---

## 3. Quy trình Kiểm thử và Xác minh

Để kiểm tra tính ổn định của tính năng, vui lòng thực hiện các bước sau:

1. **Kiểm tra File PDF dạng Text**: Tải lên một file văn bản PDF chuẩn. Đảm bảo chatbot đọc được và trả lời chính xác các câu hỏi chi tiết.
2. **Kiểm tra File PDF dạng Scan**: Tải lên một trang văn bản dạng ảnh chụp hoặc file scan. Đảm bảo thanh trạng thái hiển thị tiến độ quét ảnh từng trang, tiến trình gọi AI OCR thành công và nhận diện chuẩn văn bản.
3. **Kiểm tra File Word (`.docx`)**: Đính kèm một hợp đồng hoặc mẫu tờ trình. Kiểm tra xem cấu trúc bảng biểu có được định dạng đúng trong prompt hay không.
4. **Kiểm tra File Excel (`.xlsx`)**: Đính kèm tệp bảng số liệu. Hỏi chatbot các câu hỏi tính toán, thống kê dữ liệu trên tệp tin đó.
5. **Kiểm tra Gỡ file**: Nhấn nút `[x]` trên thanh đính kèm và gửi tin nhắn mới để đảm bảo hệ thống không còn giữ ngữ cảnh tệp cũ.
