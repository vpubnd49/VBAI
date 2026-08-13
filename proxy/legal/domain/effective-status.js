/**
 * Rules for determining legal effective status without speculation.
 */
const { EFFECTIVE_STATUS, VERIFICATION_STATUS } = require('../constants/legal-status');

function determineEffectiveStatus({ rawStatus, sourceTier, hasExplicitValidityClause, supersededBy }) {
  if (supersededBy && Array.isArray(supersededBy) && supersededBy.length > 0) {
    return {
      effectiveStatus: EFFECTIVE_STATUS.EXPIRED,
      verificationStatus: sourceTier === 'official' ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PARTIAL,
    };
  }

  if (!rawStatus || sourceTier === 'unknown') {
    return {
      effectiveStatus: EFFECTIVE_STATUS.UNKNOWN,
      verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
    };
  }

  const s = String(rawStatus).toLowerCase().trim();

  if (s.includes('hết hiệu lực') || s.includes('het hieu luc') || s.includes('het_hieu_luc') || s.includes('expired') || s.includes('bãi bỏ') || s.includes('bai bo')) {
    return {
      effectiveStatus: EFFECTIVE_STATUS.EXPIRED,
      verificationStatus: (sourceTier === 'official' || sourceTier === 'known_repository') ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PARTIAL,
    };
  }

  if (s.includes('ngưng hiệu lực') || s.includes('ngung hieu luc') || s.includes('ngung_hieu_luc') || s.includes('suspended')) {
    return {
      effectiveStatus: EFFECTIVE_STATUS.SUSPENDED,
      verificationStatus: (sourceTier === 'official' || sourceTier === 'known_repository') ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PARTIAL,
    };
  }

  if (s.includes('còn hiệu lực') || s.includes('con hieu luc') || s.includes('co_hieu_luc') || s.includes('in_force') || s.includes('active') || s.includes('hiện hành')) {
    if (sourceTier === 'official' || sourceTier === 'known_repository' || hasExplicitValidityClause) {
      return {
        effectiveStatus: EFFECTIVE_STATUS.ACTIVE,
        verificationStatus: VERIFICATION_STATUS.VERIFIED,
      };
    }
    return {
      effectiveStatus: EFFECTIVE_STATUS.ACTIVE,
      verificationStatus: VERIFICATION_STATUS.PARTIAL,
    };
  }

  return {
    effectiveStatus: EFFECTIVE_STATUS.UNKNOWN,
    verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
  };
}

module.exports = {
  determineEffectiveStatus,
};
