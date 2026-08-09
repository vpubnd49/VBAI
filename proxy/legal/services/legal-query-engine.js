/**
 * Legal Query Engine — Central orchestrator for the Legal Research Copilot.
 */
const { detectQueryIntent, INTENT_TYPES } = require('../domain/query-intent');
const { extractLegalEntities } = require('../domain/legal-entity-extractor');
const { parseArticleCoordinate } = require('../domain/article-coordinate');
const { findKnownDocumentByAlias, findByPartialNumber, findByTopicInBosung } = require('../repositories/known-documents.repository');
const { getDocumentMetadata } = require('./answer-validator');
const { buildEvidenceBundle } = require('./evidence-bundle.service');
const { resolveCrossReferences } = require('./cross-reference.service');

async function processLegalQuery({ query, conversationContext = {}, effectiveDate = null, mode = null }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      success: false,
      error: 'Query is required',
      intent: null,
      entities: null,
      documents: [],
      citations: [],
      articles: [],
    };
  }

  const trimmedQuery = query.trim();

  // Step 1: Intent classification
  const intent = detectQueryIntent(trimmedQuery);

  // Step 2: Entity extraction
  const entities = extractLegalEntities(trimmedQuery);

  // Step 3: Document resolution — cascading strategy
  let effectiveDocNumber = null;
  let documentMetadata = null;
  let resolutionMethod = null;
  let candidateDocuments = [];

  // 3a: Full document number
  if (entities.hasDocumentRef) {
    effectiveDocNumber = entities.documentNumbers[0].normalized;
    documentMetadata = getDocumentMetadata(effectiveDocNumber);
    resolutionMethod = 'full_number';
  }

  // 3b: Intent-extracted doc number
  if (!documentMetadata && intent.docNumber) {
    effectiveDocNumber = intent.docNumber;
    documentMetadata = getDocumentMetadata(effectiveDocNumber);
    resolutionMethod = 'intent_number';
  }

  // 3c: Bare number + document type (e.g., "luật số 72")
  if (!documentMetadata && entities.hasBareNumberRef) {
    for (const candidate of entities.bareNumberCandidates) {
      const yearFilter = entities.years.length > 0 ? entities.years[0] : null;
      const matches = findByPartialNumber(candidate.number, candidate.docType, yearFilter);

      if (matches.length === 1) {
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = getDocumentMetadata(effectiveDocNumber) || matches[0];
        resolutionMethod = 'bare_number_exact';
      } else if (matches.length > 1) {
        candidateDocuments = matches;
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = getDocumentMetadata(effectiveDocNumber) || matches[0];
        resolutionMethod = 'bare_number_multiple';
      }
      if (effectiveDocNumber) break;
    }
  }

  // 3d: Partial number (e.g., "72/2025")
  if (!documentMetadata && entities.hasPartialRef) {
    for (const partial of entities.partialDocumentNumbers) {
      const docType = entities.documentType?.type || null;
      const matches = findByPartialNumber(partial.number, docType, parseInt(partial.year, 10));
      if (matches.length >= 1) {
        effectiveDocNumber = matches[0].documentNumber;
        documentMetadata = getDocumentMetadata(effectiveDocNumber) || matches[0];
        resolutionMethod = matches.length === 1 ? 'partial_number_exact' : 'partial_number_multiple';
        if (matches.length > 1) candidateDocuments = matches;
        break;
      }
    }
  }

  // 3e: Alias search
  if (!documentMetadata) {
    const knownDoc = findKnownDocumentByAlias(trimmedQuery);
    if (knownDoc) {
      effectiveDocNumber = knownDoc.document_number;
      documentMetadata = getDocumentMetadata(effectiveDocNumber);
      resolutionMethod = 'alias';
    }
  }

  // 3f: Topic search
  if (!documentMetadata && entities.topics.length > 0) {
    for (const topic of entities.topics) {
      const topicMatches = findByTopicInBosung(topic);
      if (topicMatches.length > 0) {
        let filtered = topicMatches;
        if (entities.documentType) {
          filtered = topicMatches.filter(d => d.documentType === entities.documentType.type);
        }
        const results = filtered.length > 0 ? filtered : topicMatches;
        if (results.length === 1) {
          effectiveDocNumber = results[0].documentNumber;
          documentMetadata = getDocumentMetadata(effectiveDocNumber) || results[0];
          resolutionMethod = 'topic_exact';
        } else if (results.length > 1) {
          candidateDocuments = results;
          effectiveDocNumber = results[0].documentNumber;
          documentMetadata = getDocumentMetadata(effectiveDocNumber) || results[0];
          resolutionMethod = 'topic_multiple';
        }
        if (effectiveDocNumber) break;
      }
    }
  }

  // 3g: Conversation context fallback
  const contextDocNum = conversationContext?.activeDocument || conversationContext?.documentNumber || null;
  if (!effectiveDocNumber && contextDocNum && entities.hasArticleRef) {
    effectiveDocNumber = contextDocNum;
    documentMetadata = getDocumentMetadata(effectiveDocNumber);
    resolutionMethod = 'conversation_context';
  }

  const articleCoord = parseArticleCoordinate(trimmedQuery);

  const documents = [];
  if (documentMetadata) {
    documents.push({
      id: effectiveDocNumber,
      documentNumber: effectiveDocNumber,
      title: documentMetadata.title || '',
      issuer: documentMetadata.issuer || '',
      issueDate: documentMetadata.issueDate || null,
      effectiveDate: documentMetadata.effectiveDate || null,
      effectiveStatus: documentMetadata.effectiveStatus || 'unknown',
      replacements: documentMetadata.replacements || [],
      documentType: documentMetadata.documentType || '',
      summary: typeof documentMetadata.summary === 'string'
        ? documentMetadata.summary
        : (Array.isArray(documentMetadata.summary) ? documentMetadata.summary.join(' ') : ''),
      chapterArticleSummary: documentMetadata.chapterArticleSummary || '',
      verified: documentMetadata.verified || false,
      source: documentMetadata.source || 'unknown',
    });
  }

  const citations = [];
  if (entities.hasArticleRef && effectiveDocNumber) {
    for (const ref of entities.articleReferences) {
      citations.push({
        id: `SRC-${citations.length + 1}`,
        documentNumber: effectiveDocNumber,
        type: ref.type,
        value: ref.value,
        label: ref.type === 'article' ? `Điều ${ref.value}`
          : ref.type === 'clause' ? `Khoản ${ref.value}`
          : ref.type === 'point' ? `Điểm ${ref.value}`
          : ref.raw,
        documentTitle: documentMetadata?.title || '',
      });
    }
  }

  const evidenceBundle = buildEvidenceBundle(trimmedQuery, documents.map(d => ({
    title: d.title,
    documentNumber: d.documentNumber,
    effectiveStatus: d.effectiveStatus,
    source: d.source,
  })));
  const crossReferences = resolveCrossReferences(documents);

  const warnings = [];
  if (effectiveDocNumber && !documentMetadata) {
    warnings.push(`Văn bản số ${effectiveDocNumber} chưa có trong cơ sở dữ liệu hệ thống.`);
  }

  const retrievalContext = buildRetrievalContext({
    documents,
    citations,
    articleCoord,
    evidenceBundle,
    crossReferences,
    conversationContext,
    candidateDocuments,
    warnings,
  });

  return {
    success: true,
    query: trimmedQuery,
    intent,
    entities,
    effectiveDocNumber,
    document: documents.length > 0 ? documents[0] : null,
    documents,
    citations,
    articles: entities.articleReferences,
    warnings,
    evidenceBundle,
    crossReferences,
    retrievalContext,
    resolutionMethod,
    candidateDocuments: candidateDocuments.map(c => ({
      documentNumber: c.documentNumber,
      title: c.title,
      documentType: c.documentType,
      issuer: c.issuer,
      effectiveStatus: c.effectiveStatus,
    })),
    followUps: [
      `Điều 1 của ${documents[0]?.title || 'văn bản này'} quy định về vấn đề gì?`,
      `Văn bản này hiện có còn hiệu lực không?`
    ],
    conversationUpdate: {
      activeDocument: effectiveDocNumber || contextDocNum || null,
      activeArticle: entities.hasArticleRef
        ? entities.articleReferences.find(r => r.type === 'article')?.value || conversationContext?.activeArticle
        : conversationContext?.activeArticle || null,
      activeTopic: documentMetadata?.title || conversationContext?.activeTopic || conversationContext?.documentTitle || null,
    },
  };
}

function buildRetrievalContext({ documents, citations, articleCoord, evidenceBundle, crossReferences, conversationContext, candidateDocuments, warnings }) {
  const parts = [];

  if (documents.length > 0) {
    for (const doc of documents) {
      parts.push(`--- VAN BAN: ${doc.documentNumber} ---`);
      if (doc.title) parts.push(`Ten: ${doc.title}`);
      if (doc.documentType) parts.push(`Loai: ${doc.documentType}`);
      if (doc.issuer) parts.push(`Co quan ban hanh: ${doc.issuer}`);
      if (doc.issueDate) parts.push(`Ngay ban hanh: ${doc.issueDate}`);
      if (doc.effectiveDate) parts.push(`Ngay hieu luc: ${doc.effectiveDate}`);
      if (doc.effectiveStatus) parts.push(`Tinh trang: ${doc.effectiveStatus}`);
      if (doc.summary) parts.push(`Tom tat: ${typeof doc.summary === 'string' ? doc.summary : ''}`);
      if (doc.chapterArticleSummary) parts.push(`Cau truc chuong/dieu:\n${doc.chapterArticleSummary}`);
      parts.push('');
    }
  }

  if (citations.length > 0) {
    parts.push('--- TRICH DAN ---');
    for (const cit of citations) {
      parts.push(`${cit.label} (${cit.documentNumber})`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

module.exports = {
  processLegalQuery,
  buildRetrievalContext,
};
