/**
 * VBAI Legal Domain Module Barrel Export.
 */
const sourceHosts = require('./constants/source-hosts');
const documentTypes = require('./constants/document-types');
const legalStatus = require('./constants/legal-status');

const normalizeVietnamese = require('./domain/normalize-vietnamese');
const documentNumber = require('./domain/document-number');
const queryIntent = require('./domain/query-intent');
const queryFreshness = require('./domain/query-freshness');
const sourceTier = require('./domain/source-tier');
const effectiveStatus = require('./domain/effective-status');
const documentRelations = require('./domain/document-relations');
const matchScore = require('./domain/match-score');

const knownDocumentsRepo = require('./repositories/known-documents.repository');
const localMetadataRepo = require('./repositories/local-metadata.repository');

const legalQueryBuilder = require('./services/legal-query-builder');
const legalValidationService = require('./services/legal-validation.service');
const legalMetadataService = require('./services/legal-metadata.service');
const legalSearchMetaService = require('./services/legal-search-meta.service');

module.exports = {
  constants: {
    sourceHosts,
    documentTypes,
    legalStatus,
  },
  domain: {
    normalizeVietnamese,
    documentNumber,
    queryIntent,
    queryFreshness,
    sourceTier,
    effectiveStatus,
    documentRelations,
    matchScore,
  },
  repositories: {
    knownDocumentsRepo,
    localMetadataRepo,
  },
  services: {
    legalQueryBuilder,
    legalValidationService,
    legalMetadataService,
    legalSearchMetaService,
  },
};
