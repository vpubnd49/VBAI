# ADR 0001: Bosung Metadata as Canonical Authoritative Source

## Status
Accepted

## Context
VBAI Legal Pro requires a reliable, authoritative source of legal document metadata (document number, title, issuer, issue date, effective status, replacement lineage, chapter/article summaries) for Vietnamese laws and resolutions.

Previously, `known-documents.json` contained sparse manual entries, while `bosung_metadata.json` contained detailed structured metadata for 100 legal documents.

## Decision
1. `proxy/bosung_metadata.json` is designated as the primary canonical authoritative metadata source for the system.
2. `proxy/legal/data/known-documents.json` acts as a secondary registry for quick alias lookups and custom query patterns.
3. In case of metadata overlap, `bosung_metadata.json` takes priority.

## Consequences
- Single source of truth for legal status (`co_hieu_luc`, `het_hieu_luc`, etc.).
- `answer-validator.js` and `known-documents.repository.js` inspect `bosung_metadata.json` first.
