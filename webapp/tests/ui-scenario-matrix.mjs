/**
 * Canonical UI Audit Matrix Specification (612 Scenarios)
 * 17 Routes x 3 Viewports x 12 States = 612 Scenarios
 */

export const UI_ROUTES = [
  { id: 'dashboard', label: 'Dashboard Overview', activationSelector: '#nav-dashboard', contentSelector: '#page-content .dashboard-container, #page-content', type: 'nav' },
  { id: 'chat-assistant', label: 'Chat Assistant View', activationSelector: '#nav-chat-assistant', contentSelector: '.chat-assistant-panel, #page-content .chat-container', type: 'chat' },
  { id: 'legal-search', label: 'Legal Search', activationSelector: '#nav-legal-search', contentSelector: '#page-content .search-container, #page-content', type: 'nav' },
  { id: 'document-lookup', label: 'Document Lookup', activationSelector: '#nav-document-lookup', contentSelector: '#page-content .lookup-container, #page-content', type: 'nav' },
  { id: 'situation-analysis', label: 'Situation Analysis', activationSelector: '#nav-situation-analysis', contentSelector: '#page-content .analysis-container, #page-content', type: 'nav' },
  { id: 'compare-regulations', label: 'Compare Regulations', activationSelector: '#nav-compare-regulations', contentSelector: '#page-content .compare-container, #page-content', type: 'nav' },
  { id: 'effective-date', label: 'Effective Date Tracker', activationSelector: '#nav-effective-date', contentSelector: '#page-content .date-container, #page-content', type: 'nav' },
  { id: 'spell-check', label: 'Spell Check & ND30 Audit', activationSelector: '#nav-spell-check', contentSelector: '#page-content .spell-container, #page-content', type: 'nav' },
  { id: 'pdf-tool', label: 'PDF OCR Tool', activationSelector: '#nav-pdf-tool', contentSelector: '#page-content .pdf-container, #page-content', type: 'nav' },
  { id: 'pdf-publisher', label: 'PDF Publisher', activationSelector: '#nav-pdf-publisher', contentSelector: '#page-content .publisher-container, #page-content', type: 'nav' },
  { id: 'vb-nd30', label: 'ND30 Administrative Doc', activationSelector: '#nav-vb-nd30', contentSelector: '#page-content .nd30-container, #page-content', type: 'nav' },
  { id: 'vb-dang', label: 'HD05 Party Document', activationSelector: '#nav-vb-dang', contentSelector: '#page-content .dang-container, #page-content', type: 'nav' },
  { id: 'docx-tool', label: 'DOCX Generator', activationSelector: '#nav-docx-tool', contentSelector: '#page-content .docx-container, #page-content', type: 'nav' },
  { id: 'meeting-minutes', label: 'Meeting Minutes Processor', activationSelector: '#nav-meeting-minutes', contentSelector: '#page-content .meeting-container, #page-content', type: 'nav' },
  { id: 'search-history', label: 'Search History', activationSelector: '#nav-search-history', contentSelector: '#page-content .history-container, #page-content', type: 'nav' },
  { id: 'admin-panel', label: 'System Admin Panel', activationSelector: '#nav-admin-panel', contentSelector: '#page-content .admin-container, #page-content', type: 'nav' },
  { id: 'login', label: 'Login Overlay Surface', activationSelector: '#login-overlay', contentSelector: '#login-overlay .card, #login-overlay .login-container', type: 'login' }
];

export const UI_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

export const UI_STATES = [
  'default',
  'hover',
  'keyboard-focus',
  'active-selected',
  'disabled',
  'loading',
  'success',
  'warning',
  'error',
  'modal',
  'popover-dropdown',
  'mobile-navigation'
];

import path from 'node:path';
import os from 'node:os';

export function resolveAuthoritativeResultPath(env = process.env, customArg = null) {
  if (customArg && typeof customArg === 'string' && customArg.trim().length > 0) {
    return path.resolve(customArg.trim());
  }
  if (env.VBAI_UI_SCENARIO_RESULT_PATH && env.VBAI_UI_SCENARIO_RESULT_PATH.trim().length > 0) {
    return path.resolve(env.VBAI_UI_SCENARIO_RESULT_PATH.trim());
  }
  const outDir = env.VBAI_UI_AUDIT_OUTPUT_DIR || env.UI_AUDIT_OUTPUT_DIR;
  if (outDir && outDir.trim().length > 0) {
    return path.resolve(outDir.trim(), 'ui-scenario-results.json');
  }
  const defaultDir = path.join(os.tmpdir(), 'vbai-ui-audit-current');
  return path.resolve(defaultDir, 'ui-scenario-results.json');
}

export function buildScenarioId(routeId, viewportName, stateName) {
  return `${routeId}__${viewportName}__${stateName}`;
}

export function buildExpectedScenarios() {
  const list = [];
  for (const route of UI_ROUTES) {
    for (const vp of UI_VIEWPORTS) {
      for (const state of UI_STATES) {
        list.push({
          id: buildScenarioId(route.id, vp.name, state),
          route: route.id,
          viewport: vp.name,
          state: state,
          activationSelector: route.activationSelector,
          contentSelector: route.contentSelector,
        });
      }
    }
  }
  return list;
}

