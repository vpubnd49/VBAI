/**
 * Upload Configuration Constants
 *
 * Centralized upload limits, validated at require-time.
 */
'use strict';

const DEFAULT_MAX_AUDIO_UPLOAD_MB = 25;
const ABSOLUTE_MAX_AUDIO_UPLOAD_MB = 50;

const _configuredMB = Number(process.env.MAX_AUDIO_UPLOAD_MB || String(DEFAULT_MAX_AUDIO_UPLOAD_MB));

let MAX_AUDIO_UPLOAD_MB;
if (_configuredMB > ABSOLUTE_MAX_AUDIO_UPLOAD_MB) {
  console.warn(
    `[UPLOAD] MAX_AUDIO_UPLOAD_MB=${_configuredMB} exceeds absolute cap ${ABSOLUTE_MAX_AUDIO_UPLOAD_MB}. Clamping.`
  );
  MAX_AUDIO_UPLOAD_MB = ABSOLUTE_MAX_AUDIO_UPLOAD_MB;
} else if (_configuredMB > 0) {
  MAX_AUDIO_UPLOAD_MB = _configuredMB;
} else {
  MAX_AUDIO_UPLOAD_MB = DEFAULT_MAX_AUDIO_UPLOAD_MB;
}

const MAX_AUDIO_UPLOAD_BYTES = MAX_AUDIO_UPLOAD_MB * 1024 * 1024;

module.exports = {
  DEFAULT_MAX_AUDIO_UPLOAD_MB,
  ABSOLUTE_MAX_AUDIO_UPLOAD_MB,
  MAX_AUDIO_UPLOAD_MB,
  MAX_AUDIO_UPLOAD_BYTES,
};
