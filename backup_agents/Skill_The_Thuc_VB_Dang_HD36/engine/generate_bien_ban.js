/**
 * generate_bien_ban.js
 * Template Biên bản hội nghị Đảng (2 chữ ký trái-phải)
 *
 * Cách dùng:
 *   node generate_bien_ban.js --input data.json --output output.docx
 */

const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, BorderStyle, WidthType,
    VerticalAlign,
} = require('docx');
const core = require('./docx_core');

// ====== ĐỌC THAM SỐ ======

const args = process.argv.slice(2);
let inputFile, outputFile;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputFile = args[i + 1];
    if (args[i] === '--output' && args[i + 1]) outputFile = args[i + 1];
}

if (!inputFile) {
    console.error('Dùng: node generate_bien_ban.js --input data.json --output output.docx');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
data.loai_van_ban = 'bien_ban';

if (!outputFile) {
    outputFile = path.join(path.dirname(inputFile), 'bien_ban_output.docx');
}

// ====== TẠO KHỐI 2 CHỮ KÝ ======

function createDualSignature(data) {
    // Cột trái: Người ghi biên bản
    const leftChildren = [];
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.chuc_vu_trai || 'NGƯỜI GHI BIÊN BẢN',
                    font: core.LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );
    // 4 dòng trống
    for (let i = 0; i < 4; i++) {
        leftChildren.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: '', font: core.LAYOUT.FONT, size: 28 })],
            })
        );
    }
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.nguoi_ghi || '',
                    font: core.LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    // Cột phải: Chủ trì hội nghị
    const rightChildren = [];
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.chuc_vu_phai || 'CHỦ TRÌ HỘI NGHỊ',
                    font: core.LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );
    // 4 dòng trống
    for (let i = 0; i < 4; i++) {
        rightChildren.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: '', font: core.LAYOUT.FONT, size: 28 })],
            })
        );
    }
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.chu_tri || '',
                    font: core.LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    return new Table({
        width: { size: core.LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
        borders: core.BORDERS_NONE,
        columnWidths: [core.LAYOUT.SIGNATURE_COLS.left, core.LAYOUT.SIGNATURE_COLS.right],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: core.BORDERS_NONE,
                        width: { size: core.LAYOUT.SIGNATURE_COLS.left, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: leftChildren,
                    }),
                    new TableCell({
                        borders: core.BORDERS_NONE,
                        width: { size: core.LAYOUT.SIGNATURE_COLS.right, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: rightChildren,
                    }),
                ],
            }),
        ],
    });
}

// ====== TẠO VĂN BẢN ======

async function generateDocument() {
    const children = [];

    // 1. Header
    children.push(core.createHeader(data));

    // 2. Số ký hiệu + Ngày tháng
    children.push(core.createSoKyHieu(data));

    // 3. Tên loại VB + Trích yếu
    const tenLoaiElements = core.createTenLoai(data);
    children.push(...tenLoaiElements);

    // 4. Nội dung
    const bodyElements = core.createBody(data);
    children.push(...bodyElements);

    // 5. 2 chữ ký (trái-phải)
    children.push(
        new Paragraph({ spacing: { before: 360, after: 0 }, children: [] })
    );
    children.push(createDualSignature(data));

    // 5b. Xác nhận chữ ký (nếu có)
    if (data.xac_nhan) {
        children.push(
            new Paragraph({
                spacing: { before: 240, after: 0 },
                children: [
                    new TextRun({
                        text: `Xác nhận chữ ký của đồng chí ${data.chu_tri || '...'}`,
                        font: core.LAYOUT.FONT, size: 28,
                    }),
                ],
            })
        );
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 0 },
                children: [
                    new TextRun({
                        text: data.xac_nhan.quyen_han || 'T/L BAN THƯỜNG VỤ',
                        font: core.LAYOUT.FONT, size: 28, bold: true,
                    }),
                ],
            })
        );
        if (data.xac_nhan.chuc_vu) {
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: data.xac_nhan.chuc_vu,
                            font: core.LAYOUT.FONT, size: 28,
                        }),
                    ],
                })
            );
        }
        // 4 dòng trống
        for (let i = 0; i < 4; i++) {
            children.push(
                new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [new TextRun({ text: '', font: core.LAYOUT.FONT, size: 28 })],
                })
            );
        }
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.xac_nhan.nguoi_ky || '',
                        font: core.LAYOUT.FONT, size: 28, bold: true,
                    }),
                ],
            })
        );
    }

    // 6. Tạo document
    const doc = core.createDocument(children);

    // 7. Xuất file
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputFile, buffer);
    console.log(`✓ Đã tạo: ${outputFile}`);
    console.log(`  Loại: Biên bản`);
}

generateDocument().catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
