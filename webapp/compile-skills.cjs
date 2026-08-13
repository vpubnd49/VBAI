/**
 * compile-skills.cjs
 * Trình biên dịch Skill: Quét các thư mục Skill_* và tổng hợp thành file manifest cho Web App.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEBAPP_DIR = __dirname;
const OUTPUT_FILE = path.join(WEBAPP_DIR, 'public', 'skills-manifest.json');

// Giới hạn ký tự tối đa cho instructions và từng resource (để tránh manifest quá lớn)
const MAX_INSTRUCTIONS_CHARS = 20000; // Tăng từ 5000 lên 20000 — đủ cho cả 4 Mode A/B/C/D
const MAX_RESOURCE_CHARS = 8000;      // Giới hạn mỗi file resource
const MAX_TEMPLATE_SUMMARY_CHARS = 800; // Tóm tắt mỗi template hợp đồng

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
    Skill_LegalKit_V3: [
      'phap luat',
      'tu van luat',
      'tranh chap',
      'bi kien',
      'nghi dinh',
      'soan hop dong',
      'mau hop dong',
      'ky hop dong',
      'nd30',
      'hd05'
    ],
    Skill_The_Thuc_VB_Dang_HD05: [
      'dang uy',
      'dang bo',
      'chi bo',
      'nghi quyet',
      'chi thi',
      'ket luan',
      'van ban dang',
      'hd05',
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

/**
 * Đọc và giới hạn nội dung file text.
 */
function readFileLimited(filePath, maxChars = MAX_RESOURCE_CHARS) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length <= maxChars) return content;
    return content.substring(0, maxChars) + `\n\n[... nội dung bị cắt tại ${maxChars} ký tự vì giới hạn manifest ...]`;
  } catch (e) {
    return null;
  }
}

/**
 * [FIX #3] Đọc resources/*.json (án lệ, VB theo dõi) vào references.
 */
function loadJsonResources(resourcesPath, references) {
  const jsonFiles = ['monitored-laws.json', 'precedents-catalog.json'];
  for (const jsonFile of jsonFiles) {
    const filePath = path.join(resourcesPath, jsonFile);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        // Đưa vào references dưới dạng text để AI đọc được
        const content = raw.length <= MAX_RESOURCE_CHARS
          ? raw
          : raw.substring(0, MAX_RESOURCE_CHARS) + '\n[...cắt bớt...]';
        references[jsonFile] = content;
        console.log(`    ✓ Loaded JSON: ${jsonFile} (${raw.length} bytes)`);
      } catch (e) {
        console.warn(`    ⚠ Không đọc được ${jsonFile}:`, e.message);
      }
    }
  }
}

/**
 * [FIX #2] Đọc resources/domains/*.md vào references.
 */
function loadDomainFiles(resourcesPath, references) {
  const domainsPath = path.join(resourcesPath, 'domains');
  if (!fs.existsSync(domainsPath)) return;
  try {
    const domainFiles = fs.readdirSync(domainsPath).filter(f => f.endsWith('.md')).sort();
    for (const domainFile of domainFiles) {
      const content = readFileLimited(path.join(domainsPath, domainFile));
      if (content) {
        references[`domains/${domainFile}`] = content;
        console.log(`    ✓ Loaded domain: ${domainFile}`);
      }
    }
  } catch (e) {
    console.warn('    ⚠ Lỗi đọc domains:', e.message);
  }
}

/**
 * [FIX #4] Đọc resources/lint-rules.md và contract-schema.md vào references.
 */
function loadLegalKitCoreResources(resourcesPath, references) {
  const coreFiles = ['lint-rules.md', 'contract-schema.md', 'search-sources.md', 'legal-system.md'];
  for (const coreFile of coreFiles) {
    const filePath = path.join(resourcesPath, coreFile);
    if (fs.existsSync(filePath)) {
      const content = readFileLimited(filePath);
      if (content) {
        references[coreFile] = content;
        console.log(`    ✓ Loaded resource: ${coreFile}`);
      }
    }
  }
}

/**
 * [FIX #4] Đọc templates/contracts/*.json và tạo tóm tắt danh mục cho AI.
 */
function loadContractTemplatesSummary(skillPath, references) {
  const contractsPath = path.join(skillPath, 'templates', 'contracts');
  if (!fs.existsSync(contractsPath)) return;

  try {
    const templateFiles = fs.readdirSync(contractsPath).filter(f => f.endsWith('.json')).sort();
    const summaries = [];
    let totalLoaded = 0;

    for (const tplFile of templateFiles) {
      try {
        const raw = fs.readFileSync(path.join(contractsPath, tplFile), 'utf8');
        const tpl = JSON.parse(raw);
        // Tạo tóm tắt ngắn gọn: tên, loại, các field chính
        const summary = {
          file: tplFile,
          name: tpl.name || tplFile.replace('.json', ''),
          type: tpl.type || '',
          requiredFields: (tpl.fields || []).filter(f => f.required).map(f => f.key).slice(0, 10),
          fieldCount: (tpl.fields || []).length,
        };
        summaries.push(summary);
        totalLoaded++;
      } catch (e) {
        summaries.push({ file: tplFile, error: 'parse failed' });
      }
    }

    references['contract-templates-catalog.json'] = JSON.stringify(summaries, null, 2)
      .substring(0, MAX_RESOURCE_CHARS);
    console.log(`    ✓ Loaded ${totalLoaded}/${templateFiles.length} contract template summaries`);
  } catch (e) {
    console.warn('    ⚠ Lỗi đọc contract templates:', e.message);
  }
}


async function compile() {
  console.log('🚀 Bắt đầu biên dịch Skills...');
  
  const skills = [];
  
  // 1. Quét Skill nội bộ dự án VBAI
  const items = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && (item.name.startsWith('Skill_') || item.name === 'skill') && item.name !== 'Skill_Claude' && item.name !== 'Skill_Codex') {
      const skillPath = path.join(ROOT_DIR, item.name);
      processSkill(skillPath, item.name === 'skill' ? 'Skill_LegalKit_V3' : item.name, skills);
    }
  }

  // Sắp xếp theo thứ tự mong muốn: LegalKit V3 -> Đảng -> Hành chính -> PDF -> DOCX
  const order = ['Skill_LegalKit_V3', 'Skill_The_Thuc_VB_Dang_HD05', 'Skill_The_Thuc_VB_ND30', 'Skill_PDF', 'Skill_DOCX'];
  skills.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(skills, null, 2), 'utf8');
  const outputSizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
  console.log(`\n✅ Đã biên dịch xong ${skills.length} skills!`);
  console.log(`📍 File lưu tại: ${OUTPUT_FILE} (${outputSizeKB} KB)`);
}

function processSkill(skillPath, skillId, skillsList, isExternal = false) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    console.log(`  • Tìm thấy: ${skillId}`);
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const { metadata, body } = parseFrontmatter(content);
    
    // Đọc các file trong references/ (file .md cơ bản)
    const references = {};
    const refPath = path.join(skillPath, 'references');
    if (fs.existsSync(refPath)) {
      try {
        const refFiles = fs.readdirSync(refPath);
        for (const refFile of refFiles) {
          if (refFile.endsWith('.md')) {
            const refContent = readFileLimited(path.join(refPath, refFile));
            if (refContent) references[refFile] = refContent;
          }
        }
      } catch(e) {}
    }

    // [FIX #2 + #3 + #4] Load thêm tài nguyên cho LegalKit V3
    if (skillId === 'Skill_LegalKit_V3') {
      const resourcesPath = path.join(skillPath, 'resources');
      if (fs.existsSync(resourcesPath)) {
        loadDomainFiles(resourcesPath, references);           // Fix #2: domains/*.md
        loadJsonResources(resourcesPath, references);         // Fix #3: án lệ + VB theo dõi
        loadLegalKitCoreResources(resourcesPath, references); // Fix #4: lint-rules, contract-schema
      }
      loadContractTemplatesSummary(skillPath, references);    // Fix #4: catalog 20 hợp đồng
    }
    
    let page = 'dashboard';
    let accent = 'pine';

    if (skillId.includes('LegalKit') || skillId === 'skill') {
      page = 'legal-search';
      accent = 'daquy';
    } else if (skillId.includes('ND30')) {
      page = 'vb-nd30';
      accent = 'mist';
    } else if (skillId.includes('Dang_HD05') || skillId.includes('Dang_HD36')) {
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

    // [FIX #1] Tăng giới hạn instructions từ 5000 lên MAX_INSTRUCTIONS_CHARS (20000)
    const instructions = body.length <= MAX_INSTRUCTIONS_CHARS
      ? body
      : body.substring(0, MAX_INSTRUCTIONS_CHARS) + '\n\n[... phần còn lại bị cắt để tiết kiệm context ...]';

    skillsList.push({
      id: skillId,
      name: metadata.name || skillId,
      description: metadata.description || '',
      triggers: normalizedTriggers.length
        ? normalizedTriggers
        : getDefaultTriggers(skillId),
      instructions,
      references: references,
      icon: metadata.icon || (isExternal ? '☁️' : '📜'),
      accent: accent,
      page: page
    });
  }
}

compile().catch(console.error);
