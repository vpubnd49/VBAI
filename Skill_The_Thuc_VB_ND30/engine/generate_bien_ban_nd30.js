/**
 * generate_bien_ban_nd30.js
 * Template sinh Biên bản (.docx) chuẩn NĐ30
 * Biên bản: 2 chữ ký (thư ký bên trái, chủ trì bên phải)
 *
 * Sử dụng: node generate_bien_ban_nd30.js --input <file.json> --output <output.docx>
 */

const fs = require('fs');
const path = require('path');
const {
    LAYOUT, BORDERS_NONE, createHeader, createTenLoai, createBody,
    createDocument, Packer, Paragraph, TextRun, AlignmentType,
} = require('./docx_core_nd30');
const { Table, TableRow, TableCell, WidthType, VerticalAlign } = require('docx');

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

// Tạo cột chữ ký (chức vụ + 4 dòng trống + họ tên)
function createSignCol(label, name) {
    const children = [];

    // Chức vụ
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: label,
                    font: LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    // 4 dòng trống
    for (let i = 0; i < 4; i++) {
        children.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: '', font: LAYOUT.FONT, size: 28 })],
            })
        );
    }

    // Họ tên
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: name || '',
                    font: LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    return children;
}

// === MAIN ===
async function main() {
    const { inputPath, outputPath } = parseArgs();
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(rawData);
    data.loai_van_ban = 'bien_ban';
    const outPath = outputPath || data.output_path || 'output_bien_ban.docx';

    const children = [];

    // 1. Header
    children.push(createHeader(data));

    // 2. Tên loại + trích yếu
    children.push(...createTenLoai(data));

    // 3. Nội dung
    children.push(...createBody(data));

    // 4. Khoảng cách
    children.push(
        new Paragraph({
            spacing: { before: 360, after: 0 },
            children: [new TextRun({ text: '' })],
        })
    );

    // 5. 2 chữ ký: Thư ký (trái) + Chủ trì (phải)
    const halfWidth = Math.floor(LAYOUT.CONTENT_WIDTH / 2);
    const sigTable = new Table({
        width: { size: LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
        borders: BORDERS_NONE,
        columnWidths: [halfWidth, halfWidth],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: halfWidth, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: createSignCol(
                            data.chuc_vu_thu_ky || 'THƯ KÝ',
                            data.nguoi_ghi_bien_ban || data.thu_ky || ''
                        ),
                    }),
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: halfWidth, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: createSignCol(
                            data.chuc_vu_chu_tri || 'CHỦ TRÌ',
                            data.nguoi_chu_tri || data.chu_toa || ''
                        ),
                    }),
                ],
            }),
        ],
    });
    children.push(sigTable);

    // Tạo Document + xuất file
    const doc = createDocument(children);
    const buffer = await Packer.toBuffer(doc);
    const outDir = path.dirname(outPath);
    if (outDir && !fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outPath, buffer);

    console.log(`✓ Đã tạo: ${outPath}`);
    console.log(`  Loại: Biên bản`);
    console.log(`  CQ ban hành: ${data.co_quan_ban_hanh || ''}`);
}

main().catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
