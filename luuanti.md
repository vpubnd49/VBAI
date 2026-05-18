Nhanh: main

## 1) Van de nguoi dung bao cao
- Co 2 trang thai khi gui cau hoi:
  - Trang thai `Dang tra cuu...` (co icon kinh lup) thi co the ra ket qua.
  - Trang thai `Dang tra cuu du lieu moi nhat tu Internet...` thi hay bi loi, khong ra ket qua.

## 2) Nguyen nhan goc
- Nhanh `Dang tra cuu du lieu moi nhat tu Internet...` goi truc tiep `sendWebSearchRequest(...)`.
- Khi web-search timeout/loi mang/API, exception day len toan bo `sendMessage`, lam chat fail va hien loi do.
- Nhanh kia van co the chay vi di qua duong fallback khac.

## 3) Ban va da thuc hien
- Da sua file:
  - `webapp/modules/chat-assistant.js`
- Vi tri logic chinh:
  - Khoi xu ly web search freshness quanh dong ~2221.
- Cach sua:
  - Boc `sendWebSearchRequest(...)` bang `try/catch`.
  - Neu loi web-search: khong crash chat.
  - Tu dong chuyen sang che do du phong (best-effort) va van tiep tuc sinh cau tra loi.
  - Gui thong bao trang thai ro cho nguoi dung: kenh internet gian doan, dang fallback.
  - Gan metadata loi (`web_search_error`, `fallback_used`) de theo doi log.

## 4) Kiem tra sau sua
- Kiem tra syntax:
  - `node --check webapp/modules/chat-assistant.js` -> OK
- Kiem tra policy test:
  - `npm run -s test:policy` (webapp) -> Two-tier policy tests passed.

## 5) Commit va deploy
- Commit:
  - `1315f5d`
  - Message: `fix(chat): fallback gracefully when fresh internet lookup fails`
- Da push len `origin/main`.
- Workflow deploy thanh cong:
  - GitHub Actions run: `26046410377`
  - Workflow: `Deploy to Google Cloud Run`

## 6) Link Cloud Run sau deploy
- Frontend:
  - https://vbai-419728335518.asia-southeast1.run.app
- Backend proxy:
  - https://vbai-proxy-419728335518.asia-southeast1.run.app

## 7) Ghi chu bo sung
- Cac thay doi truoc do da ton tai trong `main`:
  - Best-effort search mode (khong hard reject).
  - Domain taxonomy cho Muc 3 (4 nhom linh vuc + suy luan domain + scoring/meta).
  - Compact spacing cho chat (line-height ~1.35).

## 8) Nghien cuu & Cap nhat Prompt Hieu luc Luat 2026 (Moi nhat)
- **Van de**: Nhiều luật/nghị định cũ đã hết hiệu lực hoàn toàn (ví dụ: Luật Viên chức số 58/2010/QH12 & Luật số 52/2019/QH14 đã hết hiệu lực do bị thay thế bởi Luật Viên chức mới số 129/2025/QH15 ban hành ngày 10/12/2025). Chatbot nếu lấy dữ liệu cũ có thể trả lời sai lệch nếu không rà soát hiệu lực văn bản.
- **Giai phap**: 
  - Đã thêm phần chỉ lệnh nghiêm ngặt `[QUY TẮC XỬ LÝ HIỆU LỰC & CẬP NHẬT MỚI NHẤT (CRITICAL)]` vào `VBPL_PROMPT_SPEC` trong `webapp/modules/chat-assistant.js`.
  - Ép chatbot bắt buộc rà soát lộ trình hiệu lực, khẳng định ngay lập tức trạng thái văn bản cũ đã hết hiệu lực và dẫn chiếu chính xác sang văn bản thay thế (ví dụ: Luật số 129/2025/QH15 mới nhất).
  - Tự động gắn kèm nhãn cảnh báo `[HẾT HIỆU LỰC]` hoặc `[SẮP HẾT HIỆU LỰC]` nếu bắt buộc phải so sánh với văn bản cũ.
- **Ket qua kiem tra**:
  - `node --check webapp/modules/chat-assistant.js` -> Đạt (OK)
  - `npm run -s test:policy` (webapp) -> Đạt (Two-tier policy tests passed)

## 9) Toi uu hoa Truy van Tim kiem (Query Rewrite) cho Luat Vien chuc 2026
- **Van de**: Khi người dùng tìm "Luật Viên chức", do các văn bản cũ (2010/2019) có lượng truy cập và SEO quá lớn, các công cụ tìm kiếm (Google CSE, Vertex Search) có xu hướng trả về tài liệu cũ làm kết quả hàng đầu, khiến chatbot không nhận được ngữ cảnh của Luật mới (129/2025/QH15).
- **Giai phap**:
  - Đã chỉnh sửa `normalizeLegalSearchQuery` tại `proxy/server.js` để tự động viết lại truy vấn (Query Expansion) khi phát hiện từ khóa "luật viên chức".
  - Chuyển đổi truy vấn thành: `'Luật Viên chức mới nhất 129/2025/QH15 thay thế 58/2010/QH12 52/2019/QH14'`.
  - Điều này giúp Google CSE và Vertex AI Search tìm thấy cả văn bản cũ lẫn mới nhất 2025/2026 đồng thời, cung cấp ngữ cảnh đầy đủ nhất cho AI phân tích hiệu lực.
- **Kiem tra**:
  - `node --check proxy/server.js` -> Đạt (OK)

## 10) Toi uu hoa Cache Trinh duyet & Query Rewrite cho Luat Can bo Cong chuc 2025/2026
- **Van de**:
  - Khi người dùng hỏi lại cùng một câu hỏi trong cùng một tab, trình duyệt sẽ tự động lấy câu trả lời từ `sessionStorage` (được cache thông qua `getCachedChatAnswer`) và hiển thị ngay lập tức mà không gửi request mới lên server. Điều này khiến các cập nhật Prompt hoặc Backend không được áp dụng.
  - Luật Cán bộ, công chức cũng có một văn bản mới tinh thay thế là **Luật Cán bộ, công chức số 80/2025/QH15** (ban hành ngày 24/06/2025 và có hiệu lực từ 01/07/2025, phần đánh giá có hiệu lực từ 01/01/2026).
- **Giai phap**:
  - **Bypass Cache Trinh duyet**: Cập nhật `sendMessage` tại `webapp/modules/chat-assistant.js` để tự động bypass bộ nhớ đệm trình duyệt (`shouldBypassCache = isTimeSensitive || useWebSearch;`) bất cứ khi nào tính năng "Tìm kiếm web" được kích hoạt. Điều này đảm bảo mỗi khi người dùng bật "Tìm kiếm web", chatbot luôn luôn tra cứu mới 100% từ Internet.
  - **Query Expansion cho Luat Can bo Cong chuc**: Bổ sung trường hợp viết lại truy vấn đối với từ khóa "luật cán bộ công chức" trong `normalizeLegalSearchQuery` tại `proxy/server.js`.
  - Chuyển đổi truy vấn thành: `'Luật Cán bộ công chức mới nhất 80/2025/QH15 thay thế 22/2008/QH12 52/2019/QH14'`.
- **Kiem tra**:
  - `node --check proxy/server.js` -> Đạt (OK)
  - `node --check webapp/modules/chat-assistant.js` -> Đạt (OK)
  - `npm run -s test:policy` (webapp) -> Đạt (Two-tier policy tests passed)

## 11) Cập nhật Logic Fallback cho Vertex AI Search
- **Vấn đề**:
  - Khi người dùng chọn Vertex AI Search làm công cụ tra cứu chính và sử dụng tính năng viết lại truy vấn (Query Expansion) có chứa số hiệu văn bản cũ (ví dụ: `thay thế 58/2010/QH12 52/2019/QH14`).
  - Vertex AI Search tìm thấy các văn bản cũ này và trả về kết quả (>0 items), dẫn đến logic Fallback sang Google Search bị bỏ qua. Kết quả là chatbot chỉ thấy luật cũ và khẳng định luật cũ là hiện hành.
- **Giải pháp**:
  - Chỉnh sửa `normalizeLegalSearchQuery` tại `proxy/server.js` để loại bỏ các số hiệu văn bản cũ khỏi câu truy vấn mở rộng (chỉ giữ lại số hiệu văn bản mới nhất, ví dụ: `'Luật Viên chức mới nhất 129/2025/QH15'`).
  - Khi đó, nếu Vertex AI Search chưa có văn bản mới, nó sẽ không tìm thấy kết quả nào (0 items), kích hoạt thành công logic Fallback sang Google Search để tìm kiếm văn bản mới trên Internet.
- **Kiểm tra**:
  - `node --check proxy/server.js` -> Đạt (OK)

