# ADR 0002: Fail-Closed Evidence Verification Policy

## Status
Accepted

## Context
AI hallucinations in legal retrieval systems pose severe risks if unverified citations are falsely presented to users as "verified".

## Decision
1. A strict fail-closed verification policy is enforced.
2. A document or citation is marked `verification_status: "verified"` ONLY IF it contains explicit verification evidence:
   - Non-empty `official_source_urls` from authoritative domains (e.g. `vanban.chinhphu.vn`, `quochoi.vn`, `vbpl.vn`).
   - Valid `verified_at` timestamp.
3. Documents lacking official source evidence remain `"unverified"` or `"identity_resolved"`.
4. Generic search engine result page (SERP) URLs are NOT valid evidence URLs.

## Consequences
- Prevents false confidence in AI generated legal citations.
- Unverified citations are flagged with amber/warning indicators in UI.
