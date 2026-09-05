# Audit: Gemini-Only Configuration Cleanup

- **Script Path**: `proxy/scripts/migrate-remove-9router-config.cjs`
- **Execution Mode**: `DRY-RUN (safe mode, 0 changes written to MongoDB)`
- **Input**: exported JSON snapshot
- **Date**: 2026-08-06

---

## 1. Migration Dry-Run Output Log

```text
[Configuration migration] Starting legacy 9Router cleanup
[Mode]: DRY-RUN (safe mode, no changes will be written)
[Input]: exported JSON snapshot

[Current fields in config/system]:
[
  "gemini_endpoint",
  "gemini_model",
  "transcribe_model",
  "web_search_mode",
  "web_search_provider",
  "updated_at",
  "updated_by",
  "active_provider",
  "active_chat_provider",
  "nine_router_endpoint",
  "nine_router_model",
  "nine_router_models"
]

[Legacy fields to be deleted] (5):
[
  "active_provider",
  "active_chat_provider",
  "nine_router_endpoint",
  "nine_router_model",
  "nine_router_models"
]

[DRY-RUN Complete] No changes were written to MongoDB.
To apply these changes, run with: node proxy/scripts/migrate-remove-9router-config.cjs --input path/to/export.json --apply
```

---

## 2. Authorized Apply Command

```bash
node proxy/scripts/migrate-remove-9router-config.cjs --input path/to/export.json --apply
```
