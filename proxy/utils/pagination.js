/**
 * Pagination Utilities (Corrective V2)
 *
 * Implements versioned cursor-based pagination for Firestore collections.
 * Cursors encode (createdAt, docId) to ensure stable ordering.
 *
 * Sorting: created_at DESC, then document ID DESC.
 */
'use strict';

const CURSOR_VERSION = 1;

/**
 * Encode a pagination cursor from a document
 * @param {Object} doc - Firestore document data with created_at and id
 * @returns {string} Base64-encoded versioned cursor
 */
function encodeCursor(doc) {
  const createdAt = doc.created_at?.toDate?.()
    ? doc.created_at.toDate().toISOString()
    : (doc.created_at || new Date().toISOString());
  const payload = JSON.stringify({
    v: CURSOR_VERSION,
    t: createdAt,
    d: doc.id || doc._id,
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
  'id', 'created_at', 'timestamp', 'feature', 'mode',
  'status', 'verified_count', 'evidence_count', 'requestId',
  'effectiveDate', 'user_id',
];

/**
 * Strip unsafe fields from a document for API response
 * @param {Object} doc - Raw Firestore document data
 * @returns {Object} Sanitized document
 */
function sanitizeHistoryDoc(doc) {
  const safe = {};
  for (const field of SAFE_HISTORY_FIELDS) {
    if (doc[field] !== undefined) {
      safe[field] = doc[field];
    }
  }
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
  SAFE_HISTORY_FIELDS,
};
