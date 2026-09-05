/**
 * Audio Utilities for VBAI
 * Handles client-side audio conversion to support various formats across providers.
 */

export async function convertToWav(file) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const wavBlob = bufferToWav(audioBuffer);
    return new File([wavBlob], file.name.replace(/\.[^/.]+$/, "") + ".wav", { type: "audio/wav" });
  } catch (error) {
    console.error("Audio conversion failed:", error);
    throw new Error("Không thể chuyển đổi định dạng âm thanh. Vui lòng thử định dạng MP3 hoặc WAV.");
  }
}

function bufferToWav(abuffer) {
  let numOfChan = abuffer.numberOfChannels,
      length = abuffer.length * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < length) {
    for(i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], {type: "audio/wav"});
}

import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Fast offline audio compression using Web Audio API + LAME MP3 encoder.
 * - Files already encoded as WebM/Opus, MP3, M4A, AAC or OGG are returned unchanged.
 * - WAV/PCM files are downsampled and encoded to 32kbps MP3 when above the threshold.
 *
 * @param {File} file - The audio file
 * @param {Object} [opts]
 * @param {number} [opts.thresholdBytes=15*1024*1024] - Compress files larger than this
 * @param {Function} [opts.onProgress] - Progress callback (stage string)
 * @returns {Promise<File>} Compressed MP3 file or original
 */
export async function compressIfLargeWav(file, opts = {}) {
  const threshold = opts.thresholdBytes ?? (15 * 1024 * 1024);
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

  const name = (file.name || '').toLowerCase();
  const isAlreadyCompact =
    name.endsWith('.webm') || name.endsWith('.opus') || name.endsWith('.mp3') || name.endsWith('.m4a') || name.endsWith('.aac') || name.endsWith('.ogg');
  if (isAlreadyCompact) {
    return file;
  }

  // If file is under 5MB and is already compressed format, keep it
  if (file.size < 5 * 1024 * 1024 && !name.endsWith('.wav') && !name.endsWith('.pcm')) {
    return file;
  }

  const origMb = (file.size / 1024 / 1024).toFixed(1);
  console.log(`[Audio Compress] Starting fast offline compression for ${origMb}MB file (${name})...`);
  onProgress(`Đang chuẩn bị nén ${origMb}MB âm thanh...`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    onProgress('Đang giải mã âm thanh...');
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Downsample to 16000 Hz, mono (1 channel) — standard for speech recognition
    const targetSampleRate = 16000;
    const duration = audioBuffer.duration;
    const targetLength = Math.max(1, Math.ceil(duration * targetSampleRate));

    onProgress(`Đang tối ưu tần số 16kHz mono (${Math.round(duration)}s)...`);
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    await audioContext.close().catch(() => {});

    // Get 32-bit float PCM data
    const channelData = renderedBuffer.getChannelData(0);
    const totalSamples = channelData.length;

    // Convert Float32 to Int16
    onProgress('Đang mã hóa MP3 tốc độ cao...');
    const int16Samples = new Int16Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Encode to MP3 using lamejs at 32 kbps (approx 14MB/hour, perfect for speech)
    const kbps = 32;
    const encoder = new Mp3Encoder(1, targetSampleRate, kbps);
    const mp3Chunks = [];
    const chunkSize = 1152 * 10;

    for (let i = 0; i < totalSamples; i += chunkSize) {
      const endIdx = Math.min(i + chunkSize, totalSamples);
      const chunk = int16Samples.subarray(i, endIdx);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf);
      }
      if (i % (chunkSize * 25) === 0) {
        const pct = Math.round((i / totalSamples) * 100);
        onProgress(`Đang nén MP3: ${pct}%...`);
      }
    }

    const flushBuf = encoder.flush();
    if (flushBuf.length > 0) {
      mp3Chunks.push(flushBuf);
    }

    const mp3Blob = new Blob(mp3Chunks, { type: 'audio/mp3' });
    const newFileName = (file.name || 'audio').replace(/\.[^/.]+$/, '') + '.mp3';
    const compressedFile = new File([mp3Blob], newFileName, { type: 'audio/mp3' });

    const newMb = (compressedFile.size / 1024 / 1024).toFixed(1);
    const ratio = ((1 - compressedFile.size / file.size) * 100).toFixed(0);
    console.log(`[Audio Compress] Completed: ${origMb}MB → ${newMb}MB (giảm ${ratio}%)`);
    onProgress(`Nén hoàn tất: ${newMb}MB (giảm ${ratio}%)`);

    return compressedFile;
  } catch (err) {
    console.error('[Audio Compress] Error during compression, falling back to original:', err);
    onProgress('Không thể nén âm thanh, dùng tệp gốc...');
    return file;
  }
}

