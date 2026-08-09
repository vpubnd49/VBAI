# VBAI Upgrade Source Lock V4 — Source Master Gate Report

## Source Identity

| Field | Value |
|-------|-------|
| **Source Master commit** | `4205db4f3b6b138479f19d7c69a9113bdfd8b79c` |
| **Source Master tree hash** | `1da556db8859e12820a867f024e2a1010223112a` |
| **Current HEAD** | `a3926f011b49af05220e171fc56c60670e3de32a` |
| **Branch** | `refactor/gemini-only-light-ui-v1` |
| **Remote HEAD** | `a3926f011b49af05220e171fc56c60670e3de32a` (matches local) |
| **Working tree** | CLEAN |
| **Repository** | `vpubnd49/VBAI` via `https://github.com/vpubnd49/VBAI.git` |
| **Audit date** | 2026-08-09T12:12 UTC+7 |

## Commit Relationship

Source Master (`4205db4`) is a **direct ancestor** of HEAD (`a3926f0`). HEAD is exactly **3 commits ahead**:

```
a3926f0 fix(data): ensure 72/2025/QH15 data present in metadata and known documents
b66706a fix(v4): resolve runner syntax, API config security, light UI & legal lineage
9782c53 fix: add 72/2025/QH15 data + implement findByPartialNumber/findByTopicInBosung
4205db4 fix(webapp): keep build metadata out of tracked public files  ← Source Master
```

## Historical Phase 40 Baseline

> **Status: UNAVAILABLE**
>
> Commit `bd69b437e50743dc815a9066734773244e7a443a` and tag `phase40-production-release-20260721` are not present in local git objects or remote. This is a **historical reference only** and is NOT a blocker for the current upgrade.

---

## Source Master Inventory (592 files)

| Group | Files |
|-------|------:|
| proxy-core | 32 |
| proxy-routes | 2 |
| proxy-tests | 29 |
| legal (proxy/legal) | 30 |
| webapp-core | 32 |
| webapp-modules | 30 |
| webapp-tests | 19 |
| skills (skill/) | 42 |
| skills-legacy (Skill_*) | 152 |
| ci-cd (.github/) | 3 |
| docs | 20 |
| scripts | 1 |
| backup | 87 |
| pdfmaster | 5 |
| legalkit | — (in other) |
| other | 108 |

Full inventory JSON: `E:\Repos\VBAI-ops\source-master-gate-output\source-master-inventory-v4.json`

---

## Three-Way Comparison: Source Master vs HEAD

### Changed Files (23 files, +1747 / -140 lines)

| Status | File | Classification |
|--------|------|---------------|
| **M** | `proxy/server.js` | intentional upgrade (maskApiKey, system-config hardening, consensus maps) |
| **M** | `proxy/bosung_metadata.json` | intentional upgrade (added 72/2025/QH15 entry) |
| **M** | `proxy/legal/data/known-documents.json` | **⚠ data discrepancy** (see P0-DATA below) |
| **M** | `proxy/legal/index.js` | intentional upgrade (added matchScore import, new service exports) |
| **M** | `proxy/legal/repositories/known-documents.repository.js` | intentional upgrade (added findByPartialNumber, findByTopicInBosung) |
| **A** | `proxy/legal/services/answer-validator.js` | intentional upgrade (new service) |
| **A** | `proxy/legal/services/legal-query-engine.js` | intentional upgrade (new service) |
| **A** | `proxy/legal/domain/legal-entity-extractor.js` | intentional upgrade (new domain module) |
| **A** | `proxy/routes/legal-research.routes.js` | intentional upgrade (new route file) |
| **A** | `proxy/tests/answer-validator.test.cjs` | intentional upgrade (new test) |
| **A** | `proxy/tests/legal-entity-extractor.test.cjs` | intentional upgrade (new test) |
| **A** | `proxy/tests/legal-query-engine.test.cjs` | intentional upgrade (new test) |
| **A** | `proxy/tests/unit/system-config-security.test.cjs` | intentional upgrade (new test) |
| **A** | `proxy/tests/verify-v3-hardening.cjs` | intentional upgrade (new test) |
| **A** | `run-all-gates-v4.cjs` | intentional upgrade (new gate runner) |
| **M** | `run-all-gates.cjs` | intentional upgrade (updated gate runner) |
| **A** | `run-pending-tests.bat` | intentional upgrade |
| **M** | `webapp/modules/admin-panel.js` | intentional upgrade (clear-key button) |
| **M** | `webapp/modules/chat-assistant.js` | intentional upgrade |
| **A** | `webapp/modules/legal/source-panel.js` | intentional upgrade (new UI module) |
| **M** | `webapp/src/style.css` | intentional upgrade (light-only enforcement) |
| **M** | `webapp/style.css` | intentional upgrade |
| **M** | `webapp/tests/legal-conversation-memory.test.mjs` | intentional upgrade (canonical title fix) |

### Unchanged Key Files (confirmed identical SHA-256)

| File | Status |
|------|--------|
| `proxy/package.json` | ✅ UNCHANGED |
| `proxy/legal/domain/document-number.js` | ✅ UNCHANGED |
| `webapp/firebase-config.js` | ✅ UNCHANGED |
| `webapp/modules/ai-proxy.js` | ✅ UNCHANGED |
| `webapp/modules/search-history.js` | ✅ UNCHANGED |
| `webapp/public/build-info.json` | ✅ UNCHANGED |
| `.github/workflows/deploy.yml` | ✅ UNCHANGED |
| `firestore.rules` | ✅ UNCHANGED |
| `README.md` | ✅ UNCHANGED |

### Modified but not in diff (ancillary)

| File | Status |
|------|--------|
| `webapp/docker-entrypoint.sh` | MODIFIED (SHA differs) |
| `webapp/nginx.conf` | MODIFIED (SHA differs) |
| `.github/workflows/pr-validation.yml` | MODIFIED (SHA differs) |

---

## Route Inventory Comparison

### Source Master (22 routes)

```
USE  /api  (middleware x2)
GET  /api/health
GET  /api/stats/visits
POST /api/stats/visits/session
GET  /api/system-config-summary
POST /api/admin/validate-gemini-key
GET  /api/document-metadata
POST /api/admin/ingest-vertex
POST /api/admin/system-config
GET  /api/admin/web-search-health
POST /api/admin/web-search-ingest
POST /api/admin/delete-user
POST /api/admin/update-user
POST /api/chat
POST /api/transcribe
POST /api/web-search
POST /api/legal-agent-retrieve
POST /api/web-extract
GET  /api/search-history
DELETE /api/search-history/:id
GET  /api/build-info
```

### Current HEAD (25 routes)

```
USE  /api  (middleware x3)           ← +1 USE added
GET  /api/document-metadata          ← DUPLICATE #1
GET  /api/health
GET  /api/stats/visits
POST /api/stats/visits/session
GET  /api/system-config-summary
POST /api/admin/validate-gemini-key
GET  /api/document-metadata          ← DUPLICATE #2 (SHADOWED)
POST /api/admin/ingest-vertex
POST /api/admin/system-config
GET  /api/admin/web-search-health
POST /api/admin/web-search-ingest
POST /api/admin/delete-user
POST /api/admin/update-user
POST /api/chat
POST /api/transcribe
POST /api/web-search
POST /api/legal-agent-retrieve
POST /api/web-extract
GET  /api/search-history
DELETE /api/search-history/:id
GET  /health                         ← NEW route
GET  /api/build-info
```

> [!CAUTION]
> **P0-ROUTE: `GET /api/document-metadata` is registered TWICE.** The second handler is shadowed and unreachable. This is a route shadowing bug introduced in the 3 commits after Source Master.

---

## Blockers

### P0 — Must Fix Before Prompt 01

#### P0-DATA: Duplicate canonical identity for 72/2025/QH15

**File**: [known-documents.json](file:///E:/Repos/VBAI-phase2-recovered/proxy/legal/data/known-documents.json)

The current HEAD contains **three entries** for `72/2025/QH15`:
1. **Line 2–22**: `id: "72-2025-qh15"`, title "Luật Tổ chức chính quyền địa phương", `verification_status: "verified"`, `review_state: "published"` — added in commit `a3926f0`
2. **Line 86–106**: `id: "72-2025-qh15"`, title "Luật Tổ chức chính quyền địa phương", `verification_status: "unverified"`, `review_state: "draft"` — carried forward from earlier commit `9782c53`

Additionally, the **Source Master** (commit `4205db4`) contained a **wrong title** for 72/2025/QH15:
- SM line 66–84: title was `"Luật sửa đổi, bổ sung một số điều của Luật an ninh mạng..."` — **INCORRECT**

The HEAD corrected the title to the canonical "Luật Tổ chức chính quyền địa phương" but introduced a **duplicate id** (`72-2025-qh15` appears at index 0 AND index 4) with **conflicting verification_status** (one says "verified", the other "unverified").

**Impact**: Any code iterating known-documents will find the first match (verified); but JSON schema validators or dedup checks will flag duplicate id. This is a data integrity violation.

**Fix**: Remove the duplicate entry (keep only one canonical record). Decide verification_status: since there is no `exactSourceUrl`, `retrievedAt`, or `contentSha256`, marking as `"verified"` violates fail-closed verification rules from Prompt 02.

#### P0-ROUTE: Duplicate `GET /api/document-metadata`

**File**: [server.js](file:///E:/Repos/VBAI-phase2-recovered/proxy/server.js)

Two handlers registered for the same method+path. The second is shadowed.

**Fix**: Remove one handler, keep the authoritative implementation.

---

### P1 — Should Fix in Prompt 01–02

#### P1-VERIFIED-FALSE: 72/2025/QH15 marked "verified" without evidence

**File**: [known-documents.json](file:///E:/Repos/VBAI-phase2-recovered/proxy/legal/data/known-documents.json) line 18

Entry has `verification_status: "verified"` and `verified_at: "2025-07-01"` but:
- No `official_source_urls`
- No `contentSha256`
- No `retrievedAt`

Per Prompt 02 requirements, this is **"verified giả"** — must downgrade to `"unverified"` or `"identity_resolved"`.

#### P1-SKILL-METADATA: HD05 package.json carries HD36 identity

**File**: [Skill_The_Thuc_VB_Dang_HD05/package.json](file:///E:/Repos/VBAI-phase2-recovered/Skill_The_Thuc_VB_Dang_HD05/package.json)

```json
{
  "name": "skill-vb-dang-hd36",
  "description": "Sinh van ban Dang (.docx) chuan HD 36-HD/VPTW"
}
```

Name and description reference HD36, not HD05. Unchanged between SM and HEAD.

#### P1-MATCHSCORE: Missing `matchScore` import in SM legal/index.js

**File**: Source Master [legal/index.js](file:///E:/Repos/VBAI-source-master-4205/proxy/legal/index.js) line 42

`matchScore` is exported in the `domain` object but never imported/required. HEAD added the import — this was a pre-existing bug in SM that HEAD fixed.

#### P1-SEARCH-LOG-PII: Firestore rules allow any authenticated user to create search_logs

**File**: [firestore.rules](file:///E:/Repos/VBAI-phase2-recovered/firestore.rules) line 18

Only admins can read/delete logs, but there is no server-side validation of what fields are stored (email, query text, etc.). This is a PII concern for Prompt 06.

---

### P2 — Track for Later Prompts

#### P2-MONOLITH: server.js is 6,927 lines

Extremely large monolith. Prompt 05 target.

#### P2-CORS: CORS configuration needs audit

Not visible from route regex scan. Needs manual inspection in Prompt 01.

#### P2-AUTH-BEFORE-UPLOAD: Transcription auth order

Need to verify auth runs before multer parses multipart. Prompt 03 target.

#### P2-RATE-LIMIT: In-memory rate limiting

Rate limit state stored in RAM Maps, lost on restart, inconsistent across Cloud Run instances. Prompt 05 target.

#### P2-WORKTREE-NGINX: webapp/docker-entrypoint.sh and nginx.conf modified

SHA differs between SM and HEAD. Need to verify changes are intentional and correct for production container.

---

## Production Behaviors to Preserve

Based on Source Master analysis:

1. **Chat**: `POST /api/chat` — Gemini completions with Firebase auth
2. **Web Search**: `POST /api/web-search` — calls `orchestrateLegalSearch()` with legal context pipeline
3. **Web Extract**: `POST /api/web-extract` — URL validation + legal content extraction
4. **Transcription**: `POST /api/transcribe` — multipart audio upload with Gemini/Vertex
5. **Document Metadata**: `GET /api/document-metadata` — single endpoint, lookup by document number
6. **System Config**: `GET /api/system-config-summary` + `POST /api/admin/system-config` — admin read/write
7. **Search History**: `GET /api/search-history` + `DELETE /api/search-history/:id`
8. **Build Info**: `GET /api/build-info` — neutral placeholder in tracked file, generated at runtime
9. **Firebase Auth**: All sensitive endpoints require Firebase ID token
10. **Admin Routes**: `/api/admin/*` require admin custom claim
11. **Firestore Rules**: Config locked (`allow: false`), users own-data, search_logs admin-only read

---

## Tests Needed Before Prompt 01

| Test | Purpose | Status |
|------|---------|--------|
| Route uniqueness test | Detect duplicate method+path | **NEEDED** — will catch P0-ROUTE |
| Known-documents schema validation | Detect duplicate id/documentNumber | **NEEDED** — will catch P0-DATA |
| Legal identity canonical test | Ensure 72/2025/QH15 has exactly one identity | **NEEDED** |
| HTTP integration auth test | Verify auth before all sensitive routes | **NEEDED** |
| CORS policy test | Verify origin allowlist | **NEEDED** |
| Build-info neutrality test | Ensure tracked file stays `gitSha: "dev"` | EXISTS (system-config-security.test.cjs) |
| Secret scan | No hardcoded keys | EXISTS (scripts/secret-scan.cjs) |

---

## Files Expected to Change per Blocker

| Blocker | Files |
|---------|-------|
| P0-DATA | `proxy/legal/data/known-documents.json` |
| P0-ROUTE | `proxy/server.js` |
| P1-VERIFIED-FALSE | `proxy/legal/data/known-documents.json` |
| P1-SKILL-METADATA | `Skill_The_Thuc_VB_Dang_HD05/package.json` |

---

## Conclusion: GO / NO-GO for Prompt 01

> [!IMPORTANT]
> **Conditional GO** for Prompt 01, contingent on fixing P0 blockers as the first action:
>
> 1. **P0-DATA**: Remove duplicate `72-2025-qh15` entry from `known-documents.json`. Keep ONE canonical record with `verification_status: "unverified"` (no evidence artifacts exist).
> 2. **P0-ROUTE**: Remove duplicate `GET /api/document-metadata` handler from `server.js`.
>
> These two fixes are prerequisites. Once resolved, Prompt 01 (route shadowing, auth, API contract) can proceed with confidence.

The Source Master worktree remains available at `E:\Repos\VBAI-source-master-4205` for ongoing comparison.

---

*Generated by Source Master Gate V4 script. Full output at `E:\Repos\VBAI-ops\source-master-gate-output\`.*
