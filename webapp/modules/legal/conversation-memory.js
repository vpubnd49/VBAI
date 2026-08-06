/**
 * Conversation memory manager for active legal document numbers.
 */
let activeDocumentNumber = null;
let activeDocumentTitle = null;

export function setActiveDocumentContext(docNumber = null, title = null) {
  if (docNumber) activeDocumentNumber = docNumber;
  if (title) activeDocumentTitle = title;
}

export function getActiveDocumentContext() {
  return {
    documentNumber: activeDocumentNumber,
    title: activeDocumentTitle,
  };
}

export function clearActiveDocumentContext() {
  activeDocumentNumber = null;
  activeDocumentTitle = null;
}
