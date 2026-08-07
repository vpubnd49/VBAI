/**
 * Legal Citation Validation Service.
 * Validates inline model citations against the retrieved server-side evidence bundle to prevent hallucinations.
 */
const { extractFullDocumentNumber } = require('../domain/document-number');
const { parseArticleCoordinate } = require('../domain/article-coordinate');

function validateCitations(answerText = '', evidenceBundle = {}) {
  const documents = Array.isArray(evidenceBundle.documents) ? evidenceBundle.documents : [];

  // Build document lookup map supporting documentNumber, title, and 1-based index
  const docMap = new Map();
  documents.forEach((doc, idx) => {
    if (doc.documentNumber) {
      docMap.set(String(doc.documentNumber).trim().toUpperCase(), doc);
    }
    const extractedNum = extractFullDocumentNumber(doc.documentNumber || doc.title || '');
    if (extractedNum) {
      docMap.set(extractedNum.toUpperCase(), doc);
    }
    if (doc.title) {
      docMap.set(String(doc.title).trim().toUpperCase(), doc);
    }
    docMap.set(String(idx + 1), doc);
  });

  // Extract citation regex patterns like [1], [Nghị định 30/2020/NĐ-CP], [Điều 138], etc.
  const citationMatches = answerText.match(/\[([^\]]+)\]/g) || [];
  const citations = [];
  let validCount = 0;
  let unverifiedCount = 0;

  for (const match of citationMatches) {
    const content = match.replace(/^\[|\]$/g, '').trim();
    const docNum = extractFullDocumentNumber(content);
    const articleCoord = parseArticleCoordinate(content);

    let matchedDoc = null;
    let matchedDocNum = null;

    if (docNum) {
      matchedDocNum = docNum.toUpperCase();
      matchedDoc = docMap.get(matchedDocNum) || docMap.get(content.toUpperCase()) || null;
    } else {
      matchedDoc = docMap.get(content.toUpperCase()) || null;
      if (!matchedDoc) {
        const numIndex = parseInt(content, 10);
        if (!isNaN(numIndex)) {
          matchedDoc = docMap.get(String(numIndex)) || null;
        }
      }
      if (matchedDoc) {
        matchedDocNum = (matchedDoc.documentNumber || matchedDoc.title || '').toUpperCase();
      }
    }

    const citationMatchesEvidence = Boolean(matchedDoc);
    const sourceTier = matchedDoc ? (matchedDoc.sourceTier || 'unknown') : 'unknown';
    const rawVerificationStatus = matchedDoc ? (matchedDoc.verificationStatus || 'unverified') : 'unverified';
    const evidenceVerificationStatus = (sourceTier === 'official' || rawVerificationStatus === 'VERIFIED' || rawVerificationStatus === 'verified')
      ? 'verified'
      : (sourceTier === 'reference' ? 'partial' : 'unverified');

    // Article/Clause specific check
    let articleVerified = true;
    if (articleCoord.article && matchedDoc) {
      const docCoord = matchedDoc.coordinate || {};
      if (docCoord.article && docCoord.article !== articleCoord.article) {
        articleVerified = false;
      }
    }

    // A citation is VERIFIED only if: it matches server evidence, source is official verified, and article (if specified) matches
    const isVerified = citationMatchesEvidence && evidenceVerificationStatus === 'verified' && articleVerified;
    const isValid = citationMatchesEvidence;

    if (isVerified) {
      validCount++;
    } else {
      unverifiedCount++;
    }

    citations.push({
      raw: match,
      content,
      extractedDocumentNumber: docNum || matchedDocNum,
      isValid,
      evidenceId: matchedDoc ? (matchedDoc.id || null) : null,
      matchedDocumentNumber: matchedDocNum,
      citationMatchesEvidence,
      evidenceVerificationStatus,
      verified: isVerified,
      articleVerified,
    });
  }

  return {
    totalCitations: citations.length,
    validCitationsCount: validCount,
    unverifiedCitationsCount: unverifiedCount,
    isFullyVerified: citations.length > 0 && unverifiedCount === 0,
    citations,
  };
}

module.exports = {
  validateCitations,
};
