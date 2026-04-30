/**
 * generate_cong_van_nd30.js
 * Template sinh Công văn (.docx) chuẩn NĐ30
 * Công văn: không có tên loại, V/v dưới số KH, Kính gửi giữa trang
 *
 * Sử dụng: node generate_cong_van_nd30.js --input <file.json> --output <output.docx>
 */

const fs = require('fs');
const path = require('path');
const {
    createHeader, createKinhGui, createBody,
    createSignatureBlock, createDocument, Packer, Paragraph, TextRun,
} = require('./docx_core_nd30');

// === PARSE ARGUMENTS ===
function parseArgs() {
    const args = process.argv.slice(2);
    let inputPath = null;
    let outputPath = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--input' && args[i + 1]) inputPath = args[++i];
        if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
    }
    if (!inputPath) {
        console.error('Lỗi: Thiếu --input <path/to/input.json>');
        process.exit(1);
    }
    return { inputPath, outputPath };
}

// === MAIN ===
async function main() {
    const { inputPath, outputPath } = parseArgs();
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(rawData);
    // Đảm bảo loại VB = cong_van
    data.loai_van_ban = 'cong_van';
    const outPath = outputPath || data.output_path || 'output_cong_van.docx';

    const children = [];

    // 1. Header (CQ + Quốc hiệu + Số KH + V/v + Ngày tháng)
    children.push(createHeader(data));

    // 2. Kính gửi
    children.push(...createKinhGui(data));

    // 3. Nội dung
    children.push(...createBody(data));

    // 4. Khoảng cách
    children.push(
        new Paragraph({
            spacing: { before: 240, after: 0 },
            children: [new TextRun({ text: '' })],
        })
    );

    // 5. Chữ ký + Nơi nhận
    children.push(createSignatureBlock(data));

    // Tạo Document + xuất file
    const doc = createDocument(children);
    const buffer = await Packer.toBuffer(doc);
    const outDir = path.dirname(outPath);
    if (outDir && !fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outPath, buffer);

    console.log(`✓ Đã tạo: ${outPath}`);
    console.log(`  Loại: Công văn`);
    console.log(`  CQ ban hành: ${data.co_quan_ban_hanh || ''}`);
}

main().catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
