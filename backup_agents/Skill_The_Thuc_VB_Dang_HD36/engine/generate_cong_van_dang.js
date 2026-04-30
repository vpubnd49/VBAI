/**
 * generate_cong_van_dang.js
 * Template riêng cho Công văn Đảng (không có tên loại)
 * Layout khác: trích yếu dưới số ký hiệu, có Kính gửi giữa trang
 *
 * Cách dùng:
 *   node generate_cong_van_dang.js --input data.json --output output.docx
 */

const fs = require('fs');
const path = require('path');
const core = require('./docx_core');

// ====== ĐỌC THAM SỐ ======

const args = process.argv.slice(2);
let inputFile, outputFile;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputFile = args[i + 1];
    if (args[i] === '--output' && args[i + 1]) outputFile = args[i + 1];
}

if (!inputFile) {
    console.error('Dùng: node generate_cong_van_dang.js --input data.json --output output.docx');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
data.loai_van_ban = 'cong_van'; // Force loại = công văn

if (!outputFile) {
    outputFile = path.join(path.dirname(inputFile), 'cong_van_output.docx');
}

// ====== TẠO VĂN BẢN ======

async function generateDocument() {
    const children = [];

    // 1. Header: CQ ban hành + ĐẢNG CỘNG SẢN VIỆT NAM
    children.push(core.createHeader(data));

    // 2. Số ký hiệu + Ngày tháng + Trích yếu (cỡ 12, nghiêng, nằm dưới số KH)
    children.push(core.createSoKyHieu(data));

    // 3. Kính gửi (nghiêng, giữa trang)
    const kinhGuiElements = core.createKinhGui(data);
    children.push(...kinhGuiElements);

    // 4. Nội dung VB
    const bodyElements = core.createBody(data);
    children.push(...bodyElements);

    // 5. Chữ ký + Nơi nhận
    children.push(
        new core.Paragraph({ spacing: { before: 240, after: 0 }, children: [] })
    );
    children.push(core.createSignatureBlock(data));

    // 6. Tạo document
    const doc = core.createDocument(children);

    // 7. Xuất file
    const buffer = await core.Packer.toBuffer(doc);
    fs.writeFileSync(outputFile, buffer);
    console.log(`✓ Đã tạo: ${outputFile}`);
    console.log(`  Loại: Công văn`);
    console.log(`  CQ ban hành: ${data.co_quan_ban_hanh}`);
}

generateDocument().catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
