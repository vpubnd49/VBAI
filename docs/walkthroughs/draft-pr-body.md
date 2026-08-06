## Tổng quan

PR này nâng cấp VBAI theo hai phần chính:

1. Xây dựng VBAI Legal Pro Foundation V1.
2. Chuyển toàn bộ hệ thống sang Gemini-only và giao diện hành chính sáng.

## Thay đổi chính

### Legal Pro Foundation

- Tách pure legal domain khỏi `proxy/server.js`.
- Chuẩn hóa known-documents registry, schema và repository.
- Tách search/extract service và Express routes.
- Bổ sung provenance và local metadata.
- Tách các module legal assistant phía frontend.
- Bổ sung LegalKit manifest và integrity loader.
- Nâng cấp chính sách thuật ngữ mô hình chính quyền hai cấp.

### Gemini-only

- Xóa toàn bộ runtime 9Router.
- Chỉ sử dụng Google Gemini cho chat, OCR, audio và các chức năng AI.
- Từ chối provider và model legacy.
- Ẩn raw Gemini API key khỏi system config summary.
- Bổ sung migration script xóa field legacy trong Firestore.
- Không chạy migration `--apply` trong PR này.

### Light Administrative UI

- Chuyển từ dark blue theme sang light administrative theme.
- Nền xám xanh nhạt, card trắng và accent xanh dương.
- Xóa provider selector và thẻ cấu hình Gateway.
- Cập nhật admin, chatbot, form, card, input và các module nghiệp vụ.

## Kiểm thử

- Backend unit tests: PASS.
- Backend golden tests: PASS.
- Backend test suite: PASS; authenticated runtime smoke được skip do chưa có live Firebase token.
- Frontend policy tests: PASS.
- Frontend legal tests: PASS.
- Frontend full tests: PASS.
- Production build: PASS.
- Runtime legacy occurrences: 0.
- Bundle legacy occurrences: 0.
- Bundle secret patterns: 0.
- Firestore migration: dry-run only.

## Chưa thực hiện

- Chưa chạy Firestore migration với `--apply`.
- Chưa deploy Cloud Run hoặc frontend.
- Chưa thực hiện authenticated browser smoke test.
- Chưa merge vào `main`.

## Rủi ro và lưu ý triển khai

- Cần backup `config/system` trước khi chạy migration production.
- Cần authenticated smoke test trên staging trước khi deploy production.
- Cần kiểm tra chat, OCR, audio, admin configuration và Vertex AI Search sau deploy staging.
