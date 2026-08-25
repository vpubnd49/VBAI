/**
 * Administrative Divisions Service (Chính quyền địa phương 02 cấp)
 * Synchronized with vpubnd49/vbaibot
 * Data source: Nghị quyết 202/2025/QH15, Nghị quyết 30/2026/QH16, Luật 72/2025/QH15
 */
const fs = require('fs');
const path = require('path');

let adminDataCache = null;

function loadAdminData() {
  if (adminDataCache) return adminDataCache;
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'administrative_divisions.json');
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      adminDataCache = JSON.parse(raw);
      console.log(`[AdminDivisions] Loaded ${adminDataCache.provinces?.length || 0} provinces and metadata successfully.`);
    }
  } catch (err) {
    console.error('[AdminDivisions] Failed to load administrative_divisions.json:', err);
  }
  return adminDataCache || { provinces: [] };
}

function normalizeStr(str = '') {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Search provinces or communes by keyword
 */
function searchAdministrativeDivisions(keyword = '') {
  const data = loadAdminData();
  const normKw = normalizeStr(keyword);
  if (!normKw) return [];

  const results = [];
  const provinces = data.provinces || [];

  for (const prov of provinces) {
    const normPName = normalizeStr(prov.name);
    const normOldP = (prov.oldNames || []).map(normalizeStr);

    let provMatched = normPName.includes(normKw) || normOldP.some(o => o.includes(normKw));
    
    // Check communes
    const matchedCommunes = [];
    for (const com of (prov.communes || [])) {
      const normCName = normalizeStr(com.name);
      const normDist = normalizeStr(com.oldDistrict || '');
      const normOldC = (com.oldNames || []).map(normalizeStr);

      if (normCName.includes(normKw) || normDist.includes(normKw) || normOldC.some(o => o.includes(normKw))) {
        matchedCommunes.push({
          code: com.code,
          name: com.name,
          type: com.type,
          oldDistrict: com.oldDistrict,
          provinceName: prov.name
        });
      }
    }

    if (provMatched || matchedCommunes.length > 0) {
      results.push({
        provinceCode: prov.code,
        provinceName: prov.name,
        provinceType: prov.type,
        oldNames: prov.oldNames,
        communesCount: prov.communes?.length || 0,
        matchedCommunes: matchedCommunes.slice(0, 15),
        legalBasis: data.metadata?.legalBasis || []
      });
    }
  }

  return results;
}

module.exports = {
  loadAdminData,
  searchAdministrativeDivisions
};
