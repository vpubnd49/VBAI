const fs = require('fs');
const path = require('path');

const BOSUNG_DIR = path.join(__dirname, '../bosung');
const OUTPUT_FILE = path.join(__dirname, '../bosung_metadata.jsonl');
const GCS_BUCKET = 'vbai-legal-documents-0462350485';
const GCS_PREFIX = 'bosung';

function categorizeDoc(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('tờ trình') || lower.includes('to trinh')) return 'Tờ trình';
  if (lower.includes('giấy mời') || lower.includes('giay moi')) return 'Giấy mời';
  if (lower.includes('quyết định') || lower.includes('quyet dinh')) return 'Quyết định';
  if (lower.includes('báo cáo') || lower.includes('bao cao')) return 'Báo cáo';
  if (lower.includes('kế hoạch') || lower.includes('ke hoach')) return 'Kế hoạch';
  if (lower.includes('quy chế') || lower.includes('quy che')) return 'Quy chế';
  if (lower.includes('nghị quyết') || lower.includes('nghi quyet')) return 'Nghị quyết';
  if (lower.includes('đề án') || lower.includes('de an')) return 'Đề án';
  return 'Văn bản khác';
}

function cleanFilename(filename) {
  return filename.replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
}

async function main() {
  if (!fs.existsSync(BOSUNG_DIR)) {
    console.error(`Không tìm thấy thư mục: ${BOSUNG_DIR}`);
    return;
  }

  const files = fs.readdirSync(BOSUNG_DIR);
  const jsonlLines = [];
  
  console.log(`[+] Tìm thấy ${files.length} tệp trong thư mục bosung.`);

  let idCounter = 1000;
  for (const file of files) {
    if (file.startsWith('.')) continue; // skip hidden files

    const ext = path.extname(file).toLowerCase();
    if (!['.pdf', '.docx', '.doc'].includes(ext)) {
      console.log(`Bỏ qua tệp không hỗ trợ: ${file}`);
      continue;
    }

    const docType = categorizeDoc(file);
    const safeName = cleanFilename(file);
    const gcsUri = `gs://${GCS_BUCKET}/${GCS_PREFIX}/${safeName}`;

    // Schema cho Unstructured Data Store Vertex AI Search
    // Bắt buộc phải có "id", "content.uri" hoặc "content.mimeType"
    const record = {
      id: `bosung_${idCounter++}`,
      jsonData: JSON.stringify({
        tieu_de: file.replace(ext, ''),
        loai_van_ban: docType,
        nguon: 'Thu muc bosung'
      }),
      content: {
        uri: gcsUri,
        mimeType: ext === '.pdf' ? 'application/pdf' : 
                  (ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword')
      }
    };

    jsonlLines.push(JSON.stringify(record));
  }

  fs.writeFileSync(OUTPUT_FILE, jsonlLines.join('\n'), 'utf8');
  console.log(`[+] Đã tạo file metadata thành công: ${OUTPUT_FILE}`);
  console.log(`[+] Tổng số records: ${jsonlLines.length}`);
  console.log('\\n======================================================');
  console.log('HƯỚNG DẪN ĐỒNG BỘ LÊN GOOGLE CLOUD (VERTEX AI SEARCH):');
  console.log('======================================================');
  console.log(`1. Upload thư mục bosung lên GCS Bucket:`);
  console.log(`   gsutil -m cp -r "e:/OneDrive/HSCV/Antigravity/VBAI/bosung/*" gs://${GCS_BUCKET}/${GCS_PREFIX}/`);
  console.log(`2. Upload file metadata.jsonl lên GCS:`);
  console.log(`   gsutil cp "${OUTPUT_FILE}" gs://${GCS_BUCKET}/bosung_metadata.jsonl`);
  console.log(`3. Chạy script setup-vertex-search.js (nhớ sửa đường dẫn metadata trong script trỏ về bosung_metadata.jsonl) để Ingest dữ liệu.`);
  console.log('======================================================');
}

main();
