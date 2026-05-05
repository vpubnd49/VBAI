/**
 * compile-skills.cjs
 * Trình biên dịch Skill: Quét các thư mục Skill_* và tổng hợp thành file manifest cho Web App.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEBAPP_DIR = __dirname;
const OUTPUT_FILE = path.join(WEBAPP_DIR, 'public', 'skills-manifest.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { metadata: {}, body: content };
  
  const yaml = match[1];
  const metadata = {};
  yaml.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join(':').trim();
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      metadata[key] = value;
    }
  });
  
  return { metadata, body: content.replace(match[0], '').trim() };
}

function getDefaultTriggers(skillId) {
  const triggerMap = {
    Skill_The_Thuc_VB_Dang_HD36: [
      'dang uy',
      'dang bo',
      'chi bo',
      'nghi quyet',
      'chi thi',
      'ket luan',
      'van ban dang',
      'hd36',
      't/m',
      'k/t',
      't/l'
    ],
    Skill_The_Thuc_VB_ND30: [
      'cong van',
      'quyet dinh',
      'to trinh',
      'thong bao',
      'van ban hanh chinh',
      'nd30',
      'nghi dinh 30',
      'trinh ky'
    ],
    Skill_PDF: [
      'pdf',
      'ocr',
      'trich xuat pdf',
      'gop file pdf',
      'tach file pdf'
    ],
    Skill_DOCX: [
      'docx',
      'word',
      'file word',
      'xuat word',
      'xuat docx',
      'soan thao word'
    ]
  };

  return triggerMap[skillId] || [];
}

function normalizeTriggers(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(v => String(v).trim().toLowerCase()).filter(Boolean);
  }

  return String(raw)
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}


async function compile() {
  console.log('🚀 Bắt đầu biên dịch Skills...');
  
  const skills = [];
  
  // 1. Quét Skill nội bộ dự án VBAI
  const items = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && item.name.startsWith('Skill_') && item.name !== 'Skill_Claude' && item.name !== 'Skill_Codex') {
      const skillPath = path.join(ROOT_DIR, item.name);
      processSkill(skillPath, item.name, skills);
    }
  }

  // Sắp xếp theo thứ tự mong muốn: Đảng -> Hành chính -> PDF -> DOCX
  const order = ['Skill_The_Thuc_VB_Dang_HD36', 'Skill_The_Thuc_VB_ND30', 'Skill_PDF', 'Skill_DOCX'];
  skills.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(skills, null, 2), 'utf8');
  console.log(`\n✅ Đã biên dịch xong ${skills.length} skills!`);
  console.log(`📍 File lưu tại: ${OUTPUT_FILE}`);
}

function processSkill(skillPath, skillId, skillsList, isExternal = false) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    console.log(`  • Tìm thấy: ${skillId}`);
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const { metadata, body } = parseFrontmatter(content);
    
    // Đọc các file trong references
    const references = {};
    const refPath = path.join(skillPath, 'references');
    if (fs.existsSync(refPath)) {
      try {
        const refFiles = fs.readdirSync(refPath);
        for (const refFile of refFiles) {
          if (refFile.endsWith('.md')) {
            const refContent = fs.readFileSync(path.join(refPath, refFile), 'utf8');
            references[refFile] = refContent;
          }
        }
      } catch(e) {}
    }
    
    let page = 'dashboard';
    let accent = 'pine';

    if (skillId.includes('ND30')) {
      page = 'vb-nd30';
      accent = 'mist';
    } else if (skillId.includes('Dang_HD36')) {
      page = 'vb-dang';
      accent = 'pine';
    } else if (skillId.includes('PDF')) {
      page = 'pdf-tool';
      accent = 'mist';
    } else if (skillId.includes('DOCX')) {
      page = 'docx-tool';
      accent = 'pine';
    } else if (isExternal) {
      page = 'admin-panel';
      accent = 'daquy';
    }

    const normalizedTriggers = normalizeTriggers(metadata.triggers);

    skillsList.push({
      id: skillId,
      name: metadata.name || skillId,
      description: metadata.description || '',
      triggers: normalizedTriggers.length
        ? normalizedTriggers
        : getDefaultTriggers(skillId),
      instructions: body.substring(0, 5000), // Giới hạn context AI
      references: references,
      icon: metadata.icon || (isExternal ? '☁️' : '📜'),
      accent: accent,
      page: page
    });
  }
}

compile().catch(console.error);
