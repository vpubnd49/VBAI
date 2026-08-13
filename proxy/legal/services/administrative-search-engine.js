/**
 * VBAI Legal Pro V2 — Administrative Search Engine (Lâm Đồng & VN Geography / CCHC)
 * Integrates tracuuhanhchinhvn skill reference datasets:
 * - Lâm Đồng 6 new Departments (Resolutions 390-395/NQ-HĐND dated 18/02/2025, operational 01/03/2025)
 * - Administrative 34 provincial boundaries
 * - PAR Index / SIPAS / PAPI / PCI / 766 CCHC indicators
 */
const fs = require('fs');
const path = require('path');
const { normalizeVietnamese } = require('../domain/normalize-vietnamese');

let lamDongData = null;
let geographyData = null;
let cchcData = null;

function loadAdminData() {
  if (lamDongData && geographyData && cchcData) {
    return { lamDongData, geographyData, cchcData };
  }

  const baseDir = path.join(__dirname, '..', '..', '..', 'tracuuhanhchinhvn', 'references');
  try {
    const lamDongFile = path.join(baseDir, 'lam_dong_organization.json');
    if (fs.existsSync(lamDongFile)) {
      lamDongData = JSON.parse(fs.readFileSync(lamDongFile, 'utf8'));
    }
  } catch (e) {
    console.warn('[admin-search-engine] Failed to load lam_dong_organization.json:', e.message);
  }

  try {
    const geoFile = path.join(baseDir, 'geography_34.json');
    if (fs.existsSync(geoFile)) {
      geographyData = JSON.parse(fs.readFileSync(geoFile, 'utf8'));
    }
  } catch (e) {
    console.warn('[admin-search-engine] Failed to load geography_34.json:', e.message);
  }

  try {
    const cchcFile = path.join(baseDir, 'cchc_snapshot_2025.json');
    if (fs.existsSync(cchcFile)) {
      cchcData = JSON.parse(fs.readFileSync(cchcFile, 'utf8'));
    }
  } catch (e) {
    console.warn('[admin-search-engine] Failed to load cchc_snapshot_2025.json:', e.message);
  }

  return { lamDongData, geographyData, cchcData };
}

function detectAdminSearchContext(queryText = '') {
  if (!queryText) return null;
  const norm = normalizeVietnamese(queryText);
  const { lamDongData, geographyData, cchcData } = loadAdminData();

  const isLamDong = norm.includes('lam dong') || norm.includes('dalat') || norm.includes('da lat');
  const isDepartment = /(?:sở|so|ban|nghị quyết 39|390|391|392|393|394|395|hợp nhất|sắp xếp|tôn giáo)/i.test(queryText);
  const isCCHC = /(?:par index|sipas|papi|pci|chỉ số|766|cchc|cải cách hành chính)/i.test(queryText);
  const isGeo = /(?:tỉnh|thành phố|địa giới|huyện|xã|34 tỉnh|34 thành)/i.test(queryText);

  if (!isLamDong && !isDepartment && !isCCHC && !isGeo) return null;

  const matchedDepartments = [];
  if (lamDongData && lamDongData.records) {
    for (const record of lamDongData.records) {
      const matchName = normalizeVietnamese(record.canonical_name);
      const matchShort = normalizeVietnamese(record.short_name);
      const matchOld = record.old_entities ? record.old_entities.some(old => norm.includes(normalizeVietnamese(old))) : false;

      if (norm.includes(matchShort) || norm.includes(matchName) || matchOld || (isLamDong && isDepartment)) {
        matchedDepartments.push(record);
      }
    }
  }

  return {
    isLamDong,
    isDepartment,
    isCCHC,
    isGeo,
    matchedDepartments,
    lamDongScopeNote: lamDongData ? lamDongData.scope_note : '',
    cchcSnapshot: cchcData ? cchcData.snapshot_note || cchcData.metrics : null
  };
}

function buildAdminSearchPrompt(adminContext, userQuery = '') {
  if (!adminContext) return '';

  const lines = [
    `\n\n=== HỆ THỐNG KÍCH HOẠT SKILL TRA CỨU HÀNH CHÍNH VIỆT NAM & LÂM ĐỒNG ===`
  ];

  if (adminContext.matchedDepartments && adminContext.matchedDepartments.length > 0) {
    lines.push(`DỮ LIỆU CHÍNH THỨC CƠ CẤU 6 SỞ MỚI TỈNH LÂM ĐỒNG (Nghị quyết 390 - 395/NQ-HĐND ngày 18/02/2025, đi vào hoạt động 01/03/2025):`);
    adminContext.matchedDepartments.forEach((dept, idx) => {
      lines.push(`[Sở ${idx + 1}]: ${dept.canonical_name} (${dept.short_name})`);
      lines.push(`- Căn cứ pháp lý: Nghị quyết số ${dept.resolution_number} ngày ${dept.resolution_date}`);
      lines.push(`- Loại hình: ${dept.change_type}`);
      if (dept.old_entities) lines.push(`- Các đơn vị cũ hợp nhất: ${dept.old_entities.join(', ')}`);
      if (dept.received_functions_from) {
        dept.received_functions_from.forEach(f => {
          lines.push(`- Tiếp nhận chức năng: ${f.functions} từ ${f.source}`);
        });
      }
      lines.push(`- Ngày nghị quyết có hiệu lực: ${dept.resolution_effective_from}`);
      lines.push(`- Ngày đi vào hoạt động chính thức: ${dept.organization_operational_from}`);
      lines.push(`- Ghi chú: ${dept.note}`);
    });
    lines.push(`\nQUY TẮC TRA CỨU TÊN CƠ QUAN LÂM ĐỒNG:`);
    lines.push(`1. Phân biệt rõ ngày Nghị quyết HĐND có hiệu lực (18/02/2025) với ngày cơ quan đi vào hoạt động chính thức (01/03/2025).`);
    lines.push(`2. Từ ngày 01/03/2025 trở đi, sử dụng tên Sở mới đã hợp nhất (Ví dụ: Sở Xây dựng thay cho Sở GTVT; Sở Nội vụ tiếp nhận Sở LĐTB&XH; Sở Dân tộc và Tôn giáo tiếp nhận quản lý tôn giáo từ Sở Nội vụ).`);
  }

  if (adminContext.isCCHC) {
    lines.push(`\nLƯU Ý DỮ LIỆU CẢI CÁCH HÀNH CHÍNH (PAR Index / SIPAS / PAPI / PCI / Bộ chỉ số 766):`);
    lines.push(`- Luôn ghi rõ mốc thời gian snapshot và kỳ báo cáo dữ liệu trích dẫn.`);
    lines.push(`- Giữ nguyên số liệu chính thức từ nguồn báo cáo CCHC.`);
  }

  lines.push(`=== KẾT THÚC SKILL TRA CỨU HÀNH CHÍNH ===\n`);
  return lines.join('\n');
}

module.exports = {
  loadAdminData,
  detectAdminSearchContext,
  buildAdminSearchPrompt,
};
