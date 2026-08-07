/**
 * Legal Cross-Reference Resolution Service.
 * Resolves dependencies and document relationships (amends, replaces, repeals).
 */
const { extractFullDocumentNumber } = require('../domain/document-number');
const { parseDocumentRelations } = require('../domain/document-relations');

function resolveCrossReferences(documentList = []) {
  const map = new Map();
  const graph = {
    nodes: [],
    edges: [],
  };

  for (const doc of documentList) {
    const docNum = doc.documentNumber || extractFullDocumentNumber(doc.title || '');
    if (docNum) {
      map.set(docNum.toUpperCase(), doc);
    }
  }

  for (const doc of documentList) {
    const text = `${doc.title || ''} ${doc.snippet || ''}`;
    const relations = parseDocumentRelations(text);
    const docNum = doc.documentNumber || extractFullDocumentNumber(doc.title || '');

    graph.nodes.push({
      id: doc.id,
      documentNumber: docNum,
      title: doc.title,
      relations,
    });

    if (docNum) {
      for (const relNum of relations.replaces) {
        graph.edges.push({ from: docNum, to: relNum, type: 'REPLACES' });
      }
      for (const relNum of relations.amends) {
        graph.edges.push({ from: docNum, to: relNum, type: 'AMENDS' });
      }
      for (const relNum of relations.repeals) {
        graph.edges.push({ from: docNum, to: relNum, type: 'REPEALS' });
      }
    }
  }

  return graph;
}

module.exports = {
  resolveCrossReferences,
};
