/**
 * generate_cong_van.js
 * Script sinh Cong van (.docx) chuan Nghi dinh 30/2020/ND-CP
 * 
 * Su dung: node generate_cong_van.js --input <path/to/input.json> --output <path/to/output.docx>
 * Thu vien: npm install docx
 */

const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun,
    Table, TableRow, TableCell,
    AlignmentType, WidthType, BorderStyle,
    VerticalAlign, Header, PageNumber
} = require('docx');

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
        console.error('Loi: Thieu --input <path/to/input.json>');
        process.exit(1);
    }

    return { inputPath, outputPath };
}

// === THONG SO THE THUC (ND30 / QD4114) ===
const LAYOUT = {
    PAGE: {
        width: 11906,   // A4 width in dxa
        height: 16838,  // A4 height in dxa
    },
    MARGIN: {
        top: 1134,      // 20mm
        bottom: 1134,   // 20mm 
        left: 1701,     // 30mm
        right: 1134,    // 20mm
    },
    HEADER_COLS: {
        left: 3500,     // Cot trai: Co quan
        right: 5571,    // Cot phai: Quoc hieu
    },
    FONT: 'Times New Roman',
};

const BORDERS_NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

// === TAO HEADER TABLE ===
function createHeaderTable(data) {
    // --- COT TRAI ---
    const leftChildren = [];

    // Ten co quan chu quan (neu co)
    if (data.co_quan_chu_quan) {
        leftChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                    new TextRun({
                        text: data.co_quan_chu_quan,
                        font: LAYOUT.FONT, size: 26, // 13pt
                    }),
                ],
            })
        );
    }

    // Ten co quan ban hanh
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: data.co_quan_ban_hanh || 'BỘ TÀI CHÍNH',
                    font: LAYOUT.FONT, size: 26, bold: true, // 13pt, dam
                }),
            ],
        })
    );

    // Gach ngang duoi Ten co quan (Border Top, indent 1500)
    leftChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 200 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 1500, right: 1500 },
        })
    );

    // So, Ky hieu
    const soKyHieu = data.so_ky_hieu || ('So:      /BTC-' + (data.don_vi_soan_thao || 'TCCB'));
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
                new TextRun({
                    text: soKyHieu,
                    font: LAYOUT.FONT, size: 26, // 13pt
                }),
            ],
        })
    );

    // V/v (Trich yeu)
    if (data.trich_yeu) {
        leftChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 0 },
                children: [
                    new TextRun({
                        text: data.trich_yeu,
                        font: LAYOUT.FONT, size: 24, // 12pt
                    }),
                ],
            })
        );
    }

    // --- COT PHAI ---
    const rightChildren = [];

    // Quoc hieu
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                    font: LAYOUT.FONT, size: 26, bold: true, // 13pt
                }),
            ],
        })
    );

    // Tieu ngu
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: 'Độc lập - Tự do - Hạnh phúc',
                    font: LAYOUT.FONT, size: 28, bold: true, // 14pt
                }),
            ],
        })
    );

    // Gach ngang duoi Tieu ngu (Border Top, indent 1000)
    rightChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 20 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 1000, right: 1000 },
        })
    );

    // Dia danh, ngay thang
    const ngay = data.ngay_thang || {};
    const ngayStr = `Hà Nội, ngày ${ngay.ngay || '    '} tháng ${ngay.thang || '    '} năm ${ngay.nam || '2026'}`;
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 0 },
            children: [
                new TextRun({
                    text: ngayStr,
                    font: LAYOUT.FONT, size: 28, italics: true, // 14pt, nghieng
                }),
            ],
        })
    );

    // === HEADER TABLE ===
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: BORDERS_NONE,
        columnWidths: [LAYOUT.HEADER_COLS.left, LAYOUT.HEADER_COLS.right],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.HEADER_COLS.left, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: leftChildren,
                    }),
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.HEADER_COLS.right, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: rightChildren,
                    }),
                ],
            }),
        ],
    });
}

// === TAO BODY ===
function createBody(data) {
    const paragraphs = [];

    // Kinh gui
    if (data.kinh_gui && data.kinh_gui.length > 0) {
        if (data.kinh_gui.length === 1) {
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 360, after: 120 },
                    children: [
                        new TextRun({
                            text: 'Kính gửi: ',
                            font: LAYOUT.FONT, size: 28, // 14pt
                        }),
                        new TextRun({
                            text: data.kinh_gui[0] + '.',
                            font: LAYOUT.FONT, size: 28, // 14pt
                        }),
                    ],
                })
            );
        } else {
            // Nhieu noi nhan - Kinh gui:
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 360, after: 0 },
                    children: [
                        new TextRun({
                            text: 'Kính gửi: ',
                            font: LAYOUT.FONT, size: 28, // 14pt
                        }),
                    ],
                })
            );
            data.kinh_gui.forEach((item, idx) => {
                const suffix = idx === data.kinh_gui.length - 1 ? '.' : ';';
                paragraphs.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 0 },
                        children: [
                            new TextRun({
                                text: '- ' + item + suffix,
                                font: LAYOUT.FONT, size: 28,
                            }),
                        ],
                    })
                );
            });
        }
    }

    // Noi dung chinh
    if (data.noi_dung) {
        // Tach theo dong
        const lines = data.noi_dung.split('\n').filter(l => l.trim());
        lines.forEach(line => {
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { before: 120, after: 120 },
                    indent: { firstLine: 720 }, // ~1.27cm
                    children: [
                        new TextRun({
                            text: line.trim(),
                            font: LAYOUT.FONT, size: 28, // 14pt
                        }),
                    ],
                })
            );
        });
    }

    return paragraphs;
}

// === TAO KHOI CHU KY & NOI NHAN ===
function createSignatureBlock(data) {
    const elements = [];

    // Table 2 cot: Noi nhan (trai) | Chu ky (phai)
    const noiNhanChildren = [];
    const chuKyChildren = [];

    // --- COT PHAI: Chu ky ---
    // Quyen han (TM. / KT. / TL.)
    if (data.cap_ky && data.cap_ky !== 'TM') {
        chuKyChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.cap_ky + '. BỘ TRƯỞNG',
                        font: LAYOUT.FONT, size: 26, bold: true, // 13pt
                    }),
                ],
            })
        );
    }

    // Chuc vu
    chuKyChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.chuc_vu_ky || 'BỘ TRƯỞNG',
                    font: LAYOUT.FONT, size: 26, bold: true, // 13pt
                }),
            ],
        })
    );

    // Khoang trong de ky (4 dong)
    for (let i = 0; i < 4; i++) {
        chuKyChildren.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: '', font: LAYOUT.FONT, size: 28 })],
            })
        );
    }

    // Ten nguoi ky
    chuKyChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.nguoi_ky || '',
                    font: LAYOUT.FONT, size: 28, bold: true, // 14pt
                }),
            ],
        })
    );

    // --- COT TRAI: Noi nhan ---
    // "Noi nhan:"
    noiNhanChildren.push(
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: 'Nơi nhận:',
                    font: LAYOUT.FONT, size: 24, bold: true, italics: true, // 12pt
                }),
            ],
        })
    );

    // Cac muc noi nhan
    if (data.noi_nhan && data.noi_nhan.length > 0) {
        data.noi_nhan.forEach((item, idx) => {
            const suffix = idx === data.noi_nhan.length - 1 ? '.' : ';';
            noiNhanChildren.push(
                new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: '- ' + item + suffix,
                            font: LAYOUT.FONT, size: 22, // 11pt
                        }),
                    ],
                })
            );
        });
    }

    // Table chu ky
    elements.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDERS_NONE,
            columnWidths: [4500, 4571],
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: BORDERS_NONE,
                            width: { size: 4500, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.TOP,
                            children: noiNhanChildren,
                        }),
                        new TableCell({
                            borders: BORDERS_NONE,
                            width: { size: 4571, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.TOP,
                            children: chuKyChildren,
                        }),
                    ],
                }),
            ],
        })
    );

    return elements;
}

// === MAIN ===
async function main() {
    const { inputPath, outputPath } = parseArgs();

    // Doc file JSON
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(rawData);

    // Xac dinh output path
    const outPath = outputPath || data.output_path || 'output_cong_van.docx';

    // Tao Document
    const children = [];

    // 1. Header Table
    children.push(createHeaderTable(data));

    // 2. Body
    children.push(...createBody(data));

    // 3. Khoang cach truoc chu ky
    children.push(
        new Paragraph({
            spacing: { before: 240, after: 0 },
            children: [new TextRun({ text: '', font: LAYOUT.FONT })],
        })
    );

    // 4. Chu ky & Noi nhan
    children.push(...createSignatureBlock(data));

    // Header so trang: can giua, co 14, trang 1 khong danh so
    const pageNumberHeader = new Header({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        children: [PageNumber.CURRENT],
                        font: LAYOUT.FONT,
                        size: 28,
                    }),
                ],
            }),
        ],
    });

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: LAYOUT.FONT,
                        size: 28, // 14pt default
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    titlePage: true, // Trang 1 khong danh so
                    page: {
                        size: {
                            width: LAYOUT.PAGE.width,
                            height: LAYOUT.PAGE.height,
                        },
                        margin: LAYOUT.MARGIN,
                    },
                },
                headers: {
                    default: pageNumberHeader,
                },
                children,
            },
        ],
    });

    // Xuat file
    const buffer = await Packer.toBuffer(doc);
    const outDir = path.dirname(outPath);
    if (outDir && !fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outPath, buffer);
    console.log('Da tao thanh cong: ' + outPath);
}

main().catch(err => {
    console.error('Loi:', err.message);
    process.exit(1);
});
