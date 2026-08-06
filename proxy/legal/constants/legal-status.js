/**
 * Legal effective status and verification status constants.
 */
const EFFECTIVE_STATUS = Object.freeze({
  ACTIVE: 'co_hieu_luc',
  EXPIRED: 'het_hieu_luc',
  PARTIALLY_EXPIRED: 'het_hieu_luc_mot_phan',
  SUSPENDED: 'ngung_hieu_luc',
  UNKNOWN: 'unknown',
});

const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
  PARTIAL: 'partial',
});

const REVIEW_STATE = Object.freeze({
  DRAFT: 'draft',
  REVIEWED: 'reviewed',
  PUBLISHED: 'published',
});

module.exports = {
  EFFECTIVE_STATUS,
  VERIFICATION_STATUS,
  REVIEW_STATE,
};
