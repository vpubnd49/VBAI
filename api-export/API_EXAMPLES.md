# VBAI System — API Examples (cURL)

> Generated: 2026-09-21
> All examples use placeholder tokens. Replace with actual values.

---

## Variables

```bash
BASE_URL="https://vbai.tracuu.lamdong.vn"
BOT_URL="https://vbaibot.chauphienbanso.com"
ACCESS_TOKEN="<ACCESS_TOKEN>"
SESSION_COOKIE="<SESSION_COOKIE>"
```

---

## VBAI Proxy

### Health Check

```bash
curl "{{base_url}}/health"
```

### Build Info

```bash
curl "{{base_url}}/api/build-info"
```

### Register

```bash
curl -X POST "{{base_url}}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "<PASSWORD>",
    "displayName": "Nguyen Van A"
  }'
```

### Login (Email/Password)

```bash
curl -X POST "{{base_url}}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "<PASSWORD>"
  }'
```

### Login (Google)

```bash
curl -X POST "{{base_url}}/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": "<GOOGLE_ID_TOKEN>"
  }'
```

### Get Current User

```bash
curl "{{base_url}}/api/auth/me" \
  -H "Authorization: Bearer {{access_token}}"
```

### Send Chat Message (Streaming)

```bash
curl -N "{{base_url}}/api/chat" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Luật đất đai 2024 có hiệu lực khi nào?",
    "skill": "legal-search"
  }'
```

### List Chat Sessions

```bash
curl "{{base_url}}/api/chat/sessions" \
  -H "Authorization: Bearer {{access_token}}"
```

### Create Chat Session

```bash
curl -X POST "{{base_url}}/api/chat/sessions" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Tra cứu pháp luật", "firstMessage": "Luật đất đai" }'
```

### Get Session Messages

```bash
curl "{{base_url}}/api/chat/sessions/<SESSION_ID>" \
  -H "Authorization: Bearer {{access_token}}"
```

### Append Messages to Session

```bash
curl -X PUT "{{base_url}}/api/chat/sessions/<SESSION_ID>/messages" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Điều 10 nói gì?" },
      { "role": "assistant", "content": "Điều 10 quy định về..." }
    ]
  }'
```

### Rename Session

```bash
curl -X PATCH "{{base_url}}/api/chat/sessions/<SESSION_ID>/title" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Câu hỏi về Luật Đất đai" }'
```

### Delete Session

```bash
curl -X DELETE "{{base_url}}/api/chat/sessions/<SESSION_ID>" \
  -H "Authorization: Bearer {{access_token}}"
```

### Delete All Sessions

```bash
curl -X DELETE "{{base_url}}/api/chat/sessions" \
  -H "Authorization: Bearer {{access_token}}"
```

### Web Search

```bash
curl -X POST "{{base_url}}/api/web-search" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Nghị định hướng dẫn Luật Đất đai 2024",
    "maxResults": 10
  }'
```

### Legal Agent Retrieve

```bash
curl -X POST "{{base_url}}/api/legal-agent-retrieve" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Điều kiện chuyển nhượng quyền sử dụng đất",
    "mode": "legal-search",
    "effectiveDate": "2026-09-21"
  }'
```

### Extract Web Content

```bash
curl -X POST "{{base_url}}/api/web-extract" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://vbpl.vn/document/31-2024-qh15" }'
```

### Document Metadata

```bash
curl "{{base_url}}/api/document-metadata?q=31/2024/QH15" \
  -H "Authorization: Bearer {{access_token}}"
```

### Parse Document (Upload)

```bash
curl -X POST "{{base_url}}/api/parse-doc" \
  -H "Authorization: Bearer {{access_token}}" \
  -F "file=@/path/to/document.doc"
```

### Transcribe Audio (Upload)

```bash
curl -X POST "{{base_url}}/api/transcribe" \
  -H "Authorization: Bearer {{access_token}}" \
  -F "file=@/path/to/audio.mp3"
```

### Search History

```bash
curl "{{base_url}}/api/search-history?limit=20" \
  -H "Authorization: Bearer {{access_token}}"
```

### Delete Search History Entry

```bash
curl -X DELETE "{{base_url}}/api/search-history/<ENTRY_ID>" \
  -H "Authorization: Bearer {{access_token}}"
```

### Administrative Divisions (Public)

```bash
curl "{{base_url}}/api/administrative-divisions?q=Lam+Dong"
```

### Log Action

```bash
curl -X POST "{{base_url}}/api/log-action" \
  -H "Content-Type: application/json" \
  -d '{ "action": "search", "query": "Luật Đất đai" }'
```

### System Config Summary

```bash
curl "{{base_url}}/api/system-config-summary" \
  -H "Authorization: Bearer {{access_token}}"
```

### [Admin] List Users

```bash
curl "{{base_url}}/api/admin/users" \
  -H "Authorization: Bearer {{access_token}}"
```

### [Admin] Update System Config

```bash
curl -X POST "{{base_url}}/api/admin/system-config" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "geminiModel": "gemini-3.7-flash-high",
    "maxAudioUploadMb": 200
  }'
```

### [Admin] Run Crawler

```bash
curl -X POST "{{base_url}}/api/admin/crawler/run" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{ "source": "vbpl" }'
```

### [Admin] Trigger Fine-tuning

```bash
curl -X POST "{{base_url}}/api/admin/training-datasets/trigger-tuning" \
  -H "Authorization: Bearer {{access_token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "baseModel": "gemini-2.0-flash-001",
    "epochCount": 4,
    "displayName": "vbai-legal-v1"
  }'
```

---

## VBAIBot Dashboard

### Login

```bash
curl -X POST "{{bot_url}}/api/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "password": "<PASSWORD>" }'
```

### Check Auth

```bash
curl "{{bot_url}}/api/auth/me" \
  -b cookies.txt
```

### Overview Stats

```bash
curl "{{bot_url}}/api/overview" \
  -b cookies.txt
```

### List Accounts

```bash
curl "{{bot_url}}/api/accounts" \
  -b cookies.txt
```

### Create Account

```bash
curl -X POST "{{bot_url}}/api/accounts" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{ "id": "acc-0901234567", "label": "Bot chính" }'
```

### List Threads

```bash
curl "{{bot_url}}/api/threads?accountId=acc-0901234567&limit=20" \
  -b cookies.txt
```

### Get Thread Messages

```bash
curl "{{bot_url}}/api/threads/<THREAD_ID>/messages" \
  -b cookies.txt
```

### Update Provider

```bash
curl -X PATCH "{{bot_url}}/api/provider" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://api.example.com/v1",
    "model": "gemini-3.7-flash",
    "apiKey": "<API_KEY>",
    "temperature": 0.7
  }'
```

### Add Knowledge Entry

```bash
curl -X POST "{{bot_url}}/api/knowledge" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "question": "UBND tỉnh Lâm Đồng ở đâu?",
    "answer": "Số 4, Trần Hưng Đạo, Phường 3, TP. Đà Lạt"
  }'
```

### Create Scheduled Job

```bash
curl -X POST "{{bot_url}}/api/schedule" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Nhắc nhở hàng ngày",
    "cron": "0 8 * * 1-5",
    "accountId": "acc-0901234567",
    "message": "Chúc buổi sáng tốt lành!",
    "targets": ["<THREAD_ID>"]
  }'
```

### Send Broadcast

```bash
curl -X POST "{{bot_url}}/api/broadcast/send" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-0901234567",
    "targets": ["<THREAD_ID_1>", "<THREAD_ID_2>"],
    "message": "Thông báo quan trọng từ VBAI Bot"
  }'
```

### Upload OCR Files

```bash
curl -X POST "{{bot_url}}/api/ocr/upload" \
  -b cookies.txt \
  -F "files=@/path/to/scan1.pdf" \
  -F "files=@/path/to/scan2.jpg"
```

### Get Agent Traces

```bash
curl "{{bot_url}}/api/traces?page=1&limit=20" \
  -b cookies.txt
```

### View Logs

```bash
curl "{{bot_url}}/api/logs?level=error&lines=100" \
  -b cookies.txt
```

### Submit Feedback

```bash
curl -X POST "{{bot_url}}/api/feedback" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{ "turnId": "<TURN_ID>", "rating": 5, "comment": "Rất hữu ích" }'
```

### Logout

```bash
curl -X POST "{{bot_url}}/api/auth/logout" \
  -b cookies.txt
```
