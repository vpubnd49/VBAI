/**
 * Pagination Utilities (Corrective V2)
 *
 * Implements versioned cursor-based pagination for MongoDB collections.
 * Cursors encode (timestamp, document ID) to ensure stable ordering.
 *
 * Sorting: created_at DESC, then document ID DESC.
 */
'use strict';

const CURSOR_VERSION = 1;

/**
 * Encode a pagination cursor from a document
 * @param {Object} doc - MongoDB document data with created_at/timestamp and id
 * @returns {string} Base64-encoded versioned cursor
 */
function encodeCursor(doc) {
  const rawCreatedAt = doc.created_at ?? doc.timestamp;
  const createdAt = rawCreatedAt?.toDate?.()
    ? rawCreatedAt.toDate().toISOString()
    : (rawCreatedAt instanceof Date ? rawCreatedAt.toISOString() : (rawCreatedAt || new Date().toISOString()));
  const payload = JSON.stringify({
    v: CURSOR_VERSION,
    t: new Date(createdAt).toISOString(),
    d: String(doc.id || doc._id || ''),
  });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode a pagination cursor
 * @param {string} cursor - Base64-encoded cursor string
 * @returns {{ createdAt: string, docId: string } | null}
 */
function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!payload || payload.v !== CURSOR_VERSION) return null;
    if (!payload.t || !payload.d) return null;
    return { createdAt: payload.t, docId: payload.d };
  } catch (_) {
    return null;
  }
}

/**
 * Validate a cursor string
 * @param {string} cursor
 * @returns {{ valid: boolean, error?: string, decoded?: object }}
 */
function validateCursor(cursor) {
  if (!cursor) return { valid: true };
  const decoded = decodeCursor(cursor);
  if (!decoded) {
    return { valid: false, error: 'Invalid or expired pagination cursor' };
  }
  return { valid: true, decoded };
}

/**
 * Safe field allowlist for search history responses.
 * Strips prompt, email, token, and provider payloads.
 */
const SAFE_HISTORY_FIELDS = [
  // Audit metadata only. Never return raw prompts, email addresses, or provider payloads.
  'id', 'created_at', 'timestamp', 'feature', 'mode',
  'status', 'verified_count', 'evidence_count', 'verifiedEvidenceCount', 'totalEvidenceCount',
  'requestId', 'effectiveDate', 'model', 'errorMessage', 'user_id', 'query', 'query_preview', 'user_email',
];

/**
 * Strip unsafe fields from a document for API response
 * @param {Object} doc - Raw MongoDB document data
 * @returns {Object} Sanitized document
 */
function sanitizeAuditQuery(value = '') {
  return Array.from(String(value || '').replace(/[\r\n\t]+/g, ' ').trim())
    .slice(0, 1000)
    .join('');
}

function sanitizeHistoryDoc(doc, { includeAdminEmail = false } = {}) {
  const safe = {};
  for (const field of SAFE_HISTORY_FIELDS) {
    if (field === 'user_email' && !includeAdminEmail) continue;
    if (doc[field] !== undefined) safe[field] = doc[field];
  }
  if (safe.query !== undefined) safe.query = sanitizeAuditQuery(safe.query);
  if (safe.query_preview !== undefined) safe.query_preview = sanitizeAuditQuery(safe.query_preview);
  // Format timestamps
  if (safe.created_at?.toDate) {
    safe.created_at = safe.created_at.toDate().toISOString();
  }
  if (safe.timestamp?.toDate) {
    safe.timestamp = safe.timestamp.toDate().toISOString();
  }
  return safe;
}

module.exports = {
  CURSOR_VERSION,
  encodeCursor,
  decodeCursor,
  validateCursor,
  sanitizeHistoryDoc,
  sanitizeAuditQuery,
  SAFE_HISTORY_FIELDS,
};
