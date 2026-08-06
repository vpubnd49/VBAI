# Baseline Audit — VBAI Legal Pro Foundation V1

- **Repository**: vpubnd49/VBAI
- **Workspace Path**: `e:\OneDrive\HSCV\Antigravity\VBAI`
- **Audit Date**: 2026-08-05
- **Local Branch Target**: `refactor/legal-pro-foundation-v1`
- **Baseline Commit**: Current HEAD commit

---

## 1. Environment & Preflight Summary

| Parameter | Value |
| --- | --- |
| Node.js | v20.x+ (Vite 7, Express 4.19, Firebase Admin 12) |
| Proxy Directory | `proxy/` |
| Webapp Directory | `webapp/` |
| Skill Directory | `skill/` |
| Key Server File | `proxy/server.js` (6,645 lines, 253,334 bytes) |
| Key Client File | `webapp/modules/chat-assistant.js` (159,730 bytes) |

---

## 2. Baseline Test Suite Results

### Proxy Baseline (`proxy/package.json`)
- `npm run test:golden`: `node tests/golden-legal-extract.test.cjs` — **PASS** (34/34 assertions pass offline)
- `npm run test:integration`: Require `VBAI_PROXY_BASE_URL` & `VBAI_TEST_ID_TOKEN` (runtime integration)
- `npm run test:canary`: Require credentials (runtime canary)
- `npm run test:legal-smoke`: Require credentials (legal smoke checks)

### Webapp Baseline (`webapp/package.json`)
- `npm run build`: `vite build`
- `npm run test:policy`: `node tests/two-tier-policy.test.mjs` — **PASS**

---

## 3. Main API Endpoints Summary

1. `POST /api/web-search`: Real-time legal search (Vertex AI Search, Google CSE, Hot Index, Direct Sources).
2. `POST /api/web-extract`: Legal content extractor (Article/Clause/Point extraction).
3. `POST /api/chat`: Chat assistant completions with Gemini & 9Router.
4. `POST /api/transcribe`: Audio transcription.
5. `GET/POST /api/system-config`: Admin system configurations.

---

## 4. Primary Risks Identified Prior to Refactoring

1. **Monolithic Backend (`proxy/server.js`)**: Over 6,600 lines containing Express routes, legal regex normalization, source classification, hardcoded `LEGAL_TOPIC_CONSENSUS_MAP`, cache handling, and prompt logic in one file.
2. **Monolithic Client (`webapp/modules/chat-assistant.js`)**: ~160KB containing UI logic, search orchestration, two-tier policy string replacement, prompt formatting, and DOM manipulation.
3. **Hardcoded Document Consensus**: Known documents hardcoded in JavaScript objects rather than loaded from validated JSON schemas.
4. **Lack of Isolated Unit Tests**: Unit tests were bound to golden sample or runtime credentials without granular unit coverage for Vietnamese normalization, query intent, source tiering, and document relations.
