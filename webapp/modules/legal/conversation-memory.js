/**
 * Conversation memory manager — Enhanced edition.
 * Tracks active documents, topics, key conclusions, and provides rolling summaries.
 * Persists to sessionStorage so context survives page re-renders.
 */

const STORAGE_KEY = 'vbai_conversation_memory_v2';

// --- State ---
let activeDocuments = [];       // List of {docNumber, title, addedAt}
let activeTopic = null;         // Current discussion topic string
let keyConclusions = [];        // List of {text, docNumber, addedAt}
let rollingSummary = '';        // Compressed summary of older turns

const MAX_ACTIVE_DOCS = 10;
const MAX_CONCLUSIONS = 15;
const MAX_SUMMARY_LENGTH = 2000; // chars

// --- Persistence ---
function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.activeDocuments)) activeDocuments = data.activeDocuments.slice(0, MAX_ACTIVE_DOCS);
    if (typeof data.activeTopic === 'string') activeTopic = data.activeTopic;
    if (Array.isArray(data.keyConclusions)) keyConclusions = data.keyConclusions.slice(0, MAX_CONCLUSIONS);
    if (typeof data.rollingSummary === 'string') rollingSummary = data.rollingSummary.slice(0, MAX_SUMMARY_LENGTH);
  } catch {}
}

function saveToStorage() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeDocuments,
      activeTopic,
      keyConclusions,
      rollingSummary,
    }));
  } catch {}
}

// Initialize from storage on load
loadFromStorage();

// --- Active Documents ---

/**
 * Track a document that was discussed or looked up.
 * Deduplicates by docNumber, moves existing to top.
 */
export function trackDocument(docNumber = null, title = null) {
  if (!docNumber) return;
  const normalized = String(docNumber).trim().toUpperCase();
  // Remove if already tracked (to re-add at top)
  activeDocuments = activeDocuments.filter(d => d.docNumber !== normalized);
  activeDocuments.unshift({
    docNumber: normalized,
    title: title || null,
    addedAt: Date.now(),
  });
  // Enforce max
  if (activeDocuments.length > MAX_ACTIVE_DOCS) {
    activeDocuments = activeDocuments.slice(0, MAX_ACTIVE_DOCS);
  }
  saveToStorage();
}

/**
 * Get the most recently discussed document (backward compat).
 */
export function getActiveDocumentContext() {
  const top = activeDocuments[0] || null;
  return {
    documentNumber: top?.docNumber || null,
    title: top?.title || null,
  };
}

/**
 * Get all tracked documents.
 */
export function getAllTrackedDocuments() {
  return [...activeDocuments];
}

/**
 * Legacy setter — wraps trackDocument for backward compatibility.
 */
export function setActiveDocumentContext(docNumber = null, title = null) {
  if (docNumber) trackDocument(docNumber, title);
}

// --- Topic ---

export function setActiveTopic(topic = null) {
  activeTopic = topic ? String(topic).trim() : null;
  saveToStorage();
}

export function getActiveTopic() {
  return activeTopic;
}

// --- Key Conclusions ---

/**
 * Record a key conclusion from the AI response.
 * Example: "NĐ 30/2020/NĐ-CP còn hiệu lực"
 */
export function addConclusion(text = '', docNumber = null) {
  const clean = String(text || '').trim();
  if (!clean) return;
  // Avoid duplicates
  if (keyConclusions.some(c => c.text === clean)) return;
  keyConclusions.unshift({
    text: clean,
    docNumber: docNumber ? String(docNumber).trim().toUpperCase() : null,
    addedAt: Date.now(),
  });
  if (keyConclusions.length > MAX_CONCLUSIONS) {
    keyConclusions = keyConclusions.slice(0, MAX_CONCLUSIONS);
  }
  saveToStorage();
}

export function getConclusions() {
  return [...keyConclusions];
}

// --- Rolling Summary ---

/**
 * Update the rolling summary with compressed older context.
 * Called when conversation turns exceed the window.
 */
export function updateRollingSummary(summaryText = '') {
  const clean = String(summaryText || '').trim();
  if (!clean) return;
  rollingSummary = clean.slice(0, MAX_SUMMARY_LENGTH);
  saveToStorage();
}

export function getRollingSummary() {
  return rollingSummary;
}

// --- Build context block for AI ---

/**
 * Build a structured context block to inject into the system prompt.
 * This gives the AI awareness of the entire conversation state.
 */
export function buildMemoryContextBlock() {
  const parts = [];

  // Rolling summary from older turns
  if (rollingSummary) {
    parts.push(`[TÓM TẮT CUỘC TRÒ CHUYỆN TRƯỚC ĐÓ]\n${rollingSummary}`);
  }

  // Active topic
  if (activeTopic) {
    parts.push(`[CHỦ ĐỀ ĐANG THẢO LUẬN]\n${activeTopic}`);
  }

  // Tracked documents
  if (activeDocuments.length > 0) {
    const docLines = activeDocuments.map((d, i) =>
      `${i + 1}. ${d.docNumber}${d.title ? ` — ${d.title}` : ''}`
    ).join('\n');
    parts.push(`[CÁC VĂN BẢN ĐÃ TRA CỨU TRONG PHIÊN NÀY]\n${docLines}`);
  }

  // Key conclusions
  if (keyConclusions.length > 0) {
    const concLines = keyConclusions.slice(0, 8).map((c, i) =>
      `${i + 1}. ${c.text}${c.docNumber ? ` (${c.docNumber})` : ''}`
    ).join('\n');
    parts.push(`[KẾT LUẬN CHÍNH ĐÃ XÁC NHẬN]\n${concLines}`);
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n\n') : '';
}

// --- Reset ---

export function clearActiveDocumentContext() {
  activeDocuments = [];
  activeTopic = null;
  keyConclusions = [];
  rollingSummary = '';
  saveToStorage();
}
