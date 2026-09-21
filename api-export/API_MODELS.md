# VBAI System — API Data Models

> Generated: 2026-09-21
> Only models visible through API responses are documented.

---

## VBAI Proxy Models

### User

```json
{
  "uid": "string — Firebase UID",
  "email": "string",
  "displayName": "string",
  "role": "string — 'user' | 'admin'",
  "createdAt": "ISO 8601 datetime",
  "lastLogin": "ISO 8601 datetime",
  "provider": "string — 'email' | 'google'"
}
```

### AuthResult

```json
{
  "success": true,
  "token": "string — JWT access token",
  "refreshToken": "string — Firebase refresh token",
  "user": "User"
}
```

### ChatSession

```json
{
  "_id": "string — MongoDB ObjectId",
  "userId": "string",
  "title": "string (max 80 chars)",
  "messages": ["ChatMessage"],
  "createdAt": "ISO 8601 datetime",
  "updatedAt": "ISO 8601 datetime"
}
```

### ChatMessage

```json
{
  "role": "string — 'user' | 'assistant'",
  "content": "string",
  "timestamp": "ISO 8601 datetime"
}
```

### ChatRequest

```json
{
  "message": "string — user's question",
  "context": "string? — additional context",
  "sessionId": "string? — MongoDB ObjectId to save messages",
  "attachments": ["{ name, content, mimeType }"],
  "model": "string? — override model name",
  "systemPrompt": "string? — override system prompt",
  "skill": "string? — 'legal-search' | 'chat-assistant' | 'spell-check' | etc."
}
```

### ChatResponse (Streaming SSE)

```
event: token
data: {"text": "partial text chunk"}

event: done
data: {"fullText": "complete response", "citations": [...]}

event: error
data: {"error": "error message"}
```

### DocumentMetadata

```json
{
  "found": true,
  "documentNumber": "string — e.g. '31/2024/QH15'",
  "title": "string — trich yeu",
  "issuer": "string — co quan ban hanh",
  "ngay_ban_hanh": "string — DD/MM/YYYY",
  "ngay_hieu_luc": "string — DD/MM/YYYY",
  "tinh_trang_hieu_luc": "string — 'Còn hiệu lực' | 'Hết hiệu lực'",
  "trich_yeu": "string",
  "tom_tat_chinh_sach": "string?",
  "tom_tat_chuong_dieu": "string?",
  "thay_the_cho": ["string"],
  "official_source_urls": ["string — URLs"],
  "metadata_verification_status": "string — 'verified' | 'unverified'",
  "recent_documents": ["RecentDocument"]
}
```

### RecentDocument

```json
{
  "documentNumber": "string",
  "title": "string",
  "issuer": "string",
  "issueDate": "string"
}
```

### WebSearchRequest

```json
{
  "query": "string",
  "sources": ["string? — 'vbpl', 'thuvienphapluat', 'chinhphu'"],
  "maxResults": "number? — default 10"
}
```

### WebSearchResult

```json
{
  "results": [{
    "title": "string",
    "snippet": "string",
    "url": "string",
    "source": "string",
    "documentNumber": "string?",
    "issuer": "string?",
    "issueDate": "string?"
  }],
  "totalResults": "number",
  "query": "string"
}
```

### LegalAgentRequest

```json
{
  "query": "string",
  "mode": "string — 'legal-search' | 'document-lookup' | 'situation-analysis' | 'compare-regulations' | 'effective-date'",
  "effectiveDate": "string? — YYYY-MM-DD",
  "attachmentContent": "string? — extracted text from attached file"
}
```

### ParseDocResponse

```json
{
  "ok": true,
  "method": "string — 'antiword' | 'catdoc'",
  "text": "string — extracted text",
  "charCount": "number",
  "fileName": "string"
}
```

### TranscribeResponse

```json
{
  "ok": true,
  "text": "string — transcribed text",
  "language": "string — detected language",
  "duration": "number — seconds"
}
```

### SearchHistoryEntry

```json
{
  "_id": "string — MongoDB ObjectId",
  "userId": "string",
  "query": "string",
  "mode": "string",
  "timestamp": "ISO 8601 datetime",
  "resultCount": "number?"
}
```

### DocumentTemplate

```json
{
  "id": "string",
  "name": "string",
  "category": "string — 'vbhc' | 'vb-dang'",
  "description": "string"
}
```

### TrainingDataset

```json
{
  "_id": "string — MongoDB ObjectId",
  "input": "string — user query",
  "output": "string — ideal response",
  "source": "string — 'manual' | 'vbaibot-sync' | 'admin-divisions'",
  "createdAt": "ISO 8601 datetime",
  "tags": ["string"]
}
```

### TuningJob

```json
{
  "vertexJobName": "string — projects/.../tuningJobs/<id>",
  "state": "string — 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'",
  "baseModel": "string",
  "displayName": "string",
  "createdAt": "ISO 8601 datetime",
  "tunedModelEndpoint": "string?"
}
```

### SystemConfigSummary

```json
{
  "geminiModel": "string",
  "geminiEndpoint": "string (masked)",
  "hasGeminiKey": true,
  "maxAudioUploadMb": "number",
  "allowedOrigins": "string",
  "mongoConnected": true,
  "firebaseProjectId": "string"
}
```

### VisitStats

```json
{
  "totalVisits": "number",
  "uniqueUsers": "number",
  "todayVisits": "number",
  "recentSessions": ["VisitSession"]
}
```

### AdministrativeDivision

```json
{
  "code": "string",
  "name": "string",
  "type": "string — 'tinh' | 'huyen' | 'xa'",
  "parentCode": "string?"
}
```

---

## VBAIBot Dashboard Models

### Account

```json
{
  "id": "string — kebab-case ID",
  "label": "string",
  "agentId": "string?",
  "status": "string — 'running' | 'stopped' | 'error'",
  "hasCredentials": true,
  "createdAt": "string?"
}
```

### Agent

```json
{
  "id": "string",
  "label": "string",
  "systemPrompt": "string",
  "model": "string?",
  "temperature": "number?",
  "maxTokens": "number?",
  "tools": ["string — tool keys"],
  "createdAt": "string?"
}
```

### Thread

```json
{
  "threadId": "string",
  "accountId": "string",
  "contactName": "string?",
  "lastMessage": "string?",
  "lastMessageAt": "ISO 8601 datetime",
  "messageCount": "number",
  "labels": ["string"],
  "pinned": false,
  "summary": "string?"
}
```

### ThreadMessage

```json
{
  "id": "string",
  "role": "string — 'user' | 'assistant'",
  "content": "string",
  "timestamp": "ISO 8601 datetime",
  "attachments": ["{ type, url }"]
}
```

### Contact

```json
{
  "id": "string — Zalo user ID",
  "name": "string",
  "avatar": "string? — URL",
  "accountId": "string"
}
```

### ProviderSettings

```json
{
  "baseUrl": "string — LLM API endpoint",
  "model": "string",
  "apiKeySet": true,
  "temperature": "number",
  "maxTokens": "number"
}
```

### KnowledgeEntry

```json
{
  "id": "string",
  "question": "string",
  "answer": "string",
  "status": "string — 'pending' | 'approved' | 'rejected'",
  "source": "string?",
  "createdAt": "ISO 8601 datetime"
}
```

### MemoryEntry

```json
{
  "id": "string",
  "key": "string",
  "value": "string",
  "accountId": "string?",
  "threadId": "string?"
}
```

### Override

```json
{
  "id": "string",
  "pattern": "string — regex or exact match",
  "response": "string",
  "priority": "number",
  "enabled": true
}
```

### ScheduledJob

```json
{
  "id": "string",
  "label": "string",
  "cron": "string — cron expression",
  "accountId": "string",
  "message": "string — message to send",
  "targets": ["string — thread/contact IDs"],
  "enabled": true,
  "lastRun": "ISO 8601 datetime?",
  "nextRun": "ISO 8601 datetime?"
}
```

### ScheduleRun

```json
{
  "runId": "string",
  "jobId": "string",
  "startedAt": "ISO 8601 datetime",
  "completedAt": "ISO 8601 datetime?",
  "status": "string — 'success' | 'failed'",
  "messagesSent": "number"
}
```

### BroadcastTarget

```json
{
  "id": "string",
  "name": "string",
  "type": "string — 'thread' | 'contact'",
  "accountId": "string"
}
```

### Trace

```json
{
  "turnId": "string",
  "accountId": "string",
  "threadId": "string",
  "userMessage": "string",
  "agentResponse": "string",
  "toolCalls": ["ToolCall"],
  "model": "string",
  "tokensUsed": "number",
  "latencyMs": "number",
  "timestamp": "ISO 8601 datetime"
}
```

### ToolCall

```json
{
  "name": "string — tool name",
  "args": "object",
  "result": "string",
  "durationMs": "number"
}
```

### Feedback

```json
{
  "id": "string",
  "turnId": "string?",
  "rating": "number — 1-5",
  "comment": "string?",
  "timestamp": "ISO 8601 datetime"
}
```

### AuditEntry

```json
{
  "id": "string",
  "action": "string",
  "actor": "string — 'dashboard' | 'system'",
  "details": "string?",
  "timestamp": "ISO 8601 datetime"
}
```

### VisionSettings

```json
{
  "enabled": true,
  "model": "string?",
  "sidecarUrl": "string?",
  "maxImageSize": "number?"
}
```

### ImageGenSettings

```json
{
  "enabled": true,
  "provider": "string?",
  "model": "string?",
  "apiKeySet": true
}
```

### TuningConfig

```json
{
  "enabled": true,
  "autoCollect": true,
  "minRating": "number",
  "maxSamples": "number"
}
```

### OcrSession

```json
{
  "sessionId": "string",
  "files": ["{ name, size, type }"],
  "status": "string — 'uploaded' | 'processing' | 'done'",
  "result": "string? — extracted text"
}
```

### OverviewStats

```json
{
  "totalThreads": "number",
  "totalMessages": "number",
  "activeAccounts": "number",
  "todayMessages": "number",
  "pendingKnowledge": "number",
  "uptime": "number — seconds"
}
```
