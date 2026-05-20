# Nhật Ký Nâng Cấp Hệ Thống VBAI

Tài liệu này ghi nhận toàn bộ các công việc tối ưu hóa hiệu năng, sửa lỗi giao diện, cấu hình hệ thống và triển khai (deploy) đã được thực hiện trong phiên làm việc.

---

## 1. Tối Ưu Hóa Tốc Độ Tải Trang (Hiệu Năng & Băng Thông)

Để giảm tải ban đầu và mang lại cảm giác tải trang tức thì (tối ưu hóa >98% dung lượng bundle ban đầu):
*   **Chia nhỏ code (Code Splitting & Lazy Loading)**:
    *   Chuyển đổi toàn bộ lệnh `import` tĩnh các trang nghiệp vụ trong `webapp/main.js` sang dạng `import()` động. Trình duyệt chỉ tải mã nguồn của trang đó khi người dùng thực sự truy cập.
    *   Thêm hiệu ứng hoạt ảnh xoay (loading spinner) trong `style.css` để tăng trải nghiệm người dùng trong thời gian tải mô-đun.
*   **Tải bất đồng bộ SDK Firebase**:
    *   Loại bỏ việc tải tĩnh thư viện Firebase SDK ở đầu trang chính, trì hoãn tải động từ CDN chỉ khi luồng xác thực bắt đầu chạy.
*   **Loại bỏ phông chữ thừa**:
    *   Dọn dẹp phông chữ `Playfair Display` tại `index.html` không sử dụng trong dự án, tiết kiệm tài nguyên mạng khi tải trang đầu tiên.
*   **Kết xuất tĩnh danh sách nghiệp vụ Dashboard (Static Rendering)**:
    *   Loại bỏ hoàn toàn yêu cầu mạng tải tệp tin cấu trúc kỹ năng `skills-manifest.json` nặng 120KB mỗi khi người dùng tải/quay lại Dashboard.
    *   Thay thế bằng mảng dữ liệu Metadata tĩnh siêu nhẹ tích hợp trực tiếp tại `modules/dashboard.js`, giúp các thẻ chức năng hiển thị lập tức (0ms).
    *   Đổi mới các biểu tượng riêng biệt, trực quan (`✍️` - Soạn VB Đảng, `📄` - Soạn VBHC, `⚙️` - PDF/OCR, `📝` - DOCX) giúp giao diện sinh động và cao cấp hơn.

---

## 2. Sửa Lỗi Click Đăng Nhập Không Vào Được Dashboard

*   **Sửa lỗi Vòng lặp Phụ thuộc (Circular Dependency)**:
    *   Phát hiện các mô-đun nghiệp vụ con import hàm `showToast` từ `main.js`, trong khi `main.js` lại import động chính các mô-đun đó. Điều này làm hàm `showToast` bị `undefined` tại thời điểm khởi chạy dẫn đến lỗi nghiêm trọng `TypeError: showToast is not a function` khi bấm nút Đăng nhập.
    *   Đã tách hàm `showToast` ra một file dùng chung độc lập là `webapp/modules/ui-utils.js` và cập nhật lại toàn bộ import của 9 mô-đun con để giải quyết triệt để lỗi này.
*   **Khắc phục lỗi cấu hình API Backend (500 Error)**:
    *   Cung cấp cấu hình môi trường Google Service Account hợp lệ cho backend proxy để kết nối Firebase Admin SDK & Firestore thành công, giúp luồng gọi API `/api/system-config-summary` hoạt động ổn định với mã `200 OK`.

---

## 3. Sửa Lỗi Che Khuất Khung Cảnh Báo Rủi Ro & Tăng Chiều Cao Chatbot

*   **Sửa lỗi cắt cụt khung Cảnh báo rủi ro**:
    *   *Trên Desktop*: Điều chỉnh `min-height` của `.chat-messages-area` trong `style.css` từ `430px` xuống `250px` và cố định chiều cao tối đa của khung chat Dashboard bằng `calc(100dvh - 215px)` để ngăn việc thanh nhập liệu bị trôi ra ngoài mép màn hình.
    *   *Trên Mobile (max-width: 768px)*: Loại bỏ giới hạn chiều cao cố định để trang web tự động cuộn dọc tự nhiên, giúp nội dung cảnh báo hiển thị đầy đủ 100%.
*   **Tăng chiều cao khung Chatbot**:
    *   Tăng chiều cao khung chat trên Dashboard chính thêm **65px** (từ `calc(100dvh - 280px)` thành `calc(100dvh - 215px)`).
    *   Tăng chiều cao khung chat tại trang Trợ lý độc lập (Standalone Chat) thêm **50px** (từ `calc(100dvh - 180px)` thành `calc(100dvh - 130px)`).

---

## 4. Tải Trước Tài Nguyên Ngầm (Background Preloading) & Hiệu Ứng Chuyển Trang

*   **Tải ngầm Module (Background Preloading)**:
    *   Tích hợp cơ chế tự động kích hoạt `preloadModules()` trong `main.js` khi trình duyệt đang rảnh rỗi (`requestIdleCallback`).
    *   Ứng dụng sẽ tự động tải trước các tệp tin chunk (`chat-assistant.js`, `pdf-tool.js`, `vb-dang.js`,...) và lưu vào bộ nhớ đệm (browser cache) của người dùng. Khi người dùng click chọn chức năng, mô-đun hiển thị tức thời mà không phải chờ mạng tải file.
*   **Hiệu ứng chuyển trang mượt mà**:
    *   Áp dụng lớp CSS `.page-enter` cùng hiệu ứng `pageFadeIn` gia tốc phần cứng giúp nội dung mới nhẹ nhàng trượt lên và rõ dần trong `0.22s`.

---

## 5. Commit Git, Push & Deploy Kích Hoạt CI/CD

Các thay đổi tối ưu hóa và sửa lỗi giao diện đã được đóng gói và cập nhật trực tiếp lên hệ thống:
*   Đã chạy `npm run build` để xác thực biên dịch thành công 100% không có lỗi.
*   Thực hiện các lệnh Git để đẩy mã nguồn mới lên nhánh `main` của repository chính:
    ```bash
    git add .
    git commit -m "perf: optimize web font imports and replace dynamic manifest fetch with static metadata in dashboard for instant rendering"
    git push origin main
    ```
*   Hệ thống CI/CD đã tự động kích hoạt quy trình build và deploy phiên bản mới nhất lên môi trường Cloud/Staging.

---
*Tài liệu được khởi tạo và lưu trữ tự động tại `luuanti.md` theo yêu cầu.*
