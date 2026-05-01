/**
 * Script đọc tất cả file .docx trong thư mục templates
 * Trích xuất nội dung văn bản để phân tích quy tắc viết hoa, chức danh, thuật ngữ
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATES_DIR = path.resolve(__dirname, '../Skill_The_Thuc_VB_ND30/templates');
const OUTPUT_FILE = path.resolve(__dirname, 'templates-knowledge.json');

async function extractTextFromDocx(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) return '';
    // Extract text content using regex (no need for full XML parser)
    const texts = [];
    const matches = docXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    for (const m of matches) {
      texts.push(m[1]);
    }
    return texts.join('');
  } catch (e) {
    return '';
  }
}

function findAllDocxFiles(dir) {
  const results = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...findAllDocxFiles(fullPath));
      } else if (item.name.endsWith('.docx') && !item.name.startsWith('~$')) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

async function main() {
  console.log('Đang tìm tất cả file .docx...');
  const files = findAllDocxFiles(TEMPLATES_DIR);
  console.log(`Tìm thấy ${files.length} file .docx`);

  const allTexts = [];
  const capitalizedTerms = new Set();
  const officialTitles = new Set();
  const organizations = new Set();
  const abbreviations = new Set();
  
  // Patterns to detect
  const titlePatterns = [
    /(?:Trưởng ban|Phó Trưởng ban|Chủ tịch|Phó Chủ tịch|Giám đốc|Phó Giám đốc|Chánh Văn phòng|Phó Chánh Văn phòng|Thư ký|Phó Thư ký|Tổng Thư ký|Chánh Thanh tra|Phó Chánh Thanh tra|Vụ trưởng|Phó Vụ trưởng|Trưởng phòng|Phó Trưởng phòng|Cục trưởng|Phó Cục trưởng|Bí thư|Phó Bí thư|Ủy viên|Thường trực|Hội trưởng|Hội phó|Tổng giám đốc|Chi cục trưởng|Chi hội trưởng)[^.;\n]*/gi,
  ];
  
  const orgPatterns = [
    /(?:Ban Chấp hành|Ban Thường vụ|Ban Tổ chức|Ban Kiểm tra|Ban Dân vận|Ban Tuyên giáo|Ban Nội chính|Ban Kinh tế|Hội đồng nhân dân|Ủy ban nhân dân|Ủy ban Mặt trận|Đoàn Chủ tịch|Ban Chỉ đạo|Ban Quản lý|Ban vận động|Hội đồng quản lý|Ban Kiểm soát|Ban Cố vấn|Đại hội đại biểu)[^.;\n]*/gi,
  ];

  let processedCount = 0;
  for (const file of files) {
    const text = await extractTextFromDocx(file);
    if (!text) continue;
    processedCount++;
    allTexts.push({ file: path.relative(TEMPLATES_DIR, file), text: text.substring(0, 2000) }); // Keep first 2000 chars
    
    // Extract capitalized terms
    for (const pattern of titlePatterns) {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        officialTitles.add(m[0].trim().substring(0, 80));
      }
    }
    
    for (const pattern of orgPatterns) {
      const matches = text.matchAll(pattern);
      for (const m of matches) {
        organizations.add(m[0].trim().substring(0, 100));
      }
    }
    
    // Extract abbreviations (2+ consecutive uppercase letters)
    const abbrMatches = text.matchAll(/\b([A-ZĐÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆ]{2,})\b/g);
    for (const m of abbrMatches) {
      abbreviations.add(m[1]);
    }
    
    if (processedCount % 20 === 0) {
      console.log(`Đã xử lý ${processedCount}/${files.length} file...`);
    }
  }

  console.log(`\nKết quả phân tích ${processedCount} file thành công:`);
  console.log(`- Chức danh tìm được: ${officialTitles.size}`);
  console.log(`- Tổ chức/cơ quan: ${organizations.size}`);
  console.log(`- Từ viết tắt: ${abbreviations.size}`);

  const knowledge = {
    totalFiles: processedCount,
    officialTitles: [...officialTitles].sort(),
    organizations: [...organizations].sort(),
    abbreviations: [...abbreviations].sort(),
    sampleTexts: allTexts.slice(0, 30), // Keep 30 samples
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledge, null, 2), 'utf8');
  console.log(`\nĐã lưu kiến thức vào: ${OUTPUT_FILE}`);
  
  // Print key findings
  console.log('\n===== CHỨC DANH QUAN TRỌNG =====');
  [...officialTitles].sort().slice(0, 50).forEach(t => console.log('  •', t));
  
  console.log('\n===== TỔ CHỨC/CƠ QUAN =====');
  [...organizations].sort().slice(0, 50).forEach(o => console.log('  •', o));
  
  console.log('\n===== TỪ VIẾT TẮT =====');
  console.log([...abbreviations].sort().join(', '));
}

main().catch(console.error);
