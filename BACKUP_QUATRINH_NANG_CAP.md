# BÁO CÁO TOÀN BỘ QUÁ TRÌNH NÂNG CẤP HỆ THỐNG VBAI

Tài liệu này ghi chú lại toàn bộ các thiết kế, các đoạn mã đã được sửa đổi và các cấu hình hệ thống trong phiên làm việc vừa qua để bạn có thể dễ dàng theo dõi và triển khai tiếp tục trên máy khác hoặc môi trường mới.

## 1. Thiết kế Hệ thống "Bổ sung" (Data Ingestion cho Vertex AI Search)

### Mục tiêu
Tự động hóa quá trình xử lý tài liệu thả vào thư mục `bosung`, chuyển đổi chúng thành định dạng `JSONL` để nạp (ingest) vào Google Vertex AI Search, phục vụ cho quá trình tra cứu RAG của AI.

### Đã thực hiện
- **Tạo script tự động**: Đã tạo file `tools/ingest_bosung.js` sử dụng Node.js.
- **Tính năng của script**:
  - Quét tự động thư mục `bosung/`.
  - Phân tích metadata (tên file, ngày tạo, loại file).
  - Tự động sinh ra file `bosung_metadata.jsonl` chuẩn format của Google Cloud Vertex AI Search (`{"jsonData": ...}`).
  - Script được chạy bằng lệnh: `node tools/ingest_bosung.js`.

### Các bước tiếp theo cần làm trên môi trường Cloud (GCS & Vertex AI)
1. **Đồng bộ Cloud Storage (GCS)**: Bạn cần sử dụng `gsutil` hoặc công cụ đồng bộ (vd: rclone, Google Cloud Console) để đồng bộ nội dung thư mục `bosung/` và file `bosung_metadata.jsonl` lên một bucket, ví dụ: `gs://vbai-data/bosung/`.
2. **Cấu hình Vertex AI Search**: 
   - Truy cập Vertex AI Search & Conversation.
   - Trỏ nguồn dữ liệu (Data store) vào đường dẫn `gs://vbai-data/bosung/bosung_metadata.jsonl`.
   - Chọn chế độ **Unstructured Data** để Google tự bóc tách nội dung PDF/DOCX/AUDIO.

---

## 2. Nâng cấp Luồng xử lý Âm thanh siêu tốc (Single-Pass Audio Processing)

### Mục tiêu
Loại bỏ thời gian chờ đợi kép (đợi bóc băng toàn văn -> đợi AI đọc lại text để ra biên bản). Thay vào đó, truyền trực tiếp Prompt yêu cầu ra biên bản cùng lúc với file âm thanh (Audio) thẳng vào mô hình Gemini.

### Các file đã sửa đổi:
1. **`webapp/modules/meeting-minutes.js`**:
   - Thay đổi hàm `processAudioSuperFast`: Gửi kèm `MEETING_PROMPT` trực tiếp cho hàm `sendAudioTranscription`.
   - Xóa bỏ luồng cũ yêu cầu phải có `transcript` toàn văn rồi mới gọi `sendChatRequest`.
   
2. **`webapp/modules/ai-proxy.js`**:
   - Hàm `sendSingleAudioTranscription`: Cập nhật `FormData` để đóng gói thêm trường `prompt` nếu có.
   ```javascript
   if (options.prompt) {
       formData.append('prompt', options.prompt);
   }
   ```

3. **`proxy/server.js` (Backend API `/api/transcribe`)**:
   - Nhận diện tham số `prompt` từ body của request.
   - Đẩy `prompt` vào mảng `contents` gửi tới Gemini API:
   ```javascript
   const parts = [{
     inlineData: { mimeType: detectedMimeType, data: base64Audio }
   }];
   if (prompt) {
     parts.push({ text: prompt });
   }
   // Gửi parts thẳng vào models/generateContent
   ```

---

## 3. Khắc phục lỗi Output bị cắt ngắn (Báo cáo CCHC 2026)

### Nguyên nhân
Trong code Backend Proxy API `/api/chat` có thiết lập hard-limit an toàn chặn số lượng token trả về ở mức `4096`. Khi người dùng yêu cầu soạn thảo văn bản dài như báo cáo, LLM đạt đến 4096 tokens sẽ bị ngắt giữa chừng.

### Đã thực hiện:
- **`proxy/server.js` (Dòng ~2466)**: Nâng cấp giới hạn `max_tokens` từ 4096 lên **8192** (Giới hạn hỗ trợ tối đa của các mô hình Gemini Flash/Pro hiện tại).
  ```javascript
  // Code đã sửa
  max_tokens: max_tokens ? Math.min(Number(max_tokens), 8192) : 8192
  ```

---

## 4. Quá trình Deploy (Triển khai lên Google Cloud Run)

Toàn bộ các bản cập nhật đã được Commit và Push lên nhánh `main` của Repository Git (`vpubnd49/VBAI`).

### Các lệnh Deploy thủ công đã dùng:
Nếu bạn sang máy mới mà GitHub Actions không tự động chạy, bạn có thể triển khai thủ công bằng Google Cloud CLI (`gcloud`) theo các lệnh sau (Đảm bảo đã login gcloud bằng `gcloud auth login`):

**Deploy Backend Proxy (vbai-proxy):**
```bash
gcloud run deploy vbai-proxy \
  --quiet \
  --project gen-lang-client-0462350485 \
  --source ./proxy \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --max-instances 3
```

**Deploy Frontend Webapp (vbai):**
```bash
gcloud run deploy vbai \
  --quiet \
  --project gen-lang-client-0462350485 \
  --source ./webapp \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --max-instances 3 \
  --set-env-vars API_BASE_URL=https://vbai-proxy-419728335518.asia-southeast1.run.app
```

---

*Lưu ý: Mọi cấu hình môi trường (.env) ở local hãy nhớ copy thủ công sang máy mới vì chúng không được lưu trên Git.*
