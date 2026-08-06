# Repository Data & Asset Audit — VBAI Legal Pro Foundation V1

- **Date**: 2026-08-05
- **Scope**: Large files, logs, backups, duplicate datasets, and potentially sensitive documents.

---

## 1. Inventory & Classification Table

| Path | Size / Category | Classification | Needed at Runtime? | Exposure Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `backup_agents/` | Legacy Agent Backups | ARCHIVE | No | Low | Keep in source / archive |
| `Skill_The_Thuc_VB_Dang_HD05/` | Active Skill | KEEP_IN_SOURCE | Yes | Low | Keep in source |
| `Skill_The_Thuc_VB_ND30/New folder/` | Sample PDFs/DOCX | POTENTIALLY_SENSITIVE | No | Medium | Move to Cloud Storage / Git LFS |
| `bosung_metadata.json` | 156 KB Metadata | KEEP_IN_SOURCE | Yes | Low | Managed via local-metadata repo |
| `bosung_metadata.jsonl` | 33 KB JSONL | GENERATED_OUTPUT | Optional | Low | Retain as seed source |
| `proxy/service-account.json` | GCP Service Account | POTENTIALLY_SENSITIVE | Local Dev Only | High | Ensure excluded from Git & Docker |
| `proxy/token.txt` | Local Dev ID Token | POTENTIALLY_SENSITIVE | Local Test Only | Medium | Ensure excluded from Git & Docker |
| `webapp/github-sa-key.json` | GCP SA Key | POTENTIALLY_SENSITIVE | Local Dev Only | High | Ensure excluded from Git & Docker |
| `proxy/proxy-dev.err.log` | Local Log File | GENERATED_OUTPUT | No | Low | Excluded via .dockerignore |

---

## 2. Docker Context Optimization
The root `.dockerignore` has been updated to explicitly exclude `service-account.json`, `github-sa-key.json`, `.logs/`, `scratch/`, `backup_agents/`, `token.txt`, and build artifacts from Docker context.
