/**
 * generate_quyet_dinh.js
 * Script sinh Quyet dinh (.docx) chuan Nghi dinh 30/2020/ND-CP
 * 
 * Su dung: node generate_quyet_dinh.js --input <path/to/input.json> --output <path/to/output.docx>
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

// === THONG SO THE THUC ===
const LAYOUT = {
    PAGE: { width: 11906, height: 16838 },
    MARGIN: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
    HEADER_COLS: { left: 3500, right: 5571 },
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
    const leftChildren = [];
    const rightChildren = [];

    // -- COT TRAI --
    if (data.co_quan_chu_quan) {
        leftChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                    new TextRun({ text: data.co_quan_chu_quan, font: LAYOUT.FONT, size: 26 }),
                ],
            })
        );
    }

    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: data.co_quan_ban_hanh || 'BO TAI CHINH',
                    font: LAYOUT.FONT, size: 26, bold: true,
                }),
            ],
        })
    );

    // Gach ngang
    leftChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 200 },
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
            indent: { left: 1500, right: 1500 },
        })
    );

    // So quyet dinh
    const soQD = data.so_ky_hieu || ('So:      /QD-BTC');
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({ text: soQD, font: LAYOUT.FONT, size: 26 }),
            ],
        })
    );

    // -- COT PHAI --
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: 'CONG HOA XA HOI CHU NGHIA VIET NAM',
                    font: LAYOUT.FONT, size: 26, bold: true,
                }),
            ],
        })
    );

    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: 'Doc lap - Tu do - Hanh phuc',
                    font: LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    // Gach ngang Tieu ngu
    rightChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 20 },
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
            indent: { left: 1000, right: 1000 },
        })
    );

    // Dia danh, ngay thang
    const ngay = data.ngay_thang || {};
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 0 },
            children: [
                new TextRun({
                    text: `Ha Noi, ngay ${ngay.ngay || '    '} thang ${ngay.thang || '    '} nam ${ngay.nam || '2026'}`,
                    font: LAYOUT.FONT, size: 28, italics: true,
                }),
            ],
        })
    );

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

// === TAO TEN LOAI VAN BAN ===
function createTenLoai() {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 120 },
        children: [
            new TextRun({
                text: 'QUYET DINH',
                font: LAYOUT.FONT, size: 28, bold: true,
            }),
        ],
    });
}

// === TAO TRICH YEU ===
function createTrichYeu(data) {
    const elements = [];
    if (data.trich_yeu) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.trich_yeu,
                        font: LAYOUT.FONT, size: 28, bold: true,
                    }),
                ],
            })
        );
        // Gach ngang duoi trich yeu
        elements.push(
            new Paragraph({
                spacing: { before: 20, after: 120 },
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
                indent: { left: 2500, right: 2500 },
            })
        );
    }
    return elements;
}

// === TAO PHAN CAN CU ===
function createCanCu(data) {
    const paragraphs = [];
    if (data.can_cu && data.can_cu.length > 0) {
        data.can_cu.forEach(cc => {
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { before: 60, after: 60 },
                    indent: { firstLine: 720 },
                    children: [
                        new TextRun({
                            text: 'Can cu ' + cc + ';',
                            font: LAYOUT.FONT, size: 28, italics: true,
                        }),
                    ],
                })
            );
        });
    }
    return paragraphs;
}

// === TAO QUYEN HAN KY ===
function createQuyenHanKy(data) {
    const elements = [];

    // "Theo de nghi cua..."
    if (data.theo_de_nghi) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 60, after: 120 },
                indent: { firstLine: 720 },
                children: [
                    new TextRun({
                        text: 'Theo de nghi cua ' + data.theo_de_nghi + '.',
                        font: LAYOUT.FONT, size: 28, italics: true,
                    }),
                ],
            })
        );
    }

    return elements;
}

// === TAO CAC DIEU ===
function createCacDieu(data) {
    const paragraphs = [];

    // "QUYET DINH:"
    paragraphs.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [
                new TextRun({
                    text: 'QUYET DINH:',
                    font: LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    if (data.cac_dieu && data.cac_dieu.length > 0) {
        data.cac_dieu.forEach((dieu, idx) => {
            // Tieu de Dieu
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { before: 120, after: 60 },
                    indent: { firstLine: 720 },
                    children: [
                        new TextRun({
                            text: `Dieu ${idx + 1}. `,
                            font: LAYOUT.FONT, size: 28, bold: true,
                        }),
                        new TextRun({
                            text: dieu.noi_dung || '',
                            font: LAYOUT.FONT, size: 28,
                        }),
                    ],
                })
            );
        });
    }

    return paragraphs;
}

// === TAO KHOI CHU KY ===
function createSignatureBlock(data) {
    const noiNhanChildren = [];
    const chuKyChildren = [];

    // Chu ky
    if (data.cap_ky && data.cap_ky !== 'TM') {
        chuKyChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.cap_ky + '. BO TRUONG',
                        font: LAYOUT.FONT, size: 26, bold: true,
                    }),
                ],
            })
        );
    }

    chuKyChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.chuc_vu_ky || 'BO TRUONG',
                    font: LAYOUT.FONT, size: 26, bold: true,
                }),
            ],
        })
    );

    // Khoang trong de ky (4 dong)
    for (let i = 0; i < 4; i++) {
        chuKyChildren.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', font: LAYOUT.FONT, size: 28 })] }));
    }

    chuKyChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: data.nguoi_ky || '',
                    font: LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    // Noi nhan
    noiNhanChildren.push(
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: 'Noi nhan:',
                    font: LAYOUT.FONT, size: 24, bold: true, italics: true,
                }),
            ],
        })
    );

    if (data.noi_nhan) {
        data.noi_nhan.forEach((item, idx) => {
            const suffix = idx === data.noi_nhan.length - 1 ? '.' : ';';
            noiNhanChildren.push(
                new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: '- ' + item + suffix,
                            font: LAYOUT.FONT, size: 22,
                        }),
                    ],
                })
            );
        });
    }

    return [
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
        }),
    ];
}

// === MAIN ===
async function main() {
    const { inputPath, outputPath } = parseArgs();
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(rawData);
    const outPath = outputPath || data.output_path || 'output_quyet_dinh.docx';

    const children = [];

    // 1. Header
    children.push(createHeaderTable(data));

    // 2. Ten loai "QUYET DINH"
    children.push(createTenLoai());

    // 3. Trich yeu
    children.push(...createTrichYeu(data));

    // 4. Can cu phap ly
    children.push(...createCanCu(data));

    // 5. Quyen han ky
    children.push(...createQuyenHanKy(data));

    // 6. Cac Dieu
    children.push(...createCacDieu(data));

    // 7. Khoang cach
    children.push(new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: '', font: LAYOUT.FONT })] }));

    // 8. Chu ky & Noi nhan
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
                    run: { font: LAYOUT.FONT, size: 28 },
                },
            },
        },
        sections: [{
            properties: {
                titlePage: true, // Trang 1 khong danh so
                page: {
                    size: { width: LAYOUT.PAGE.width, height: LAYOUT.PAGE.height },
                    margin: LAYOUT.MARGIN,
                },
            },
            headers: {
                default: pageNumberHeader,
            },
            children,
        }],
    });

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
