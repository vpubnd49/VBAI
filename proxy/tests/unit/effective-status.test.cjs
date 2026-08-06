const assert = require('assert');
const { determineEffectiveStatus } = require('../../legal/domain/effective-status');
const { EFFECTIVE_STATUS, VERIFICATION_STATUS } = require('../../legal/constants/legal-status');

function testEffectiveStatus() {
  // Test rule 5: Unknown when source is unverified / unknown
  const res1 = determineEffectiveStatus({ rawStatus: null, sourceTier: 'unknown' });
  assert.strictEqual(res1.effectiveStatus, EFFECTIVE_STATUS.UNKNOWN);
  assert.strictEqual(res1.verificationStatus, VERIFICATION_STATUS.UNVERIFIED);

  // Test expired
  const res2 = determineEffectiveStatus({ rawStatus: 'hết hiệu lực', sourceTier: 'official' });
  assert.strictEqual(res2.effectiveStatus, EFFECTIVE_STATUS.EXPIRED);
  assert.strictEqual(res2.verificationStatus, VERIFICATION_STATUS.VERIFIED);

  // Test active from official source
  const res3 = determineEffectiveStatus({ rawStatus: 'còn hiệu lực', sourceTier: 'official' });
  assert.strictEqual(res3.effectiveStatus, EFFECTIVE_STATUS.ACTIVE);
  assert.strictEqual(res3.verificationStatus, VERIFICATION_STATUS.VERIFIED);

  console.log('PASS effective-status.test.cjs');
}

testEffectiveStatus();
