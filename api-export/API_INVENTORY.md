# VBAI System — API Inventory

> Generated: 2026-09-21
> Total APIs: **142**

---

## VBAI Proxy Backend

Base URL: `https://vbai.tracuu.lamdong.vn/api`
Framework: Express.js | Auth: Firebase ID Token (Bearer)

| # | Method | Endpoint | Feature | Auth | Source | Verified |
|---|--------|----------|---------|------|--------|----------|
| 1 | GET | `/health` | Health check | Public | server.js:3178 | ✅ Source |
| 2 | GET | `/api/health` | Health check (alt) | Public | server.js:8630 | ✅ Source |
| 3 | GET | `/api/build-info` | Build/deploy info | Public | server.js:8635 | ✅ Source |
| **Auth** |
| 4 | POST | `/api/auth/register` | Register (email/password) | Public | server.js:3042 | ✅ Source+FE |
| 5 | POST | `/api/auth/login` | Login (email/password) | Public | server.js:3054 | ✅ Source+FE |
| 6 | POST | `/api/auth/google` | Login (Google credential) | Public | server.js:3066 | ✅ Source+FE |
| 7 | GET | `/api/auth/me` | Get current user profile | Bearer | server.js:3079 | ✅ Source+FE |
| **Chat / AI** |
| 8 | POST | `/api/chat` | Send chat message (streaming) | Bearer | server.js:4610 | ✅ Source+FE |
| 9 | GET | `/api/chat/sessions` | List chat sessions | Bearer | server.js:4283 | ✅ Source+FE |
| 10 | POST | `/api/chat/sessions` | Create chat session | Bearer | server.js:4300 | ✅ Source+FE |
| 11 | GET | `/api/chat/sessions/:id` | Get session detail | Bearer | server.js:4321 | ✅ Source+FE |
| 12 | PUT | `/api/chat/sessions/:id/messages` | Append messages | Bearer | server.js:4338 | ✅ Source+FE |
| 13 | PATCH | `/api/chat/sessions/:id/title` | Update session title | Bearer | server.js:4377 | ✅ Source+FE |
| 14 | DELETE | `/api/chat/sessions/:id` | Delete session | Bearer | server.js:4395 | ✅ Source+FE |
| 15 | DELETE | `/api/chat/sessions` | Delete all sessions | Bearer | server.js:4411 | ✅ Source+FE |
| **Legal Search** |
| 16 | POST | `/api/web-search` | Web search (legal docs) | Bearer | server.js:5214 | ✅ Source+FE |
| 17 | POST | `/api/legal-agent-retrieve` | Legal AI agent retrieval | Bearer | server.js:5964 | ✅ Source+FE |
| 18 | POST | `/api/web-extract` | Extract content from URL | Bearer | server.js:6059 | ✅ Source+FE |
| 19 | GET | `/api/document-metadata` | Get document metadata by so_hieu | Bearer | server.js:2825 | ✅ Source+FE |
| 20 | GET | `/api/document-templates` | List VBHC/VB Dang templates | Bearer | server.js:3136 | ✅ Source+FE |
| 21 | GET | `/api/administrative-divisions` | Search administrative divisions | Public | server.js:3814 | ✅ Source+FE |
| **Document Processing** |
| 22 | POST | `/api/parse-doc` | Parse uploaded document (multipart) | Bearer | server.js:4428 | ✅ Source+FE |
| 23 | POST | `/api/transcribe` | Audio transcription (multipart) | Bearer | transcription.router.js:64 | ✅ Source+FE |
| **Search History** |
| 24 | GET | `/api/search-history` | List search history (paginated) | Bearer | server.js:8525 | ✅ Source+FE |
| 25 | DELETE | `/api/search-history/:id` | Delete one history entry | Bearer | server.js:8585 | ✅ Source+FE |
| 26 | DELETE | `/api/search-history` | Delete all history | Bearer | server.js:8612 | ✅ Source+FE |
| **Analytics & Logging** |
| 27 | POST | `/api/log-action` | Log user action / search | Optional | server.js:3093 | ✅ Source+FE |
| 28 | GET | `/api/stats/visits` | Visit statistics | Bearer | server.js:3183 | ✅ Source |
| 29 | POST | `/api/stats/visits/session` | Record visit session | Bearer | server.js:3199 | ✅ Source |
| **System Config** |
| 30 | GET | `/api/system-config-summary` | Get system config (admin vs user) | Bearer | server.js:3223 | ✅ Source+FE |
| **Telemetry** |
| 31 | POST | `/api/telemetry/vbaibot-ingest` | Ingest VBAIBot conversation data | Secret | server.js:3789 | ✅ Source |
| **Zalo Bot Management** |
| 32 | GET | `/api/zalobot/accounts` | List Zalo accounts | Bearer+Admin | server.js:8678 | ✅ Source+FE |
| 33 | POST | `/api/zalobot/accounts` | Create Zalo account | Bearer+Admin | server.js:8689 | ✅ Source+FE |
| 34 | POST | `/api/zalobot/accounts/:id/login` | Start QR login for account | Bearer+Admin | server.js:8700 | ✅ Source+FE |
| 35 | GET | `/api/zalobot/accounts/:id/login/status` | Get QR login status | Bearer+Admin | server.js:8711 | ✅ Source+FE |
| 36 | POST | `/api/zalobot/quick-login` | Quick login Zalo | Bearer+Admin | server.js:8725 | ✅ Source+FE |
| 37 | GET | `/api/zalobot/health` | Zalo bot health status | Bearer+Admin | server.js:8761 | ✅ Source |
| **Admin — User Management** |
| 38 | GET | `/api/admin/users` | List all users | Bearer+Admin | server.js:3158 | ✅ Source+FE |
| 39 | POST | `/api/admin/delete-user` | Delete user | Bearer+Admin | server.js:3684 | ✅ Source+FE |
| 40 | POST | `/api/admin/update-user` | Update user role/status | Bearer+Admin | server.js:3724 | ✅ Source+FE |
| **Admin — System Config** |
| 41 | POST | `/api/admin/system-config` | Update system config | Bearer+Admin | server.js:3409 | ✅ Source+FE |
| 42 | POST | `/api/admin/validate-gemini-key` | Validate Gemini API key | Bearer+Admin | server.js:3282 | ✅ Source+FE |
| **Admin — Crawler** |
| 43 | POST | `/api/admin/crawler/run` | Run legal crawler | Bearer+Admin | server.js:3572 | ✅ Source+FE |
| 44 | GET | `/api/admin/crawler/status` | Crawler status | Bearer+Admin | server.js:3587 | ✅ Source+FE |
| 45 | POST | `/api/admin/crawler/clean` | Clean crawler data | Bearer+Admin | server.js:3640 | ✅ Source+FE |
| **Admin — Document Management** |
| 46 | POST | `/api/admin/ingest-document` | Ingest single document | Bearer+Admin | server.js:3603 | ✅ Source+FE |
| 47 | DELETE | `/api/admin/document` | Delete document | Bearer+Admin | server.js:3623 | ✅ Source+FE |
| 48 | POST | `/api/admin/web-search-ingest` | Ingest web search results | Bearer+Admin | server.js:3655 | ✅ Source |
| 49 | GET | `/api/admin/web-search-health` | Web search engine health | Bearer+Admin | server.js:3542 | ✅ Source |
| **Admin — Training & Fine-tuning** |
| 50 | GET | `/api/admin/training-datasets` | List training datasets | Bearer+Admin | server.js:3826 | ✅ Source+FE |
| 51 | POST | `/api/admin/training-datasets` | Create training dataset entry | Bearer+Admin | server.js:3839 | ✅ Source+FE |
| 52 | DELETE | `/api/admin/training-datasets/:id` | Delete training entry | Bearer+Admin | server.js:3868 | ✅ Source+FE |
| 53 | GET | `/api/admin/training-datasets/export-jsonl` | Export JSONL for fine-tuning | Bearer+Admin | server.js:3884 | ✅ Source+FE |
| 54 | POST | `/api/admin/training-datasets/sync-admin-divisions` | Sync admin division data | Bearer+Admin | server.js:3955 | ✅ Source+FE |
| 55 | GET | `/api/admin/training-datasets/sync-status` | Sync job status | Bearer+Admin | server.js:3973 | ✅ Source+FE |
| 56 | POST | `/api/admin/training-datasets/sync-vbaibot-messages` | Sync VBAIBot messages | Bearer+Admin | server.js:3998 | ✅ Source+FE |
| 57 | POST | `/api/admin/training-datasets/trigger-tuning` | Start Vertex AI tuning job | Bearer+Admin | server.js:4015 | ✅ Source+FE |
| 58 | GET | `/api/admin/training-datasets/tuning-jobs` | List tuning jobs | Bearer+Admin | server.js:4146 | ✅ Source+FE |
| 59 | GET | `/api/admin/training-datasets/tuning-jobs/:jobId/status` | Tuning job status | Bearer+Admin | server.js:4163 | ✅ Source+FE |
| 60 | POST | `/api/admin/training-datasets/tuning-jobs/:jobId/cancel` | Cancel tuning job | Bearer+Admin | server.js:4224 | ✅ Source+FE |
| 61 | POST | `/api/admin/ingest-vertex` | Ingest Vertex Search data | Bearer+Admin | server.js:3351 | ✅ Source |
| **Legal Research Routes (sub-router)** |
| 62 | POST | `/api/legal-research/query` | Legal research query | Bearer | legal-research.routes.js:38 | ✅ Source |
| 63 | GET | `/api/legal-sources/:documentNumber` | Get legal source by doc number | Bearer | legal-research.routes.js:52 | ✅ Source |

---

## VBAIBot Dashboard

Base URL: `https://vbaibot.chauphienbanso.com/api`
Framework: Hono | Auth: Session Cookie (password-based login)

| # | Method | Endpoint | Feature | Auth | Source | Verified |
|---|--------|----------|---------|------|--------|----------|
| **Health & Auth** |
| 64 | GET | `/api/health` | Health check (DB + agent) | Public | dashboard-server.ts:104 | ✅ Source |
| 65 | POST | `/api/auth/login` | Dashboard login (password) | Public | dashboard-server.ts:126 | ✅ Source |
| 66 | POST | `/api/auth/logout` | Dashboard logout | Session | dashboard-server.ts:145 | ✅ Source |
| 67 | GET | `/api/auth/me` | Check auth status | Session | dashboard-server.ts:169 | ✅ Source |
| 68 | POST | `/api/auth/password` | Change password | Session | dashboard-server.ts:188 | ✅ Source |
| **Overview** |
| 69 | GET | `/api/overview` | Dashboard overview stats | Session | overview-routes.ts:62 | ✅ Source |
| **Accounts** |
| 70 | GET | `/api/accounts` | List Zalo accounts | Session | account-routes.ts:62 | ✅ Source |
| 71 | GET | `/api/accounts/reaction-icons` | List reaction icon options | Session | account-routes.ts:66 | ✅ Source |
| 72 | POST | `/api/accounts` | Create account | Session | account-routes.ts:76 | ✅ Source |
| 73 | PATCH | `/api/accounts/:id` | Update account | Session | account-routes.ts:89 | ✅ Source |
| 74 | POST | `/api/accounts/:id/login` | Start QR login | Session | account-routes.ts:118 | ✅ Source |
| 75 | GET | `/api/accounts/:id/login/status` | QR login status | Session | account-routes.ts:126 | ✅ Source |
| 76 | DELETE | `/api/accounts/:id` | Delete account | Session | account-routes.ts:128 | ✅ Source |
| **Agents** |
| 77 | GET | `/api/agents` | List AI agents | Session | agent-routes.ts:58 | ✅ Source |
| 78 | POST | `/api/agents` | Create agent | Session | agent-routes.ts:63 | ✅ Source |
| 79 | PATCH | `/api/agents/:id` | Update agent config | Session | agent-routes.ts:73 | ✅ Source |
| 80 | DELETE | `/api/agents/:id` | Delete agent | Session | agent-routes.ts:94 | ✅ Source |
| **Threads** |
| 81 | GET | `/api/threads` | List conversation threads | Session | thread-routes.ts:17 | ✅ Source |
| 82 | GET | `/api/threads/:threadId/messages` | Get thread messages | Session | thread-routes.ts:38 | ✅ Source |
| 83 | PATCH | `/api/threads/:threadId` | Update thread (labels/flags) | Session | thread-routes.ts:50 | ✅ Source |
| 84 | DELETE | `/api/threads/:threadId/summary` | Delete thread summary | Session | thread-routes.ts:72 | ✅ Source |
| 85 | DELETE | `/api/threads/:threadId/history` | Wipe thread history | Session | thread-routes.ts:91 | ✅ Source |
| **Contacts** |
| 86 | GET | `/api/contacts` | List Zalo contacts | Session | contact-routes.ts:5 | ✅ Source |
| **Provider (LLM)** |
| 87 | GET | `/api/provider` | Get LLM provider settings | Session | provider-routes.ts:78 | ✅ Source |
| 88 | PATCH | `/api/provider` | Update LLM provider settings | Session | provider-routes.ts:91 | ✅ Source |
| 89 | DELETE | `/api/provider` | Reset LLM provider | Session | provider-routes.ts:117 | ✅ Source |
| 90 | GET | `/api/provider/kie` | Get KIE settings | Session | provider-routes.ts:59 | ✅ Source |
| 91 | PATCH | `/api/provider/kie` | Update KIE settings | Session | provider-routes.ts:60 | ✅ Source |
| 92 | GET | `/api/provider/google` | Get Google settings | Session | provider-routes.ts:68 | ✅ Source |
| 93 | PATCH | `/api/provider/google` | Update Google settings | Session | provider-routes.ts:69 | ✅ Source |
| **Knowledge Base** |
| 94 | GET | `/api/knowledge` | List knowledge entries | Session | knowledge-routes.ts:14 | ✅ Source |
| 95 | POST | `/api/knowledge` | Add knowledge entry | Session | knowledge-routes.ts:39 | ✅ Source |
| 96 | POST | `/api/knowledge/:id/approve` | Approve knowledge | Session | knowledge-routes.ts:67 | ✅ Source |
| 97 | POST | `/api/knowledge/approve-all` | Approve all pending | Session | knowledge-routes.ts:77 | ✅ Source |
| 98 | POST | `/api/knowledge/:id/reject` | Reject knowledge | Session | knowledge-routes.ts:85 | ✅ Source |
| 99 | DELETE | `/api/knowledge/:id` | Delete knowledge | Session | knowledge-routes.ts:95 | ✅ Source |
| 100 | GET | `/api/knowledge/pending-count` | Count pending entries | Session | knowledge-routes.ts:105 | ✅ Source |
| **Memories** |
| 101 | GET | `/api/memories` | List memory entries | Session | memory-routes.ts:7 | ✅ Source |
| 102 | DELETE | `/api/memories/:id` | Delete memory entry | Session | memory-routes.ts:22 | ✅ Source |
| **Overrides** |
| 103 | GET | `/api/overrides` | List response overrides | Session | override-routes.ts:10 | ✅ Source |
| 104 | POST | `/api/overrides` | Create override | Session | override-routes.ts:29 | ✅ Source |
| 105 | DELETE | `/api/overrides/:id` | Delete override | Session | override-routes.ts:53 | ✅ Source |
| **Tools** |
| 106 | GET | `/api/tools` | List tool configurations | Session | tool-routes.ts:33 | ✅ Source |
| 107 | PATCH | `/api/tools/search` | Update search tool config | Session | tool-routes.ts:55 | ✅ Source |
| 108 | PATCH | `/api/tools/fetch` | Update fetch tool config | Session | tool-routes.ts:75 | ✅ Source |
| **Tuning** |
| 109 | GET | `/api/tuning` | Get fine-tuning status | Session | tuning-routes.ts:24 | ✅ Source |
| 110 | PUT | `/api/tuning` | Update tuning config | Session | tuning-routes.ts:32 | ✅ Source |
| **Vision** |
| 111 | GET | `/api/vision` | Get vision settings | Session | vision-routes.ts:31 | ✅ Source |
| 112 | PATCH | `/api/vision` | Update vision settings | Session | vision-routes.ts:35 | ✅ Source |
| 113 | DELETE | `/api/vision/sidecar` | Remove vision sidecar | Session | vision-routes.ts:56 | ✅ Source |
| **Image Generation** |
| 114 | GET | `/api/image-gen` | Get image gen settings | Session | image-routes.ts:23 | ✅ Source |
| 115 | PATCH | `/api/image-gen` | Update image gen settings | Session | image-routes.ts:25 | ✅ Source |
| 116 | DELETE | `/api/image-gen` | Reset image gen settings | Session | image-routes.ts:42 | ✅ Source |
| **Traces** |
| 117 | GET | `/api/traces` | List agent traces (paginated) | Session | trace-routes.ts:57 | ✅ Source |
| 118 | GET | `/api/traces/turn/:turnId` | Get single trace turn | Session | trace-routes.ts:64 | ✅ Source |
| 119 | GET | `/api/traces/:accountId/:threadId` | Get trace by account+thread | Session | trace-routes.ts:73 | ✅ Source |
| **Logs** |
| 120 | GET | `/api/logs` | Get application logs | Session | log-routes.ts:17 | ✅ Source |
| **Schedules** |
| 121 | GET | `/api/schedule` | List scheduled jobs | Session | schedule-routes.ts:61 | ✅ Source |
| 122 | POST | `/api/schedule` | Create scheduled job | Session | schedule-routes.ts:66 | ✅ Source |
| 123 | PATCH | `/api/schedule/:id` | Update scheduled job | Session | schedule-routes.ts:96 | ✅ Source |
| 124 | DELETE | `/api/schedule/:id` | Delete scheduled job | Session | schedule-routes.ts:128 | ✅ Source |
| 125 | POST | `/api/schedule/:id/run` | Run scheduled job now | Session | schedule-routes.ts:140 | ✅ Source |
| 126 | GET | `/api/schedule/:id/runs` | Get job run history | Session | schedule-routes.ts:163 | ✅ Source |
| **Broadcast** |
| 127 | GET | `/api/broadcast/targets` | List broadcast targets | Session | broadcast-routes.ts:15 | ✅ Source |
| 128 | GET | `/api/broadcast/templates` | List message templates | Session | broadcast-routes.ts:33 | ✅ Source |
| 129 | POST | `/api/broadcast/send` | Send broadcast message | Session | broadcast-routes.ts:37 | ✅ Source |
| 130 | POST | `/api/broadcast/send-file` | Send broadcast file | Session | broadcast-routes.ts:60 | ✅ Source |
| 131 | GET | `/api/broadcast/history` | Broadcast history | Session | broadcast-routes.ts:93 | ✅ Source |
| **OCR** |
| 132 | POST | `/api/ocr/upload` | Upload files for OCR | Session | ocr-routes.ts:58 | ✅ Source |
| 133 | POST | `/api/ocr/run` | Run OCR processing | Session | ocr-routes.ts:130 | ✅ Source |
| 134 | DELETE | `/api/ocr/:sessionId` | Delete OCR session | Session | ocr-routes.ts:236 | ✅ Source |
| **Feedback** |
| 135 | POST | `/api/feedback` | Submit user feedback | Session | feedback-routes.ts:14 | ✅ Source |
| 136 | GET | `/api/feedback/stats` | Feedback statistics | Session | feedback-routes.ts:38 | ✅ Source |
| 137 | GET | `/api/feedback` | List feedback entries | Session | feedback-routes.ts:44 | ✅ Source |
| **Audit** |
| 138 | GET | `/api/audit` | List audit log entries | Session | audit-routes.ts:12 | ✅ Source |
| **KIE Callback** |
| 139 | POST | `/api/kie/callback` | KIE webhook callback | Internal | kie-callback-routes.ts:12 | ✅ Source |
| 140 | GET | `/api/kie/callback` | KIE health check | Internal | kie-callback-routes.ts:26 | ✅ Source |
| **Voice** |
| 141 | GET | `/api/voice/:accountId/:filename` | Serve voice file | Public | voice-routes.ts:22 | ✅ Source |
| **OCR Portal** |
| 142 | GET | `/ocr` | OCR web portal (HTML) | Session | dashboard-server.ts:173 | ✅ Source |

---

## Summary

| Metric | Count |
|--------|-------|
| **TOTAL APIs** | **142** |
| GET | 57 |
| POST | 57 |
| PUT | 2 |
| PATCH | 13 |
| DELETE | 13 |
| **AUTHENTICATED** | 134 |
| **PUBLIC** | 8 |
| **VERIFIED (Source)** | 142 |
| **Source + Frontend Cross-verified** | 63 |
| REST | 142 |
| GraphQL | 0 |
| WebSocket | 0 |
