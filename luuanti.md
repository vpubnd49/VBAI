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

