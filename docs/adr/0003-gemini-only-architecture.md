# ADR 0003: Pure Gemini API & Vertex AI Search Architecture

## Status
Accepted

## Context
Legacy versions of VBAI depended on 3rd-party proxy routers (9Router) and unofficial model providers (DevGOVietnam). These introduced availability bottlenecks, security risks, and rate limit instability.

## Decision
1. All AI features strictly use official Google Gemini APIs (`gemini-2.5-flash`, `gemini-2.5-pro`) and Google Vertex AI Search.
2. Legacy 9Router / DevGOVietnam code, endpoints, and configuration parameters are completely purged.
3. Automated static analysis (`proxy/tests/unit/gemini-only.test.cjs`) enforces zero legacy provider references in code and configuration.

## Consequences
- Enterprise reliability on GCP infrastructure.
- Simplified API key management and security scanning.
