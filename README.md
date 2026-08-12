# VBAI Legal Pro V4 — Tra cứu & Kiểm chứng Pháp luật AI

VBAI Legal Pro V4 là hệ thống tra cứu, phân tích và kiểm chứng pháp luật Việt Nam thế hệ mới, tích hợp công nghệ Gemini 2.5 Flash / Pro và Google Vertex AI Search.

---

## 🏛️ Kiến trúc Hệ thống (Architecture)

VBAI Legal Pro được xây dựng theo kiến trúc decoupled microservices (Frontend Webapp + Backend Proxy API + GCP Services):

```
┌─────────────────────────────────────────────────────────┐
│              Webapp Client (Vite + Modular JS)          │
│   Dashboard | Legal Search | Chat Assistant | History   │
└────────────────────────────┬────────────────────────────┘
                             │ REST API (Bearer Token)
┌────────────────────────────▼────────────────────────────┐
│          Backend Proxy (Express 4.x Node.js)           │
│   Auth Guard | Route Manager | Rate Limiter | Audit    │
└───────┬────────────────────┬────────────────────┬───────┘
        │                    │                    │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│ Gemini API    │    │ Vertex Search │    │ Firebase Auth │
│ 2.5 Flash/Pro │    │ Data Store    │    │ & Firestore   │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 🔒 An ninh & Quyền riêng tư (Security & Privacy)

1. **Zero Secret Leakage**: Quét tự động 100% commit trước khi đẩy repository (`scripts/secret-scan.cjs`).
2. **Strict Auth Guard**: 100% endpoint nghiệp vụ bảo vệ bằng Firebase Auth ID Token (`Bearer`).
3. **Fail-Closed Verification Policy**: Không bao giờ đánh dấu "VERIFIED" nếu thiếu bằng chứng văn bản gốc.
4. **Owner Isolation**: Log tra cứu được mã hóa/pseudonymized và phân quyền theo UID người dùng.

---

## 📚 Dữ liệu Văn bản Pháp luật Canonical

- **Nguồn chính thống (`Canonical`)**: `proxy/bosung_metadata.json` chứa 100+ văn bản luật, nghị định, thông tư (Luật 72/2025/QH15, Luật 74/2025/QH15, Luật 75/2025/QH15, v.v.).
- **Registry phụ (`Secondary`)**: `proxy/legal/data/known-documents.json`.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy Local (Local Setup)

### 1. Khai báo môi trường (.env)
```bash
# Proxy Server Environment
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=gen-lang-client-0462350485
GOOGLE_SEARCH_KEY=your_gemini_api_key
```

### 2. Cài đặt dependencies và chạy Backend Proxy
```bash
cd proxy
npm install
npm start
```

### 3. Cài đặt dependencies và chạy Webapp
```bash
cd webapp
npm install
npm run dev
```

---

## 🧪 Chạy Kiểm thử (Test Suites)

Toàn bộ test suite được tự động hóa:

```powershell
# Running full prompt test suites
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File E:\Repos\VBAI-ops\prompt03-test-runner.ps1
```

Hoặc qua Node.js:
```bash
cd proxy
npm run test:all
```

---

## 📖 Tài liệu Vận hành & Runbooks

- [Cloud Run Release & Rollback Runbook](docs/runbooks/cloud-run-release.md)
- [Phase 3 API Security Audit](docs/audits/phase-03-api-security.md)
- [Phase 4 Runtime & CI/CD Audit](docs/audits/phase-04-runtime-cicd.md)
- [Phase 5 Backend Refactor Audit](docs/audits/phase-05-backend-refactor.md)
- [Phase 6 Privacy & Search Audit](docs/audits/phase-06-privacy.md)
- [Phase 7 Governance Audit](docs/audits/phase-07-docs-governance.md)
- [Final Upgrade Gate V4](docs/audits/final-upgrade-gate-v4.md)
