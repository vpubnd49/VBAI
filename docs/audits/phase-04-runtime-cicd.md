# Phase 4 Audit Report — Runtime Configuration, CI/CD & Canary Security

## Overview
This report documents the unified Runtime Environment Contract, PR Validation CI workflow alignment, neutral placeholder build-info enforcement, and Canary staging deployment security model for VBAI Legal Pro V4.

---

## 1. Single Runtime Environment Contract

| Variable Name | Component | Required? | Secret? | Environment Scope | Source / Description |
|---------------|-----------|-----------|---------|-------------------|----------------------|
| `PORT` | Proxy / Webapp | Optional (Default 8080) | No | Staging / Prod | Container listener port |
| `APP_ENV` | Webapp / Proxy | Optional (dev/staging/prod) | No | All | Application environment tier |
| `API_BASE_URL` | Webapp | Required in Prod | No | Webapp Container | Target URL for proxy backend API |
| `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS` | Proxy | Required in Prod | No | Proxy Container | Comma-separated CORS allowed origins |
| `FIREBASE_API_KEY` | Webapp | Required | Non-Secret (Public Key) | Webapp Container | Firebase client web API key |
| `FIREBASE_AUTH_DOMAIN` | Webapp | Required | Non-Secret | Webapp Container | Firebase Auth domain |
| `FIREBASE_AUTH_HOST` | Webapp | Optional | Non-Secret | Webapp Container | Custom Auth host / emulator override |
| `FIREBASE_PROJECT_ID` | Webapp / Proxy | Required | Non-Secret | Webapp Container / Proxy | GCP & Firebase project ID (`gen-lang-client-0462350485`) |
| `FIREBASE_STORAGE_BUCKET` | Webapp | Required | Non-Secret | Webapp Container | GCS storage bucket for assets |
| `FIREBASE_MESSAGING_SENDER_ID` | Webapp | Required | Non-Secret | Webapp Container | FCM sender ID |
| `FIREBASE_APP_ID` | Webapp | Required | Non-Secret | Webapp Container | Firebase Web App App ID |
| `GCP_SA_KEY` | CI/CD | Required | Secret | GitHub Actions Secrets | Service account JSON key for deployment |
| `MAX_AUDIO_UPLOAD_MB` | Proxy | Optional (Default 500) | No | Proxy Container | Maximum audio file upload size limit |

---

## 2. CI/CD & Neutral Placeholder Enforcement

### Neutral `webapp/public/build-info.json`
- Source file in repository tracked with safe placeholder defaults:
  ```json
  {
    "product": "VBAI Legal Pro",
    "version": "2",
    "gitSha": "dev",
    "builtAt": ""
  }
  ```
- Build pipeline injects actual release `gitSha` and `builtAt` timestamp into target output artifacts (`dist` or container image) during build step without polluting git workspace state.

### Automated PR Validation Workflow (`.github/workflows/pr-validation.yml`)
- Secret scanner check (`scripts/secret-scan.cjs`)
- Legal consistency check (Phase 2 audit)
- Route uniqueness & Auth policy verification (Phase 3 audit)
- Proxy unit & golden extract tests
- Webapp tests & production build verification

---

## 3. Canary Deployment Security Model (`.github/workflows/deploy.yml`)

1. **Tag-based candidate deployment**: Revisions are deployed with `--no-traffic` by default.
2. **Canary URL tag**: `--tag candidate` assigns a private testing URL for pre-release validation.
3. **Smoke testing step**: Automated canary smoke check executed against candidate URL.
4. **Controlled Traffic Shift**: Traffic is shifted to 100% only upon successful candidate smoke verification.
5. **No Direct Production Deploy from PRs**: Production deployment strictly requires manual `workflow_dispatch` trigger.
