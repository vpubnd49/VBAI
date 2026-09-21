# VBAI System — Authentication Flow

> Generated: 2026-09-21

---

## Architecture Overview

The VBAI system uses **two independent authentication mechanisms** for its two services:

| Service | Auth Method | Session Type |
|---------|-------------|--------------|
| **VBAI Proxy** (Legal Search Web App) | Firebase Auth + Local JWT | Stateless Bearer Token |
| **VBAIBot Dashboard** (Zalo Bot Admin) | Password-based Session | Cookie-based Session |

---

## 1. VBAI Proxy — Firebase Auth + Local JWT

### Flow Diagram

```
CLIENT (Browser)
    │
    ├── [Option A] Email/Password Register
    │   POST /api/auth/register
    │   Body: { email, password, displayName }
    │   Response: { success, token, refreshToken, user }
    │
    ├── [Option B] Email/Password Login
    │   POST /api/auth/login
    │   Body: { email, password }
    │   Response: { success, token, refreshToken, user }
    │
    └── [Option C] Google OAuth Login
        POST /api/auth/google
        Body: { credential } (Google ID token)
        Response: { success, token, refreshToken, user }
            │
            ▼
    ┌───────────────┐
    │  ACCESS TOKEN  │ (JWT, short-lived)
    │  REFRESH TOKEN │ (Firebase, long-lived)
    └───────┬───────┘
            │
            ▼
    ┌───────────────────────────┐
    │  API REQUEST              │
    │  Header: Authorization:   │
    │    Bearer <ACCESS_TOKEN>  │
    └───────┬───────────────────┘
            │
            ▼
    ┌───────────────────────────┐
    │  SERVER: verifyIdToken()  │
    │  1. Try local JWT verify  │
    │  2. Fallback: Firebase    │
    │     Admin SDK verify      │
    └───────┬───────────────────┘
            │
        ┌───┴───┐
        │ Valid? │
        ├── YES ─────▶ Process request
        └── NO  ─────▶ 401 Unauthorized
                          │
                          ▼
                 TOKEN EXPIRED?
                   │
                   ▼
            CLIENT refreshes token
            via Firebase SDK
            (client-side, no API call)
                   │
                   ▼
            Retry with new token
```

### Token Structure

**Access Token (Local JWT)**:
```json
{
  "uid": "<USER_ID>",
  "user_id": "<USER_ID>",
  "email": "<EMAIL>",
  "name": "<DISPLAY_NAME>",
  "admin": false,
  "role": "user",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Firebase ID Token (Alternative)**:
- Standard Firebase JWT
- Verified via `firebase-admin` SDK
- Contains: `uid`, `email`, `name`, custom claims

### Admin Check

```javascript
function isAdmin(decodedToken) {
  const role = (decodedToken?.role || '').toLowerCase();
  const email = (decodedToken?.email || '').toLowerCase();
  return (
    decodedToken?.admin === true ||
    decodedToken?.isAdmin === true ||
    role === 'admin' ||
    ADMIN_EMAILS.includes(email)
  );
}
```

### Auth Levels

| Level | Description | Example Endpoints |
|-------|-------------|-------------------|
| **Public** | No auth required | `/api/health`, `/api/auth/login`, `/api/administrative-divisions` |
| **Bearer** | Valid token required | `/api/chat`, `/api/chat/sessions`, `/api/web-search` |
| **Bearer+Admin** | Valid token + admin role | `/api/admin/*` |
| **Secret** | Internal shared secret | `/api/telemetry/vbaibot-ingest` |
| **Optional** | Auth checked but not required | `/api/log-action` |

### Headers

```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### Error Responses

| Code | Meaning |
|------|---------|
| 401 | Token missing, invalid, or expired |
| 403 | Not admin (for admin routes) |
| 429 | Rate limited |

---

## 2. VBAIBot Dashboard — Session Cookie Auth

### Flow Diagram

```
CLIENT (Browser)
    │
    POST /api/auth/login
    Body: { password: "<PASSWORD>" }
    │
    ▼
┌─────────────────────────────┐
│  SERVER: checkPassword()    │
│  Rate limit: 5 attempts/min │
└─────────┬───────────────────┘
          │
      ┌───┴───┐
      │ Match? │
      ├── YES ──▶ Set cookie: __session=<SESSION_TOKEN>
      │          Cookie options: httpOnly, sameSite=lax
      │          maxAge: 7 days
      │          Response: { ok: true }
      │
      └── NO  ──▶ 401 { error: "Sai mật khẩu" }

    ┌────────────────────────┐
    │  SUBSEQUENT REQUESTS   │
    │  Cookie: __session=... │
    │  (or internal secret   │
    │   via X-Internal-Secret│
    │   header)              │
    └────────┬───────────────┘
             │
             ▼
    verifySessionToken(cookie)
             │
         ┌───┴───┐
         │ Valid? │
         ├── YES ──▶ Process request
         └── NO  ──▶ 401 { error: "Chưa đăng nhập" }

    LOGOUT:
    POST /api/auth/logout
    → Clear cookie
    → 200 { ok: true }

    CHANGE PASSWORD:
    POST /api/auth/password
    Body: { currentPassword, newPassword }
    → Invalidates ALL sessions
    → Issues new cookie to caller
```

### Session Token

- Generated via `createSessionToken()` using `crypto.randomBytes`
- Includes password fingerprint — changing password invalidates all sessions
- Cookie name: `__session`
- Cookie options: `httpOnly: true`, `sameSite: lax`, `maxAge: 7 days`

### Internal Authentication

For server-to-server calls (e.g., VBAI Proxy → VBAIBot):
```
X-Internal-Secret: <CREDENTIALS_ENCRYPTION_KEY>
```

### Rate Limiting

- Login attempts: 5 per IP per minute
- Failed attempts tracked per IP
- Auto-reset after 1 minute cooldown

---

## 3. Inter-Service Authentication

### VBAI Proxy → VBAIBot Telemetry

```
POST /api/telemetry/vbaibot-ingest
Header: X-Sync-Secret: <VBAIBOT_SYNC_SECRET>
```

### VBAIBot → VBAI Proxy (Internal)

```
Header: X-Internal-Secret: <CREDENTIALS_ENCRYPTION_KEY>
```

---

## 4. Security Features

| Feature | VBAI Proxy | VBAIBot |
|---------|-----------|---------|
| CORS | Restricted to allowed origins | Dashboard origin only |
| Helmet | ✅ | N/A (Hono) |
| Rate Limiting | ✅ (per endpoint) | ✅ (login only) |
| SSRF Protection | ✅ (`ssrf-guard.js`) | N/A |
| Path Traversal Guard | ✅ (`path-guard.js`) | N/A |
| File Upload Validation | ✅ (magic bytes check) | ✅ (OCR routes) |
| CSRF | N/A (API tokens) | SameSite cookie |
