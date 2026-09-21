# VBAI System — API Reference

> Generated: 2026-09-21
> Base URLs:
> - VBAI Proxy: `https://vbai.tracuu.lamdong.vn`
> - VBAIBot: `https://vbaibot.chauphienbanso.com`

---

## VBAI Proxy API

---

### GET /health

**Purpose**: Health check (root level)

**Authentication**: None

**Response**:
```json
{ "status": "ok" }
```

---

### GET /api/build-info

**Purpose**: Get build/deployment information

**Authentication**: None

**Response**:
```json
{
  "product": "VBAI Legal Pro V2",
  "service": "vbai",
  "environment": "production",
  "gitSha": "<COMMIT_SHA>",
  "shortSha": "<SHORT_SHA>",
  "builtAt": "2026-09-21T04:21:27.464Z"
}
```

---

### POST /api/auth/register

**Purpose**: Register new account with email/password

**Authentication**: None

**Headers**: `Content-Type: application/json`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "<PASSWORD>",
  "displayName": "Nguyen Van A"
}
```

**Response** `200`:
```json
{
  "success": true,
  "token": "<ACCESS_TOKEN>",
  "refreshToken": "<REFRESH_TOKEN>",
  "user": {
    "uid": "<USER_ID>",
    "email": "user@example.com",
    "displayName": "Nguyen Van A",
    "role": "user"
  }
}
```

**Errors**:
| Code | Message |
|------|---------|
| 400 | Email already exists / Invalid email format / Weak password |

**Used By**: Login page (webapp)

---

### POST /api/auth/login

**Purpose**: Login with email/password

**Authentication**: None

**Request**:
```json
{
  "email": "user@example.com",
  "password": "<PASSWORD>"
}
```

**Response** `200`:
```json
{
  "success": true,
  "token": "<ACCESS_TOKEN>",
  "refreshToken": "<REFRESH_TOKEN>",
  "user": { "uid": "...", "email": "...", "displayName": "...", "role": "user" }
}
```

**Errors**: `401` — Invalid credentials

**Used By**: Login page

---

### POST /api/auth/google

**Purpose**: Login with Google OAuth credential

**Authentication**: None

**Request**:
```json
{
  "credential": "<GOOGLE_ID_TOKEN>"
}
```

**Response**: Same as `/api/auth/login`

**Used By**: Google Sign-In button

---

### GET /api/auth/me

**Purpose**: Get current authenticated user profile

**Authentication**: Bearer token

**Headers**: `Authorization: Bearer <ACCESS_TOKEN>`

**Response** `200`:
```json
{
  "success": true,
  "user": {
    "uid": "<USER_ID>",
    "email": "user@example.com",
    "displayName": "Nguyen Van A",
    "role": "user",
    "createdAt": "2026-09-01T00:00:00Z"
  }
}
```

**Errors**: `401` — Invalid or expired token

**Used By**: App initialization, navigation header

---

### POST /api/chat

**Purpose**: Send chat message and receive AI response (streaming SSE)

**Authentication**: Bearer token

**Headers**:
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

**Request**:
```json
{
  "message": "Luật đất đai 2024 có hiệu lực khi nào?",
  "sessionId": "<SESSION_ID>",
  "skill": "legal-search",
  "model": "gemini-3.7-flash-high",
  "attachments": [
    {
      "name": "file.pdf",
      "content": "<BASE64_CONTENT>",
      "mimeType": "application/pdf"
    }
  ]
}
```

**Response**: Server-Sent Events (SSE stream)
```
event: token
data: {"text":"Luật Đất đai năm 2024"}

event: token
data: {"text":" (số 31/2024/QH15)"}

event: done
data: {"fullText":"...complete response...","citations":[...]}
```

**Errors**: `401`, `429` (rate limited), `500`

**Used By**: Chat assistant page, Legal search page

**Notes**: Response is streamed via SSE. Client must handle `text/event-stream`.

---

### GET /api/chat/sessions

**Purpose**: List user's chat sessions (max 50, newest first)

**Authentication**: Bearer token

**Response**:
```json
{
  "sessions": [
    {
      "_id": "<SESSION_ID>",
      "userId": "<USER_ID>",
      "title": "Tra cứu Luật Đất đai",
      "createdAt": "2026-09-21T01:00:00Z",
      "updatedAt": "2026-09-21T02:00:00Z"
    }
  ]
}
```

---

### POST /api/chat/sessions

**Purpose**: Create new chat session

**Request**:
```json
{
  "title": "Hội thoại mới",
  "firstMessage": "Luật đất đai 2024"
}
```

**Response**:
```json
{
  "sessionId": "<SESSION_ID>",
  "title": "Tra cứu Luật Đất đai",
  "messages": [],
  "createdAt": "2026-09-21T01:00:00Z"
}
```

---

### GET /api/chat/sessions/:id

**Purpose**: Get session with all messages

**Path Params**: `id` — MongoDB ObjectId

**Response**:
```json
{
  "session": {
    "_id": "<SESSION_ID>",
    "title": "...",
    "messages": [
      { "role": "user", "content": "...", "timestamp": "..." },
      { "role": "assistant", "content": "...", "timestamp": "..." }
    ]
  }
}
```

---

### PUT /api/chat/sessions/:id/messages

**Purpose**: Append messages to session

**Request**:
```json
{
  "messages": [
    { "role": "user", "content": "Câu hỏi tiếp theo" },
    { "role": "assistant", "content": "Trả lời AI" }
  ]
}
```

**Response**: `{ "ok": true, "added": 2 }`

---

### PATCH /api/chat/sessions/:id/title

**Purpose**: Rename session

**Request**: `{ "title": "Tên mới" }`

**Response**: `{ "ok": true }`

---

### DELETE /api/chat/sessions/:id

**Purpose**: Delete one session

**Response**: `{ "ok": true }`

---

### DELETE /api/chat/sessions

**Purpose**: Delete ALL sessions for current user

**Response**: `{ "ok": true, "deleted": 5 }`

---

### POST /api/web-search

**Purpose**: Search legal documents from multiple sources

**Authentication**: Bearer token

**Request**:
```json
{
  "query": "Nghị định hướng dẫn Luật Đất đai 2024",
  "sources": ["vbpl", "thuvienphapluat", "chinhphu"],
  "maxResults": 10
}
```

**Response**:
```json
{
  "results": [
    {
      "title": "Nghị định 101/2024/NĐ-CP",
      "snippet": "Quy định chi tiết...",
      "url": "https://vbpl.vn/...",
      "source": "vbpl",
      "documentNumber": "101/2024/NĐ-CP"
    }
  ]
}
```

---

### POST /api/legal-agent-retrieve

**Purpose**: AI-powered legal document retrieval with analysis

**Request**:
```json
{
  "query": "Điều kiện chuyển nhượng quyền sử dụng đất",
  "mode": "legal-search",
  "effectiveDate": "2026-09-21"
}
```

---

### POST /api/web-extract

**Purpose**: Extract text content from a given URL

**Request**: `{ "url": "https://example.com/document.html" }`

**Response**: `{ "content": "...", "title": "..." }`

---

### GET /api/document-metadata

**Purpose**: Get metadata for a specific legal document

**Query Params**: `q` — document number (e.g. `31/2024/QH15`)

**Response**: See DocumentMetadata model

---

### POST /api/parse-doc

**Purpose**: Parse uploaded .doc/.docx file and extract text

**Content-Type**: `multipart/form-data`

**Form Fields**: `file` — the document file

**Response**:
```json
{
  "ok": true,
  "method": "antiword",
  "text": "Extracted document text...",
  "charCount": 12345,
  "fileName": "document.doc"
}
```

**Errors**: `400` (no file), `422` (unreadable file)

---

### POST /api/transcribe

**Purpose**: Transcribe audio file to text

**Content-Type**: `multipart/form-data`

**Form Fields**: `file` — audio file (max 200MB)

**Response**: `{ "ok": true, "text": "...", "language": "vi", "duration": 120 }`

---

### GET /api/search-history

**Purpose**: List search history (paginated)

**Query Params**: `cursor` (optional), `limit` (default 20)

**Response**:
```json
{
  "items": [{ "_id": "...", "query": "...", "mode": "...", "timestamp": "..." }],
  "nextCursor": "<CURSOR>"
}
```

---

### POST /api/log-action

**Purpose**: Log user actions and search queries

**Authentication**: Optional (works without auth)

**Request**:
```json
{
  "action": "search",
  "query": "Luật Đất đai",
  "mode": "legal-search",
  "metadata": {}
}
```

---

### GET /api/admin/users

**Purpose**: List all registered users

**Authentication**: Bearer + Admin

**Response**:
```json
{
  "users": [
    { "uid": "...", "email": "...", "displayName": "...", "role": "...", "lastLogin": "..." }
  ]
}
```

---

### POST /api/admin/system-config

**Purpose**: Update system configuration (model, endpoint, etc.)

**Authentication**: Bearer + Admin

**Request**:
```json
{
  "geminiModel": "gemini-3.7-flash-high",
  "geminiEndpoint": "https://...",
  "geminiApiKey": "<API_KEY>",
  "maxAudioUploadMb": 200
}
```

---

### GET /api/administrative-divisions

**Purpose**: Search Vietnamese administrative divisions

**Authentication**: None (public)

**Query Params**: `q` — search query

**Response**:
```json
{
  "results": [
    { "code": "68", "name": "Lâm Đồng", "type": "tinh" }
  ]
}
```

---

## VBAIBot Dashboard API

All endpoints below use **Session Cookie** authentication unless noted.

---

### POST /api/auth/login

**Purpose**: Dashboard login

**Authentication**: None

**Request**: `{ "password": "<PASSWORD>" }`

**Response**: `{ "ok": true }` + Set-Cookie header

**Errors**: `401` (wrong password), `429` (rate limited)

---

### POST /api/auth/logout

**Response**: `{ "ok": true }` + Clear-Cookie

---

### POST /api/auth/password

**Purpose**: Change dashboard password

**Request**: `{ "currentPassword": "<PASSWORD>", "newPassword": "<PASSWORD>" }`

**Response**: `{ "ok": true }` + New session cookie

**Notes**: Invalidates all existing sessions

---

### GET /api/overview

**Purpose**: Dashboard overview statistics

**Response**: See OverviewStats model

---

### GET /api/accounts

**Response**: `{ "items": [Account] }`

### POST /api/accounts

**Request**: `{ "id": "acc-name", "label": "Display Name", "agentId": "..." }`

### PATCH /api/accounts/:id

**Request**: `{ "label": "...", "agentId": "..." }`

### DELETE /api/accounts/:id

### POST /api/accounts/:id/login — Start QR login

### GET /api/accounts/:id/login/status — Poll QR status

---

### GET /api/agents

### POST /api/agents

**Request**: `{ "id": "...", "label": "...", "systemPrompt": "...", "model": "...", "tools": [...] }`

### PATCH /api/agents/:id

### DELETE /api/agents/:id

---

### GET /api/threads

**Query Params**: `accountId`, `page`, `limit`, `search`

### GET /api/threads/:threadId/messages

### PATCH /api/threads/:threadId

**Request**: `{ "labels": [...], "pinned": true }`

### DELETE /api/threads/:threadId/summary

### DELETE /api/threads/:threadId/history

---

### GET /api/provider

### PATCH /api/provider

**Request**: `{ "baseUrl": "...", "model": "...", "apiKey": "<API_KEY>", "temperature": 0.7 }`

### DELETE /api/provider — Reset to defaults

---

### GET/PATCH /api/provider/kie — KIE sub-provider

### GET/PATCH /api/provider/google — Google sub-provider

---

### GET /api/knowledge

### POST /api/knowledge

**Request**: `{ "question": "...", "answer": "..." }`

### POST /api/knowledge/:id/approve

### POST /api/knowledge/approve-all

### POST /api/knowledge/:id/reject

### DELETE /api/knowledge/:id

### GET /api/knowledge/pending-count

---

### GET /api/schedule

### POST /api/schedule

**Request**: `{ "label": "...", "cron": "0 8 * * 1-5", "accountId": "...", "message": "...", "targets": [...] }`

### PATCH /api/schedule/:id

### DELETE /api/schedule/:id

### POST /api/schedule/:id/run — Execute now

### GET /api/schedule/:id/runs — Run history

---

### GET /api/broadcast/targets

### GET /api/broadcast/templates

### POST /api/broadcast/send

**Request**: `{ "accountId": "...", "targets": [...], "message": "..." }`

### POST /api/broadcast/send-file

**Content-Type**: `multipart/form-data`

### GET /api/broadcast/history

---

### POST /api/ocr/upload — Upload files for OCR (multipart)

### POST /api/ocr/run — Process OCR

### DELETE /api/ocr/:sessionId

---

### POST /api/feedback

**Request**: `{ "turnId": "...", "rating": 5, "comment": "..." }`

### GET /api/feedback/stats

### GET /api/feedback

---

### GET /api/traces

**Query Params**: `page`, `limit`, `accountId`

### GET /api/traces/turn/:turnId

### GET /api/traces/:accountId/:threadId

---

### GET /api/logs

**Query Params**: `level`, `lines`

---

### GET /api/audit

---

### GET/PATCH /api/vision

### DELETE /api/vision/sidecar

---

### GET/PATCH /api/image-gen

### DELETE /api/image-gen

---

### GET /api/tuning

### PUT /api/tuning

---

### GET /api/tools

### PATCH /api/tools/search

### PATCH /api/tools/fetch

---

### GET /api/memories

### DELETE /api/memories/:id

---

### GET /api/overrides

### POST /api/overrides

### DELETE /api/overrides/:id

---

### GET /api/contacts
