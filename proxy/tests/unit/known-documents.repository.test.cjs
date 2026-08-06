const assert = require('assert');
const {
  loadKnownDocuments,
  findKnownDocumentByNumber,
  findKnownDocumentByAlias,
  validateKnownDocumentRegistry,
} = require('../../legal/repositories/known-documents.repository');

function testKnownDocumentsRepo() {
  const docs = loadKnownDocuments();
  assert.strictEqual(Array.isArray(docs), true);
  assert.strictEqual(docs.length > 0, true);

  const doc = findKnownDocumentByNumber('117/2025/QH15');
  assert.ok(doc);
  assert.strictEqual(doc.document_number, '117/2025/QH15');

  const aliasDoc = findKnownDocumentByAlias('bảo vệ bí mật nhà nước');
  assert.ok(aliasDoc);

  const validation = validateKnownDocumentRegistry();
  assert.strictEqual(validation.valid, true);

  console.log('PASS known-documents.repository.test.cjs');
}

testKnownDocumentsRepo();
