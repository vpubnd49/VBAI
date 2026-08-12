## Summary of Changes
Provide a brief summary of what this PR introduces.

## Governance & Security Gate Checklist
- [ ] **Secret Scan**: Verified zero server secrets or private keys in tracked files (`node scripts/secret-scan.cjs`).
- [ ] **Legal Consistency**: Verified `bosung_metadata.json` canonical data & zero duplicate legal identities.
- [ ] **Fail-Closed Verification**: Verified unverified documents are NOT marked `verified`.
- [ ] **Route Uniqueness**: Verified 0 duplicate/shadowed Express routes (`node proxy/tests/route-uniqueness.test.cjs`).
- [ ] **Auth Policy**: Verified all non-public routes enforce `verifyIdToken` (`node proxy/tests/route-auth-policy.test.cjs`).
- [ ] **Build Info**: Verified `webapp/public/build-info.json` contains neutral dev placeholders.
- [ ] **Clean Working Tree**: Verified `git status --porcelain` is clean after running tests & builds.

## Test Results
- Unit Tests: `npm run test:unit`
- Golden Legal Extract Tests: `npm run test:golden`
- Route & Auth Policy Tests: `node proxy/tests/run-all.cjs`
