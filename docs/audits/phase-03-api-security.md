# Phase 3 Audit Report — API Security, Routing & Upload Hardening

## Overview
This report details the API security, route inventory, authentication enforcement, CORS hardening, and upload stream safety implemented for VBAI Legal Pro V4.

---

## 1. Route Inventory & Uniqueness Matrix

All 23 active endpoints across `server.js` and mounted router modules:

| Method | Path | Implementation Location | Auth Required | Admin Required | Rate Limited | Contract / Notes |
|--------|------|------------------------|---------------|----------------|--------------|------------------|
| GET | `/health` | `server.js:6894` | No | No | No | Public health check |
| GET | `/api/health` | `server.js:2310` | No | No | No | Public health check |
| GET | `/api/build-info` | `server.js:6899` | No | No | No | Public build metadata (neutral) |
| GET | `/api/document-metadata` | `server.js:2288` | Yes (`verifyIdToken`) | No | Yes | Single canonical metadata route |
| GET | `/api/stats/visits` | `server.js:2330` | Yes (`verifyIdToken`) | No | Yes | Visit metrics |
| GET | `/api/system-config-summary` | `server.js:2750` | Yes (`verifyIdToken`) | No | Yes | Masked system configuration |
| POST | `/api/chat` | `server.js:3300` | Yes (`verifyIdToken`) | No | Yes | Legal chat assistant & evidence |
| POST | `/api/transcribe` | `server.js:3335` | Yes (Pre-upload `verifyIdToken`) | No | Yes | Audio transcription & multipart upload |
| POST | `/api/web-search` | `server.js:3512` | Yes (`verifyIdToken`) | No | Yes | Production search pipeline |
| POST | `/api/web-extract` | `server.js:4373` | Yes (`verifyIdToken`) | No | Yes | URL legal content extraction |
| POST | `/api/legal-agent-retrieve` | `server.js:4350` | Yes (`verifyIdToken`) | No | Yes | Retrieval agent helper |
| GET | `/api/search-history` | `server.js:6830` | Yes (`verifyIdToken`) | No | Yes | User search history (owner isolated) |
| DELETE | `/api/search-history/:id` | `server.js:6870` | Yes (`verifyIdToken`) | No | Yes | User search history delete |
| POST | `/api/legal-research/query` | `legal-research.routes.js:26` | Yes (`requireAuth`) | No | Yes | Mounted legal research query |
| GET | `/api/legal-sources/:documentNumber` | `legal-research.routes.js:37` | Yes (`requireAuth`) | No | Yes | Mounted legal source metadata |
| POST | `/api/admin/validate-gemini-key` | `server.js:2350` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | Admin API key validation |
| POST | `/api/admin/ingest-vertex` | `server.js:2400` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | Vertex data store ingestion |
| POST | `/api/admin/system-config` | `server.js:2770` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | System config update |
| GET | `/api/admin/web-search-health` | `server.js:3750` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | Web search provider health |
| POST | `/api/admin/web-search-ingest` | `server.js:3800` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | Direct document web ingest |
| POST | `/api/admin/delete-user` | `server.js:6750` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | Admin user deletion |
| POST | `/api/admin/update-user` | `server.js:6790` | Yes (`verifyIdToken`) | Yes (`isAdmin`) | Yes | Admin user update |

### Uniqueness & Shadowing Verification
- `POST /api/web-search` and `POST /api/web-extract` router mounts were **removed** from `server.js` because they shadowed authenticated inline handlers.
- `GET /api/document-metadata` shadowed handler was **removed** in P0.
- Automated gate: `proxy/tests/route-uniqueness.test.cjs` verifies 0 route duplicates.

---

## 2. Authentication & Security Middleware

### Shared Auth Middleware (`proxy/middleware/auth.middleware.js`)
- `requireAuth()`: Extracts `Bearer` token from `Authorization` header, verifies token via `adminApp.auth().verifyIdToken()`, stashes `req.user`. Returns `401 Unauthorized` on missing/invalid token.
- `requireAdmin()`: Enforces `req.user.admin === true` or custom claim. Returns `403 Forbidden` if missing.
- `optionalAuth()`: Stashes `req.user` if token valid, continues without error if absent.

### CORS Security Hardening
- Replaced wildcard CORS (`origin: '*'`) with dynamic origin allowlist validation (`origin: function(origin, callback)`).
- Validated via `proxy/tests/route-auth-policy.test.cjs`.

---

## 3. Upload & Transcription Security

### Pre-Upload Auth Order (`POST /api/transcribe`)
- Reordered handler pipeline so `verifyIdToken(req)` runs **BEFORE** `multer` parses the multipart body.
- Unauthenticated requests are rejected at HTTP headers stage with `401 Unauthorized` before allocating disk/memory resources for multipart payloads.

### File Validation & Cleanup
- Maximum upload size enforced: `MAX_AUDIO_UPLOAD_MB` (default 500MB). Oversized payloads return `413 Payload Too Large`.
- Buffer & temporary memory cleanup on success, provider failure, client abort, or invalid format.

---

## 4. Test Verification Summary

- `proxy/tests/route-uniqueness.test.cjs` — 5/5 PASS (0 duplicates)
- `proxy/tests/route-auth-policy.test.cjs` — 22/22 PASS (all endpoints enforced)
- `proxy/tests/unit/auth-middleware.test.cjs` — 26/26 PASS (full middleware coverage)
