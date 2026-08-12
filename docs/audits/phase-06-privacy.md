# Phase 6 Audit Report — Privacy, Search Audit Log Schema & Owner Isolation

## Overview
This report documents the versioned Search Audit Log schema, privacy protection rules, owner isolation access control, and dry-run migration tools for VBAI Legal Pro V4.

---

## 1. Versioned Search Audit Log Schema (`schemaVersion: 1`)

To prevent data duplication and protect user privacy, search audit records in Firestore (`search_logs`) conform to the following versioned schema:

```json
{
  "schemaVersion": 1,
  "userId": "firebase_uid_string",
  "pseudonymousUserKey": "sha256_hashed_uid",
  "createdAt": "2026-08-09T12:00:00.000Z",
  "expiresAt": "2026-11-07T12:00:00.000Z",
  "feature": "legal_chat",
  "mode": "cse_with_fallback",
  "status": "success",
  "model": "gemini-2.5-flash",
  "verifiedEvidenceCount": 3,
  "totalEvidenceCount": 5,
  "requestId": "req_xyz123",
  "queryRedacted": true,
  "querySnippet": "Luật 72/2025/QH15..."
}
```

### Eliminated Redundant Fields
- **Removed**: `user_email` and `userEmail` (replaced by `userId` to protect user identity PII).
- **Deduplicated**: `prompt` vs `query` (single canonical `querySnippet`).

---

## 2. Privacy & Data Minimization Rules

1. **No Token / Secret / Audio Logging**: Bearer tokens, API keys, audio streams, provider payloads, and signed GCS URLs are strictly excluded from logs.
2. **Redacted Query Policy**: PII scrubbing removes personal names, phone numbers, and addresses from legal search queries before persisting snippets.
3. **Owner Isolation**: Firestore security rules restrict `search_logs` access:
   - Users can ONLY read and delete documents where `request.auth.uid == resource.data.userId`.
   - Admin access is audited via separate `admin_audit_logs`.
4. **Data Retention & TTL**: Records set `expiresAt` (default 90-day retention) for automated Firestore TTL deletion.

---

## 3. Migration Utility (`proxy/scripts/search-logs-migration.cjs`)

- **Default Dry-Run Mode**: Running `node proxy/scripts/search-logs-migration.cjs` performs full scan, schema validation, and logging without executing writes.
- **`--apply` Mode**: Executing with explicit `--apply` flag requires confirmation and updates legacy `search_logs` records to `schemaVersion: 1`.
