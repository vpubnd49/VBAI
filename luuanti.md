# Lưu Nhật ký Công việc (Luuanti) - Phiên bản Mới nhất

Tài liệu này lưu trữ lại toàn bộ các công việc quan trọng mà Trợ lý AI (Antigravity) đã thực hiện trong phiên làm việc hiện tại, nhằm mục đích backup và theo dõi tiến độ dự án VBAI.

## 1. Khắc phục lỗi Tìm kiếm Vertex AI & Cải thiện Prompt
**Files:** 
- `proxy/server.js`
- `webapp/modules/chat-assistant.js`

**Chi tiết thay đổi:**
- **Sửa lỗi `400 Bad Request`**: Đã phát hiện và sửa lỗi khi hệ thống tự động gắn bộ lọc `so_hieu` vào mọi truy vấn Vertex AI. Ràng buộc lại chỉ áp dụng filter `so_hieu` cho kho dữ liệu `vbai-legal-unstructured` (Kho PDF), giúp các kho crawl từ website hoạt động trơn tru.
- **Ép chuẩn so sánh Markdown**: Cập nhật chỉ lệnh `VBPL_PROMPT_SPEC` để khi người dùng yêu cầu "so sánh/đối chiếu", AI bắt buộc phải phản hồi bằng cấu trúc Bảng Markdown rõ ràng.
- **Cập nhật kiến thức nghiệp vụ**: Thêm dữ liệu về Luật Tổ chức chính quyền địa phương mới (xóa bỏ cấp huyện, đồng bộ tên Sở/Ban/Ngành).

---

## 2. Xây dựng công cụ Xuất bản PDF (PDF Publisher)
**Files:**
- `webapp/modules/pdf-publisher.js` (Mới)
- `webapp/index.html`
- `webapp/main.js`

**Chi tiết thay đổi:**
- Đã thiết kế và tích hợp một công cụ Client-Side hoàn chỉnh để chuyển đổi Markdown thành báo cáo pháp luật chất lượng cao.
- **UI/UX (Split View)**: Trình soạn thảo Markdown bên trái và Live HTML Preview bên phải.
- **Xử lý Cú pháp**: Sử dụng `marked.js` để parse Markdown, bóc tách metadata (Số hiệu, Hiệu lực...) và tự động bọc thẻ `div.card`, `div.action` chuẩn xác.
- **Kỹ thuật in (Iframe Print)**: Xây dựng cơ chế xuất PDF bằng cách đẩy giao diện HTML/CSS vào một `iframe` ẩn dưới nền và kích hoạt `window.print()`. Phương pháp này kế thừa được sức mạnh dàn trang của Chrome/Edge, giải quyết triệt để lỗi rớt Footer hay phân trang sai mà không cần phải dùng server Python.

---

## 3. Chuyển đổi Thương hiệu (Thanh lọc "MOL")
**Files:**
- Xóa: `webapp/public/Logo_MOL.png`, `pdfmaster/templates/Logo_MOL.png`
- Đổi tên: `webapp/modules/mol-publisher.js` -> `pdf-publisher.js`
- Đổi tên: `build_mol_pdf.py` -> `build_pdf.py`
- Sửa hàng loạt: `index.html`, `main.js`, `pdf-publisher.js`, `SKILL.md`, `README.md`, `document-template.html`

**Chi tiết thay đổi:**
- Rà soát toàn bộ dự án để loại bỏ triệt để từ khóa "MOL", "MOL Logistics Vietnam Inc." và các email liên hệ (`MLGVN.ophcm-group@molgroup.com`).
- Chuyển đổi sang thương hiệu chung: **"Hệ thống Trợ lý Hành chính"** và **"VBAI"**.
- Thay thế logo công ty bằng logo mặc định của ứng dụng (`/admin-assistant-logo.svg`).
- Chỉnh sửa Footer của file PDF xuất ra để hiển thị thông tin hỗ trợ kỹ thuật của hệ thống thay vì thông tin liên hệ dịch vụ logistics.

---

## 4. Trạng thái hiện tại & Hướng dẫn sử dụng tính năng mới
- Toàn bộ mã nguồn đã được dọn dẹp sạch sẽ, commit (`refactor(webapp): remove MOL branding entirely from source code`) và push lên nhánh `main`.
- Frontend (`npm run dev`) đang chạy ổn định.
- Tính năng **PDF Publisher** đã hoạt động trên thanh Sidebar. Bạn có thể sử dụng công cụ này để dán bản nháp Markdown do AI tạo ra và xuất ra báo cáo PDF chuẩn chỉnh gửi cho khách hàng/lãnh đạo.

---

*Cập nhật lần cuối: 2026-05-19*
