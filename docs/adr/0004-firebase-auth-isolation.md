# ADR 0004: Firebase Auth Isolation & Owner Access Control

## Status
Accepted

## Context
User queries and search logs contain sensitive legal research data and potential PII. Cross-user data leakage or unauthenticated endpoint access must be prevented.

## Decision
1. All non-public proxy endpoints require valid Firebase Auth ID tokens via `requireAuth()` middleware.
2. Admin endpoints strictly require admin custom claims via `requireAdmin()`.
3. Public endpoints are restricted strictly to `/health`, `/api/health`, and `/api/build-info`.
4. Search history and search audit logs enforce strict owner isolation: users can ONLY query and delete their own logs (`request.auth.uid == resource.data.userId`).

## Consequences
- Zero unauthenticated API usage.
- Compliant with privacy regulations and PII protection rules.
