/**
 * generate_vb_co_ten_loai_nd30.js
 * Template sinh VB có tên loại (.docx) chuẩn NĐ30
 * Hỗ trợ: NQ, QĐ, CT, QC, QĐi, TB, HD, CTr, KH, PA, ĐA, BC, TTr, TC, GM...
 *
 * Sử dụng: node generate_vb_co_ten_loai_nd30.js --input <file.json> --output <output.docx>
 */

const fs = require('fs');
const path = require('path');
const {
    createHeader, createTenLoai, createKinhGui, createBody,
    createSignatureBlock, createDocument, Packer, Paragraph, TextRun, AlignmentType,
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
    const outPath = outputPath || data.output_path || 'output_vb.docx';

    const isPhieuTrinh = data.loai_van_ban === 'phieu_trinh' || 
                         (data.ten_loai && data.ten_loai.toLowerCase().includes('phiếu trình')) ||
                         (data.trich_yeu && data.trich_yeu.toLowerCase().includes('phiếu trình'));
    if (isPhieuTrinh) {
        const { createPhieuTrinhDocx } = require('./generate_phieu_trinh_nd30');
        const doc = createPhieuTrinhDocx(data);
        const buffer = await Packer.toBuffer(doc);
        const outDir = path.dirname(outPath);
        if (outDir && !fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(outPath, buffer);
        console.log(`✓ Đã tạo Phiếu trình chuẩn khung viền: ${outPath}`);
        return;
    }

    const children = [];

    // 1. Header (CQ + Quốc hiệu + Số KH + Ngày tháng)
    children.push(createHeader(data));

    // 2. Tên loại + Trích yếu + gạch ngang
    children.push(...createTenLoai(data));

    // 3. Kính gửi (nếu là Tờ trình)
    if (data.loai_van_ban === 'to_trinh' && data.kinh_gui) {
        children.push(...createKinhGui(data));
    }

    // 4. Nội dung (căn cứ + body)
    children.push(...createBody(data));

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

    const tenLoai = data.ten_loai || data.loai_van_ban || '';
    console.log(`✓ Đã tạo: ${outPath}`);
    console.log(`  Loại: ${tenLoai.toUpperCase()}`);
    console.log(`  CQ ban hành: ${data.co_quan_ban_hanh || ''}`);
}

main().catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
