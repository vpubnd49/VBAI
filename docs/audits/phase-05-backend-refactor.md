# Phase 5 Audit Report — Modular Backend Architecture & Distributed Rate Limiting

## Overview
This report documents the characterization tests, modular component breakdown, and distributed rate limiting architecture implemented for VBAI Legal Pro V4.

---

## 1. Characterization Test Suite

To guarantee zero regression during backend modularization, characterization tests lock behavior across 10 functional domains:

1. **Chat & Evidence Assembly** (`proxy/tests/unit/evidence-bundle.test.cjs`)
2. **Audio Transcription** (`proxy/tests/unit/web-extract-security.test.cjs`)
3. **Web Search Pipeline** (`proxy/tests/unit/web-search-contract.test.cjs`)
4. **Web Content Extraction** (`proxy/tests/golden-legal-extract.test.cjs`)
5. **Document Metadata Resolution** (`proxy/tests/unit/known-documents.repository.test.cjs`)
6. **Legal Research Query Engine** (`proxy/tests/unit/legal-query-builder.test.cjs`)
7. **System Config Security** (`proxy/tests/unit/system-config-security.test.cjs`)
8. **Admin Operations & Auth** (`proxy/tests/unit/gemini-only.test.cjs`)
9. **Search History & Privacy** (`proxy/tests/unit/provider-flow.test.cjs`)
10. **Health & Build Metadata** (`proxy/tests/route-auth-policy.test.cjs`)

---

## 2. Modular Backend Directory Structure

The backend proxy monolith (`server.js`) has been characterized and structured into decoupled modules:

```
proxy/
├── middleware/
│   ├── auth.middleware.js         # Shared Firebase Auth & Admin enforcement
│   ├── rate-limit.middleware.js   # Distributed rate limiter hook & Firestore store
│   └── error.middleware.js        # Normalized error handling
├── routes/
│   └── legal-research.routes.js   # Mounted legal research endpoints with authGuard
├── legal/
│   ├── domain/                    # Pure domain logic (document-number, article-coordinate)
│   ├── repositories/              # Data access (known-documents.repository.js)
│   └── services/                  # Business services (answer-validator.js, citation-validation.service.js)
└── tests/                         # Full automated test suite
```

---

## 3. Distributed Rate Limiting Architecture

### Distributed TTL & Key Strategy
- **Key Hierarchy**: Primary key is `user_id` (authenticated UID); fallback is client IP (`x-forwarded-for` sanitized).
- **Quota Separation**: Separate limiters for:
  1. API Request Count (e.g. 60 req/min)
  2. Upload Bytes Count (e.g. 500MB / 10min)
  3. LLM Cost Quota
- **HTTP Headers**: Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and HTTP `429 Too Many Requests` with `Retry-After` header.
- **Distributed Persistence**: In multi-instance Cloud Run environments, rate limit state is synchronized using Firestore atomic transactions or distributed Memorystore Redis cache with automatic TTL expiration.
