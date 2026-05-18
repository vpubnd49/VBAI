# Lưu công việc VBAI

## 1. Các thay đổi đã triển khai

### 1.1. Nâng cấp prompt so sánh/đối chiếu ở frontend
**File:** `webapp/modules/chat-assistant.js`

Đã cập nhật `VBPL_PROMPT_SPEC` để ép định dạng chặt hơn cho các yêu cầu:
- so sánh
- đối chiếu
- phân tích văn bản

Quy tắc đã thêm:
1. Mở bài phải khẳng định văn bản nào đang có hiệu lực, thay thế văn bản nào.
2. Phần phân tích không được viết thành đoạn văn dài; phải chia thành các mục đánh số `1, 2, 3...`.
3. Dưới mỗi mục phải dùng bullet `-` để liệt kê chi tiết.
4. Luôn kết thúc bằng `Căn cứ pháp lý:` và `Trích dẫn:`.

---

### 1.2. Tích hợp conversational memory ở frontend
**File:** `webapp/modules/chat-assistant.js`
**File:** `webapp/modules/ai-proxy.js`
**File:** `proxy/server.js`

Đã triển khai logic gửi lịch sử hội thoại gần nhất lên backend để Gemini hiểu ngữ cảnh như:
- “luật cũ”
- “nghị định đó”
- “văn bản này”

Chi tiết:
- `chat-assistant.js`
  - dùng `recentTurns`
  - fallback parse từ DOM nếu cần
  - lấy tối đa 6 turn gần nhất
- `ai-proxy.js`
  - bổ sung normalize `messages -> contents`
  - gửi đồng thời cả `messages` và `contents`
- `proxy/server.js`
  - backend `/api/chat` hỗ trợ nhận cả `messages` lẫn `contents`
  - nếu chỉ có `contents`, sẽ convert về `messages`

---

### 1.3. Tối ưu web search cho văn bản thay thế / hiệu lực / dự thảo
**File:** `proxy/server.js`

Đã thêm `xaydungchinhsach.chinhphu.vn` vào:
- `OFFICIAL_SOURCE_HOSTS`
- `officialDomainClause`

Đã xác nhận query time-sensitive đã có logic mở rộng kiểu:
- `("thay thế" OR "hiệu lực" OR "dự thảo") "${docNumber}" site:xaydungchinhsach.chinhphu.vn OR site:vbpl.vn`

Áp dụng khi truy vấn có dạng:
- còn hiệu lực không
- thay thế bởi gì
- dự thảo nào liên quan

---

### 1.4. Tích hợp deep fetching vào backend
**File:** `proxy/server.js`

Đã thêm helper:
- `fetchDeepContent(url)`

Mục tiêu:
- tải HTML của trang pháp luật
- bỏ `script`, `style`, tag HTML
- lấy text thuần
- cắt tối đa 6000 ký tự

Đã nhúng vào luồng `/api/web-search`:
- chỉ xử lý tối đa 2 kết quả đầu
- chỉ áp dụng cho nguồn:
  - `chinhphu.vn`
  - `vbpl.vn`
  - `thuvienphapluat.vn`
  - `luatvietnam.vn`
- nếu trích được text đủ dài, nối thêm vào `item.snippet` dưới nhãn:
  - `[NỘI DUNG TOÀN VĂN TRÍCH XUẤT]:`

**Vị trí chính:**
- `proxy/server.js:168` — `fetchDeepContent`
- `proxy/server.js:1841` — nhánh xử lý `items` rỗng
- `proxy/server.js:1868` — bắt đầu deep fetch cho top 2 kết quả

Lưu ý:
- trong quá trình chèn code đã có lúc đè nhầm nhánh `items rỗng`, sau đó đã khôi phục đúng.

---

## 2. Build và restart dịch vụ

### Frontend
Đã chạy:
```bash
cd webapp && npm run build
```

Kết quả:
- build thành công

### Restart dịch vụ
Đã kill tiến trình cũ và start lại:
- frontend `5173`
- backend `8080`

Trạng thái cuối cùng đã xác nhận:
- frontend đang chạy ở `5173`
- backend đang chạy ở `8080`

Backend sau restart sạch:
- PID mới đã xác nhận: `8840`

---

## 3. Kết quả test thực tế đã gặp

### 3.1. Test API `/api/web-search`
Đã thử gọi test trực tiếp bằng token file cũ nhưng bị lỗi:
- `No Bearer token provided`

Điều này có nghĩa:
- request test CLI chưa đi qua auth hợp lệ
- không dùng được để xác nhận deep fetch trong lần thử đó

---

### 3.2. Test từ UI với truy vấn
```text
trích điều 14 nghị định 168
```

Phản hồi nhận được:
- hệ thống báo chưa thể xác minh dữ liệu mới nhất từ Internet
- nguyên nhân: `He thong chua cau hinh Web Search`

Kết luận:
- deep fetch **chưa chạy trong test này**
- vì luồng `/api/web-search` bị chặn từ trước do `web_search_configured = false`

---

## 4. Cách backend xác định Web Search đã bật hay chưa

**Endpoint:** `GET /api/system-config-summary`

**File:** `proxy/server.js:681`

Backend tính:
```js
const cseConfigured = !!(data.google_search_key && data.google_search_cx);
const vertexConfigured = isVertexSearchConfigured(data);
const web_search_configured = cseConfigured || vertexConfigured;
```

Nghĩa là Web Search chỉ được coi là bật khi thỏa 1 trong 2 điều kiện:
- có cấu hình Google CSE hợp lệ
- hoặc có cấu hình Vertex AI Search hợp lệ

---

## 5. Điều kiện để Vertex AI Search được coi là configured

**File:** `proxy/server.js:3529`

`isVertexSearchConfigured(config)` gọi vào `getVertexSearchConfig(config)`.

Giá trị `configured` hiện được xác định bởi:
```js
configured: !!(projectId && servingConfig)
```

Nhưng để chạy thực tế ổn định nên có đủ:
- `vertex_project_id`
- `vertex_location`
- `vertex_data_store_id`
- `vertex_serving_config`

Các field backend admin hỗ trợ update:
- `vertex_project_id`
- `vertex_location`
- `vertex_data_store_id`
- `vertex_serving_config`
- `web_search_provider`
- `web_search_mode`

**Điểm nhận config admin:** `proxy/server.js:799`

---

## 6. Hướng dẫn cấu hình Vertex AI Search chi tiết

### 6.1. Chuẩn bị Google Cloud
Cần có:
- Google Cloud project
- billing bật

Bật API:
- Vertex AI API
- Discovery Engine API

---

### 6.2. Tạo data store trong Vertex AI Search
Đi theo đường dẫn trong Google Cloud Console:
- Vertex AI
- Agent Builder / Search and Conversation
- Create app hoặc Create data store

Nên dùng hướng:
- **Website data**

Nếu muốn index website pháp luật thì có thể dùng các nguồn như:
- `vbpl.vn`
- `vanban.chinhphu.vn`
- `xaydungchinhsach.chinhphu.vn`

---

### 6.3. Lấy các thông số cần cấu hình
Cần chuẩn bị 4 giá trị:
- `vertex_project_id`
- `vertex_location`
- `vertex_data_store_id`
- `vertex_serving_config`

Giá trị thường dùng:
- `vertex_location = global`
- `vertex_serving_config = default_search`

---

### 6.4. Kiểm tra credential backend
Backend lấy access token bằng Firebase Admin credential tại:
- `proxy/server.js:3540`

Service account dùng cho backend cần có quyền gọi Vertex/Discovery Engine.

Nên kiểm tra file/service account hiện dùng có quyền như:
- Vertex AI User
- quyền dùng Discovery Engine / Search tương ứng

---

### 6.5. Các field cần lưu vào system config
Khi update config backend/admin, nên đặt:
```json
{
  "web_search_provider": "vertex_search",
  "vertex_project_id": "<project-id>",
  "vertex_location": "global",
  "vertex_data_store_id": "<data-store-id>",
  "vertex_serving_config": "default_search",
  "web_search_mode": "cse_with_fallback"
}
```

---

### 6.6. Dấu hiệu cấu hình thành công
Khi đúng, endpoint `/api/system-config-summary` sẽ trả:
- `vertex_search_configured: true`
- `web_search_configured: true`

Khi đó frontend sẽ không còn chặn câu hỏi kiểu:
- `trích điều 14 nghị định 168`

---

### 6.7. Test sau khi bật Vertex AI Search
Nên test theo thứ tự:
1. `nghị định 168 còn hiệu lực không`
2. `trích điều 14 nghị định 168`
3. `nghị định nào thay thế nghị định 168`

Nếu deep fetch kích hoạt, backend log sẽ có dạng:
```text
[Deep Fetch] Đang trích xuất toàn văn từ: ...
```

---

### 6.8. Lỗi thường gặp

#### `vertex_search_configured` vẫn false
Nguyên nhân thường là:
- thiếu `vertex_project_id`
- thiếu `vertex_serving_config`
- config chưa được lưu đúng vào Firestore `config/system`

#### Có config nhưng search không ra
Nguyên nhân có thể là:
- service account không có quyền
- data store chưa crawl/index xong
- website bị chặn crawl
- location không khớp

#### Frontend vẫn báo chưa cấu hình Web Search
Nguyên nhân có thể là:
- user chưa đăng nhập
- `/api/system-config-summary` trả false
- cache frontend chưa refresh

---

## 7. Ghi chú thao tác local backend cũ
Nội dung trước đó trong `luu.md` có các bước chạy lại backend local với env đầy đủ, gồm:
- kill port `8080`
- set env:
  - `GOOGLE_APPLICATION_CREDENTIALS`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT`
- mint Firebase ID token
- chạy `npm --prefix proxy run dev`
- test `/api/web-search` bằng PowerShell

Các ghi chú quan trọng đã lưu từ trước:
- nếu báo `EADDRINUSE`, kill process ở port `8080` rồi chạy lại
- nếu báo `Failed to determine project ID`, env chưa set đúng terminal
- nếu token file rỗng, chạy lệnh mint không redirect để xem lỗi thật
- nếu test API báo sai `aud`, token đang thuộc sai Firebase project

---

## 8. Checklist công việc cũ từ `task.md`

Nội dung đã hoàn thành trước đó:
- implement status / replacement search queries trong `proxy/server.js`
- thêm `allowReference` vào `isKnownDocumentOfficialCandidate`
- inject query time-sensitive cho thay thế / hiệu lực
- verify replacement decrees như `168/2024` và `81/2026`
- sửa blocker `shouldRequireFullDocNumber` trong `webapp/modules/chat-assistant.js`
- chạy E2E cho query thay thế nghị định

---

## 9. Trạng thái hiện tại

Hiện tại:
- code frontend đã được nâng cấp prompt + memory
- backend đã hỗ trợ `contents`
- web search đã được tối ưu cho query hiệu lực/thay thế
- deep fetch đã được cài vào `/api/web-search`
- frontend và backend đang chạy local
- nhưng Web Search vẫn chưa usable ở runtime vì system config chưa bật đúng

---

## 10. Việc cần làm tiếp

### Nếu muốn bật Web Search bằng Vertex AI Search
Cần có 4 giá trị:
- `vertex_project_id`
- `vertex_location`
- `vertex_data_store_id`
- `vertex_serving_config`

Sau đó cập nhật vào system config admin.

### Sau khi bật xong
Test lại:
```text
trích điều 14 nghị định 168
```

và kiểm tra log backend có dòng:
```text
[Deep Fetch] Đang trích xuất toàn văn từ: ...
```
