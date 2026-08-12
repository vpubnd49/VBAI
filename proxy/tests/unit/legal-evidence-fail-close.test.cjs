'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEGAL_EVIDENCE_REQUIRED_MESSAGE,
  hasUsableLegalEvidence,
  evaluateLegalEvidence,
  selectValidatedLegalItems,
  hasUnsafeCitations,
} = require('../../services/legal-evidence-policy');

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(evaluateLegalEvidence({ isLegalQuery: false, legalContext: null }).allowed === true,
  'non-legal requests remain allowed');
check(hasUsableLegalEvidence(null) === false, 'missing legal context is not usable');
check(hasUsableLegalEvidence({ evidenceBundle: { documents: [] } }) === false,
  'empty evidence bundle is not usable');
check(hasUsableLegalEvidence({ available: false, evidenceBundle: { documents: [{}] } }) === false,
  'explicitly unavailable evidence remains unavailable');
check(hasUsableLegalEvidence({ verification: { available: false }, evidenceBundle: { documents: [{}] } }) === false,
  'failed verification remains unavailable');
check(hasUsableLegalEvidence({ evidenceBundle: { documents: [{ documentNumber: '24/2018/QH14' }] } }) === true,
  'non-empty evidence bundle is usable');

const denied = evaluateLegalEvidence({ isLegalQuery: true, legalContext: null });
check(denied.allowed === false && denied.code === 'LEGAL_EVIDENCE_REQUIRED',
  'legal request without evidence is denied');
check(denied.message === LEGAL_EVIDENCE_REQUIRED_MESSAGE,
  'legal refusal uses the required Vietnamese message');

const approved = [{ title: 'Approved' }];
check(selectValidatedLegalItems({ validation: { ok: true, approvedItems: approved } }) === approved,
  'strictly approved items are returned');
check(selectValidatedLegalItems({ validation: { ok: false }, officialCandidateItems: [] }).length === 0,
  'unvalidated best-effort items are not returned');
const officialCandidates = [{ title: 'Official candidate' }];
check(selectValidatedLegalItems({ validation: { ok: false }, officialCandidateItems: officialCandidates }) === officialCandidates,
  'narrow official candidates remain available');

check(hasUnsafeCitations(null) === true, 'missing citation validation fails closed');
check(hasUnsafeCitations({ totalCitations: 0, citations: [] }) === true,
  'uncited legal answer fails closed');
check(hasUnsafeCitations({ totalCitations: 1, unverifiedCitationsCount: 1 }) === true,
  'unverified citation count fails closed');
check(hasUnsafeCitations({ totalCitations: 1, citations: [{ verified: false }] }) === true,
  'explicit unverified citation fails closed');
check(hasUnsafeCitations({ totalCitations: 1, unverifiedCitationsCount: 0, citations: [{ verified: true, citationMatchesEvidence: true }] }) === false,
  'fully verified citations pass');

const serverSource = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
const chatIndex = serverSource.indexOf("app.post('/api/chat'");
const evidenceCheckIndex = serverSource.indexOf('const evidenceDecision = evaluateLegalEvidence', chatIndex);
const providerIndex = serverSource.indexOf('const executeProviderAttempt = async', chatIndex);
check(chatIndex >= 0 && evidenceCheckIndex > chatIndex && providerIndex > evidenceCheckIndex,
  'evidence decision occurs before the provider boundary');
check(!serverSource.includes('Best-effort mode: return available items even when strict validation does not pass.'),
  'unvalidated best-effort source path is absent');
check(!serverSource.includes("localMeta.tinh_trang_hieu_luc || 'co_hieu_luc'"),
  'local metadata does not infer active status');
check(!serverSource.includes("knownDocument.tinh_trang_hieu_luc || 'Có hiệu lực'"),
  'search response does not infer active status');
check(!/function isKnownDocumentOfficialCandidate[\s\S]*?allowReference/.test(serverSource),
  'official candidate path does not admit reference-only domains');

console.log(`PASS legal-evidence-fail-close.test.cjs (${assertions} assertions)`);
