/**
 * Hot index service for real-time document updates.
 */
const HOT_INDEX_STORE = new Map();
const HOT_INDEX_TTL_MS = 21600000; // 6 hours

function addHotIndexItem(docNumber = '', data = {}) {
  if (!docNumber) return;
  HOT_INDEX_STORE.set(docNumber.trim().toUpperCase(), {
    data,
    addedAt: Date.now(),
  });
}

function getHotIndexItem(docNumber = '') {
  if (!docNumber) return null;
  const key = docNumber.trim().toUpperCase();
  const item = HOT_INDEX_STORE.get(key);
  if (!item) return null;
  if (Date.now() - item.addedAt > HOT_INDEX_TTL_MS) {
    HOT_INDEX_STORE.delete(key);
    return null;
  }
  return item.data;
}

function invalidateHotIndexItem(docNumber = '') {
  if (!docNumber) return;
  HOT_INDEX_STORE.delete(docNumber.trim().toUpperCase());
}

module.exports = {
  addHotIndexItem,
  getHotIndexItem,
  invalidateHotIndexItem,
};
