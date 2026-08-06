/**
 * Webapp Legal Module Barrel Export.
 */
import { CORE_LEGAL_SYSTEM_PROMPT, assembleLegalPrompt } from './prompt-spec.js';
import { extractDocNumberFromQuery, isFreshnessNeeded, isExtractRequested } from './query-intent.js';
import { executeLegalSearchApi } from './search-orchestrator.js';
import { formatSearchContextForPrompt } from './search-context.js';
import { setActiveDocumentContext, getActiveDocumentContext, clearActiveDocumentContext } from './conversation-memory.js';
import { renderCitationBadge } from './citation-renderer.js';
import { formatLegalAnswer } from './answer-formatter.js';
import { renderLegalWarning } from './legal-warning-renderer.js';
import { analyzeTwoTierTerminology, enforceTwoTierTerminology, shouldEnforceTwoTierTerminology } from './two-tier-policy.js';

export {
  CORE_LEGAL_SYSTEM_PROMPT,
  assembleLegalPrompt,
  extractDocNumberFromQuery,
  isFreshnessNeeded,
  isExtractRequested,
  executeLegalSearchApi,
  formatSearchContextForPrompt,
  setActiveDocumentContext,
  getActiveDocumentContext,
  clearActiveDocumentContext,
  renderCitationBadge,
  formatLegalAnswer,
  renderLegalWarning,
  analyzeTwoTierTerminology,
  enforceTwoTierTerminology,
  shouldEnforceTwoTierTerminology,
};
