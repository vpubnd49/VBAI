# LegalKit V3 Integration Matrix

**Mục tiêu:** Ma trận tích hợp bộ LegalKit v3 vào kiến trúc VBAI Legal Pro V2 mà không gây hỏng hóc hoặc mâu thuẫn với các skill hiện hữu (`Skill_The_Thuc_VB_Dang_HD05`, `Skill_The_Thuc_VB_ND30`, `Skill_PDF`, `Skill_DOCX`).

---

## 1. Ma trận Tương thích & Phân định Năng lực

| Module / Tính năng | LegalKit V3 (Nâng cấp) | Skill NĐ30 / HD05 (Hiện hữu) | Kết quả Tích hợp |
|:---|:---|:---|:---|
| **Mode A — Research** | Tra cứu PDCA Cascade, trích dẫn SOT nguyên văn có tọa độ, tra cứu Án lệ TANDTC | Hỗ trợ thể thức văn bản | Hợp nhất vào `skill/SKILL.md` và UI Tra cứu |
| **Mode B — Draft** | 20 Template Hợp đồng 3-tier (required, default, optional) + Lint rules validation | N/A | Tích hợp vào `skill/templates/contracts/` |
| **Mode C — Integrated** | Phân tích tình huống → Tự động nhúng SOT vào hợp đồng | N/A | Tích hợp vào quy trình xử lý kép |
| **Mode D — ND30 Formatting** | Sinh & rà soát văn bản hành chính NĐ30 bằng Node.js docx-js | `Skill_The_Thuc_VB_ND30` & `Skill_The_Thuc_VB_Dang_HD05` | Giữ nguyên 100% logic script engine của NĐ30 và HD05 |

---

## 2. Đường dẫn Tệp tin Tương ứng

| Thành phần | Đường dẫn Nguồn (Gốc) | Đường dẫn Tích hợp Canonical (VBAI) |
|:---|:---|:---|
| Master Instructions | `legalkit-vn-master/SKILL.md` | `skill/SKILL.md` |
| Manifest Registry | `legalkit-vn-master/manifest.json` | `skill/manifest.json` |
| Contract Schema | `resources/contract-schema.md` | `skill/resources/contract-schema.md` |
| Lint Rules | `resources/lint-rules.md` | `skill/resources/lint-rules.md` |
| Law Monitor | `resources/monitored-laws.json` | `skill/resources/monitored-laws.json` |
| Precedents Catalog | `resources/precedents-catalog.json` | `skill/resources/precedents-catalog.json` |
| NĐ30 Standard | `resources/nd30-format-standard.md` | `skill/resources/nd30-format-standard.md` |
| Formats & Rights | `references/*.md` | `skill/references/*.md` |
| 20 Contract Templates | `templates/contracts/*.json` | `skill/templates/contracts/*.json` |
