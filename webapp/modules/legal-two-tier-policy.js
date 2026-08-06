/**
 * Enhanced Two-Tier Local Government Model Policy Engine.
 */
export function analyzeTwoTierTerminology({ text = '', query = '', isCitation = false, isComparison = false, isHistorical = false } = {}) {
  const normText = String(text || '').toLowerCase();
  const normQuery = String(query || '').toLowerCase();

  // Context checks: Do not trigger if citation, comparison, or historical analysis
  if (isCitation || isComparison || isHistorical) {
    return { triggered: false, issues: [], policyVersion: 1 };
  }

  if (/(trích dẫn|nguyên văn|văn bản cũ|lịch sử|năm 2015|năm 2019)/.test(normText) || /(lịch sử|trước đây|năm 2015|năm 2019)/.test(normQuery)) {
    return { triggered: false, issues: [], policyVersion: 1 };
  }

  const issues = [];
  const patternThreeTier = /cấp\s*tỉnh\s*,\s*(?:cấp\s*)?huyện\s*(?:,|và)\s*(?:cấp\s*)?xã/gi;
  let match;

  while ((match = patternThreeTier.exec(text)) !== null) {
    issues.push({
      code: 'OUTDATED_THREE_TIER_MODEL',
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      severity: 'warning',
      suggestedReplacement: 'cấp tỉnh và cấp xã',
      reason: 'Chính quyền địa phương hiện hành được tổ chức theo 02 cấp (cấp tỉnh và cấp xã).',
    });
  }

  const patternModel = /mô\s*hình\s*chính\s*quyền\s*địa\s*phương\s*3\s*cấp/gi;
  while ((match = patternModel.exec(text)) !== null) {
    issues.push({
      code: 'OUTDATED_MODEL_NUMBER',
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      severity: 'warning',
      suggestedReplacement: 'mô hình chính quyền địa phương 2 cấp',
      reason: 'Mô hình hiện hành là 02 cấp.',
    });
  }

  return {
    triggered: issues.length > 0,
    issues,
    policyVersion: 1,
  };
}

export function applyTwoTierTerminology({ text = '', analysis = null } = {}) {
  if (!analysis || !analysis.triggered || !analysis.issues || analysis.issues.length === 0) {
    return text;
  }

  let result = String(text || '');
  for (const issue of analysis.issues) {
    if (issue.text && issue.suggestedReplacement) {
      result = result.replace(issue.text, issue.suggestedReplacement);
    }
  }
  return result;
}

export function shouldEnforceTwoTierTerminology(normalizeFn, query = '') {
  const n = typeof normalizeFn === 'function' ? normalizeFn(query) : String(query || '').toLowerCase();
  return /(chinh quyen dia phuong|to chuc chinh quyen dia phuong|cap huyen|cap tinh|cap xa|phan cap|phan quyen|uy quyen)/.test(n);
}

export function enforceTwoTierTerminology({
  answer = '',
  query = '',
  normalizeFn,
  isCitation = false,
  isComparison = false,
  isHistorical = false,
} = {}) {
  let text = String(answer || '');
  if (!text.trim()) return text;
  if (!shouldEnforceTwoTierTerminology(normalizeFn, query)) return text;

  const analysis = analyzeTwoTierTerminology({ text, query, isCitation, isComparison, isHistorical });
  return applyTwoTierTerminology({ text, analysis });
}
