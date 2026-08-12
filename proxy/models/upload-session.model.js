/**
 * Upload Session Model
 *
 * Represents a chunked upload session with validation constraints.
 */
'use strict';

class UploadSession {
  /**
   * @param {string} uploadId - Sanitized upload identifier
   * @param {number} totalParts - Expected total number of parts
   * @param {string} originalFilename - Client-declared filename
   * @param {string} uid - Owner UID
   */
  constructor(uploadId, totalParts, originalFilename, uid) {
    if (!uploadId || typeof uploadId !== 'string') throw new Error('uploadId required');
    if (!Number.isInteger(totalParts) || totalParts < 1 || totalParts > 100) {
      throw new Error('totalParts must be integer 1-100');
    }
    this.uploadId = uploadId;
    this.totalParts = totalParts;
    this.originalFilename = originalFilename || 'audio';
    this.uid = uid;
    this.receivedParts = new Set();
    this.createdAt = Date.now();
  }

  /**
   * Register a received part. Rejects duplicates and out-of-range parts.
   * @param {number} partNum - 1-indexed part number
   * @returns {{ accepted: boolean, error?: string }}
   */
  addPart(partNum) {
    if (!Number.isInteger(partNum) || partNum < 1 || partNum > this.totalParts) {
      return { accepted: false, error: `Part ${partNum} out of range [1, ${this.totalParts}]` };
    }
    if (this.receivedParts.has(partNum)) {
      return { accepted: false, error: `Duplicate part ${partNum}` };
    }
    this.receivedParts.add(partNum);
    return { accepted: true };
  }

  isComplete() {
    return this.receivedParts.size === this.totalParts;
  }

  getMissingParts() {
    const missing = [];
    for (let i = 1; i <= this.totalParts; i++) {
      if (!this.receivedParts.has(i)) missing.push(i);
    }
    return missing;
  }

  /** Check if session has expired (15 min timeout) */
  isExpired() {
    return Date.now() - this.createdAt > 15 * 60 * 1000;
  }
}

module.exports = { UploadSession };
