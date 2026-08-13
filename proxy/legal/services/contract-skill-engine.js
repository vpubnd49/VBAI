/**
 * VBAI Legal Pro V2 — Contract Skill Engine
 * Dynamically loads and matches 20 contract skill JSON templates from skill/templates/contracts/
 * Provides legal basis, 3-tier clause rules, and Decree 30 formatting instructions for AI synthesis.
 */
const fs = require('fs');
const path = require('path');
const { normalizeVietnamese } = require('../domain/normalize-vietnamese');

let cachedContractTemplates = null;

function loadContractTemplates() {
  if (cachedContractTemplates) return cachedContractTemplates;

  const templatesDir = path.join(__dirname, '..', '..', '..', 'skill', 'templates', 'contracts');
  const templates = new Map();

  try {
    if (fs.existsSync(templatesDir)) {
      const files = fs.readdirSync(templatesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(templatesDir, file), 'utf8');
            const data = JSON.parse(raw);
            if (data && data.id) {
              templates.set(data.id, data);
            }
          } catch (e) {
            console.warn(`[contract-skill-engine] Failed to parse ${file}:`, e.message);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[contract-skill-engine] Failed to read templates directory:', err.message);
  }

  cachedContractTemplates = templates;
  return templates;
}

const CONTRACT_TRIGGERS = [
  { id: 'lao_dong', keywords: ['lao dong', 'thieu nhi', 'thu viec', 'hop dong lao dong', 'tuyen dung', 'nguoi lao dong', 'nhan vien'] },
  { id: 'thue_nha', keywords: ['thue nha', 'thue can ho', 'thue phong', 'cho thue nha', 'nha o'] },
  { id: 'thue_van_phong', keywords: ['thue van phong', 'thue mat bang', 'tru so', 'van phong'] },
  { id: 'vay_tien', keywords: ['vay tien', 'vay tai san', 'cho vay', 'tin dung', 'khuon vay'] },
  { id: 'dich_vu', keywords: ['dich vu', 'tu van', 'cung cap dich vu', 'dich vu thuong mai'] },
  { id: 'mua_ban_hh', keywords: ['mua ban hang hoa', 'mua ban san pham', 'cung cap hang hoa', 'ban hang'] },
  { id: 'dat_coc', keywords: ['dat coc', 'phat coc', 'tien coc', 'thoa thuan dat coc'] },
  { id: 'ctv', keywords: ['cong tac vien', 'khoan viec', 'ctv', 'hop dong ctv'] },
  { id: 'nguyen_tac', keywords: ['nguyen tac', 'hop dong khung', 'thoa thuan khung'] },
  { id: 'uy_quyen', keywords: ['uy quyen', 'giay uy quyen'] },
  { id: 'hop_tac_kinh_doanh', keywords: ['hop tac kinh doanh', 'bcc', 'thoa thuan bcc', 'dau tu'] },
  { id: 'gop_von', keywords: ['gop von', 'thanh lap doanh nghiep', 'thanh lap cong ty'] },
  { id: 'chuyen_nhuong_dat_dai', keywords: ['chuyen nhuong dat', 'mua ban dat', 'nha dat', 'quyen su dung dat', 'qsdd'] },
  { id: 'thiet_ke_phan_mem', keywords: ['thiet ke phan mem', 'phat trien phan mem', 'giao dien', 'cntt', 'it'] },
  { id: 'bao_lanh', keywords: ['bao lanh', 'thu bao lanh', 'bao lanh nghia vu'] },
  { id: 'dai_ly', keywords: ['dai ly', 'dai ly thuong mai', 'phan phoi'] },
  { id: 'gia_cong', keywords: ['gia cong', 'gia cong thuong mai'] },
  { id: 'tang_cho', keywords: ['tang cho', 'tang cho tai san'] },
  { id: 'nda', keywords: ['bao mat', 'nda', 'thoa thuan bao mat', 'thoa thuan bao ve bi mat'] },
  { id: 'thoa_thuan_co_dong', keywords: ['co dong', 'thoa thuan co dong', 'co phan'] },
];

function detectContractSkill(queryText = '') {
  if (!queryText) return null;
  const norm = normalizeVietnamese(queryText);

  // Check if query is contract-related
  const isContractRequest = /(?:hợp đồng|hop dong|soạn|soan|tạo|tao|viết|viet|lập|lap|mẫu|mau|chế bản|che ban)/i.test(queryText) || norm.includes('hop dong');
  if (!isContractRequest) return null;

  const templates = loadContractTemplates();

  for (const trigger of CONTRACT_TRIGGERS) {
    if (trigger.keywords.some(kw => norm.includes(kw))) {
      const matched = templates.get(trigger.id);
      if (matched) return matched;
    }
  }

  // Fallback to lao_dong or dich_vu if general contract request
  if (norm.includes('lao dong')) return templates.get('lao_dong');
  if (norm.includes('thue')) return templates.get('thue_nha');
  return templates.get('dich_vu') || templates.get('lao_dong') || null;
}

function buildContractSkillPrompt(matchedTemplate, userQuery = '') {
  if (!matchedTemplate) return '';

  const title = matchedTemplate.title || matchedTemplate.name || 'HỢP ĐỒNG';
  const legalBases = Array.isArray(matchedTemplate.legalBasis) ? matchedTemplate.legalBasis.join('\n- ') : '';
  const summary = matchedTemplate.summary || '';

  const lines = [
    `\n\n=== HỆ THỐNG KÍCH HOẠT SKILL SOẠN THẢO HỢP ĐỒNG CHUẨN NĐ30 & PHÁP LUẬT ===`,
    `TÊN HỢP ĐỒNG CHUẨN: ${title}`,
    `CĂN CỨ PHÁP LÝ BẮT BUỘC:`,
    `- ${legalBases}`,
    `TÓM TẮT THỦ TỤC & ĐIỀU KHOẢN: ${summary}`,
    `YÊU CẦU TRÌNH BÀY DỰ THẢO HỢP ĐỒNG:`,
    `1. Trình bày đầy đủ Quốc hiệu, Tiêu ngữ, Tên Hợp đồng ("${title}"), Căn cứ pháp lý, Thông tin Bên A & Bên B.`,
    `2. Liệt kê chi tiết từng Điều khoản (Điều 1, Điều 2, Điều 3...) dựa trên các thông tin người dùng cung cấp trong câu hỏi ("${userQuery}").`,
    `3. Đảm bảo tuân thủ thể thức soạn thảo văn bản hành chính theo Nghị định 30/2020/NĐ-CP (có Đại diện Bên A và Bên B ký tên ở cuối).`,
    `4. Định dạng Markdown phân mục rõ ràng với các thẻ tiêu đề (### A. KẾT LUẬN & DỰ THẢO HỢP ĐỒNG, ### B. CĂN CỨ PHÁP LÝ, ### C. LƯU Ý VÀ RỦI RO).`,
    `=== KẾT THÚC SKILL HỢP ĐỒNG ===\n`
  ];

  return lines.join('\n');
}

module.exports = {
  loadContractTemplates,
  detectContractSkill,
  buildContractSkillPrompt,
};
