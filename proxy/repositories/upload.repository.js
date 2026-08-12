/**
 * Upload Repository
 *
 * Stateless utility functions for temporary audio file management and streaming.
 * Process-local session Maps removed for Cloud Run multi-instance safety.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { cleanupTempFile, cleanupChunks, assembleChunksStream } = require('../middleware/upload-security');

const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'vbai-transcribe-uploads');
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

/**
 * Get the chunk file path for a specific part
 */
function getChunkPath(uploadId, partNum) {
  return path.join(UPLOAD_TEMP_DIR, `chunk_${uploadId}_part${partNum}`);
}

/**
 * Get the assembled file path
 */
function getAssembledPath(uploadId) {
  return path.join(UPLOAD_TEMP_DIR, `assembled_${uploadId}`);
}

/**
 * Save a chunk from a stream (the multer temp file) to the chunk storage
 */
async function saveChunk(uploadId, partNum, sourcePath) {
  const destPath = getChunkPath(uploadId, partNum);
  const readStream = fs.createReadStream(sourcePath);
  const writeStream = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
  });
  return destPath;
}

module.exports = {
  UPLOAD_TEMP_DIR,
  getChunkPath,
  getAssembledPath,
  saveChunk,
  assembleChunksStream,
  cleanupTempFile,
  cleanupChunks,
};
