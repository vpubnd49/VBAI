/**
 * Official search query builder for legal documents.
 */
const { OFFICIAL_SOURCE_HOSTS } = require('../constants/source-hosts');
const { extractFullDocumentNumber } = require('../domain/document-number');

function buildOfficialQuery(queryText = '') {
  const docNumber = extractFullDocumentNumber(queryText);
  let baseQuery = queryText.trim();

  if (docNumber) {
    baseQuery = `"${docNumber}" ${baseQuery.replace(docNumber, '').trim()}`.trim();
  }

  const siteFilters = OFFICIAL_SOURCE_HOSTS.slice(0, 4)
    .map((host) => `site:${host}`)
    .join(' OR ');

  return {
    docNumber,
    officialQuery: `(${siteFilters}) ${baseQuery}`,
    rawQuery: baseQuery,
  };
}

module.exports = {
  buildOfficialQuery,
};
