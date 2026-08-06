# Security Preflight Audit V1 — VBAI Legal Pro Foundation V1

- **Date**: 2026-08-05
- **Scope**: Credential management, SSRF defenses, Admin authentication, Rate limiting, and CORS.

---

## 1. Security Review Findings

1. **Service Account Keys & Test Tokens**:
   - `proxy/service-account.json` and `webapp/github-sa-key.json` are local dev credentials.
   - **Verification**: Ensure `.gitignore` and `.dockerignore` contain these files so production containers never include secret key files.

2. **Server-Side Request Forgery (SSRF) Defenses**:
   - `/api/web-extract` URL fetching features host allowlist enforcement (`isAllowedHost`) and blocks access to `localhost`, `127.0.0.1`, `::1`, `10.x.x.x`, `192.168.x.x`, and `172.16.x.x` ranges (`isPrivateIp`).
   - Only `http:` and `https:` protocols are permitted.

3. **Backend Administrative Authorization**:
   - Admin routes (`/api/admin/*`) strictly verify Firebase ID tokens via `verifyIdToken(req)` and check custom admin claims (`isAdmin(decoded)`). No client-side admin bypass is allowed.

4. **CORS & Input Validation**:
   - CORS origin configurable via `process.env.ALLOWED_ORIGIN`.
   - JSON payload limits capped at 10MB; audio uploads capped at configurable `MAX_AUDIO_UPLOAD_MB` (default 500MB).

5. **Error Stack Trace Leakage**:
   - Production API error responses return structured JSON with generic error messages without dumping full node exception stack traces to external callers.
