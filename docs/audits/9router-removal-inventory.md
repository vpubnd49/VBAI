# 9Router Removal Inventory Audit — VBAI Gemini-Only V1

- **Date**: 2026-08-05
- **Scope**: Comprehensive inventory of all 9Router, nine_router, DevGOVietnam, active_provider, and active_chat_provider references.

---

## 1. Inventory Classification Table

| Target File | Occurrence Category | Impacted Tokens / Functions | Action Required |
| --- | --- | --- | --- |
| `proxy/server.js` | RUNTIME_BACKEND | `nine_router_*`, `isNineRouter`, `DevGOVietnam-*`, `active_provider`, `active_chat_provider` | Purge legacy fields, mandate Gemini-only logic, reject 9Router requests with 400 |
| `proxy/set_9router_config.js` | SCRIPT | Obsolete 9Router script | DELETE file |
| `proxy/list_9router_models.js` | SCRIPT | Obsolete 9Router script | DELETE file |
| `proxy/test_9router_transcribe.js` | SCRIPT | Obsolete 9Router script | DELETE file |
| `webapp/modules/admin-panel.js` | ADMIN_UI | 9Router card, key input, endpoint input, default model, model chips, radio selection | Purge 9Router card & controls, replace with static Gemini info badge |
| `webapp/modules/system-config.js` | RUNTIME_FRONTEND | `has_nine_router_key`, `nine_router_*`, `active_chat_provider` | Add `normalizeGeminiOnlyConfig()`, strip legacy config cache |
| `webapp/modules/ai-proxy.js` | RUNTIME_FRONTEND | `active_provider` check, model fallback | Simplify to resolve `gemini_model` & `transcribe_model` |
| `webapp/modules/chat-assistant.js` | RUNTIME_FRONTEND | `isNineRouter` check, DevGOVietnam model | Strip 9Router conditionals |
| `webapp/modules/meeting-minutes.js` | RUNTIME_FRONTEND | `isNineRouter` check, DevGOVietnam model | Strip 9Router conditionals |
| `webapp/modules/spell-check.js` | RUNTIME_FRONTEND | `isNineRouter` check, DevGOVietnam model | Strip 9Router conditionals |
| `proxy/find_key.js` | SCRIPT | 9Router key comment | Update comment to Gemini-only |
| `proxy/test_ipv4_direct.js` | SCRIPT | DevGOVietnam model | Update test script to Gemini model |
| `proxy/test_gemini_key.js` | SCRIPT | 9Router key comment | Clean test script comment |

---

## 2. Zero-Occurrence Gate Rule
After removal, `rg -n -i "9router|nine_router|DevGOVietnam|active_provider|active_chat_provider"` must yield 0 results across `proxy/` runtime, `webapp/` runtime, `admin UI`, test suite, package scripts, and `dist` build artifacts.
