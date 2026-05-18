# Progress Checklist

- [x] Implement status and replacement search queries in `proxy/server.js`
  - [x] Add `allowReference` parameter to `isKnownDocumentOfficialCandidate` to accept reference sites for time-sensitive status queries
  - [x] Dynamically inject status-specific queries (`"thay thế" "${docNumber}"`, etc.) into `runKnownDocumentOfficialLookup`
- [x] Verify search results return replacement decrees (Decree 168/2024 / Decree 81/2026) via local PowerShell API call
- [x] Launch development server and run browser verification
  - [x] Start frontend Vite dev server if not already running
  - [x] Use `browser_subagent` to query *"nghị định 100 còn hiệu lực không"*
  - [x] Capture screenshot to verify tight spacing and updated decree answers
- [x] Fix E2E blocker for Decree 81 replacement query
  - [x] Identify early pre-search blocker `shouldRequireFullDocNumber` in frontend `chat-assistant.js`
  - [x] Update `shouldRequireFullDocNumber` to bypass status/relationship queries
  - [x] Run E2E browser verification for query *"Co nghi dinh 81/2026 nao thay the nghi dinh 168/2024 khong?"*
  - [x] Confirm and capture high-fidelity rich response from Gemini successfully rendered in the UI
