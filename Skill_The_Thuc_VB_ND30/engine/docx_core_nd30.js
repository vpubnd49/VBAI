/**
 * docx_core_nd30.js — Engine chung sinh VB Hành chính (.docx)
 * Chuẩn Nghị định 30/2020/NĐ-CP
 *
 * Export: createHeader, createTenLoai, createKinhGui, createCanCu,
 *         createBody, createSignature, createNoiNhan, createSignatureBlock,
 *         createDocument, LAYOUT, TEN_LOAI_VB, Packer, Paragraph, TextRun, AlignmentType
 */

const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, BorderStyle, WidthType,
    ShadingType, VerticalAlign, LineRuleType, UnderlineType,
    Header, PageNumber,
} = require('docx');

// ====== THÔNG SỐ THỂ THỨC (NĐ30) ======

const LAYOUT = {
    PAGE: { width: 11906, height: 16838 },   // A4
    MARGIN: {
        top: 1134,      // 20mm
        bottom: 1134,   // 20mm
        left: 1701,     // 30mm
        right: 1134,    // 20mm (KHÁC HD36: 850 = 15mm)
    },
    FONT: 'Times New Roman',
    CONTENT_WIDTH: 9071,  // 11906 - 1701 - 1134
    HEADER_COLS: {
        left: 3500,     // Cột trái: Cơ quan
        right: 5571,    // Cột phải: Quốc hiệu
    },
    SIGNATURE_COLS: {
        left: 4300,     // Nơi nhận
        right: 4771,    // Chữ ký
    },
};

// Viền ẩn
const BORDERS_NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

// Body spacing chuẩn NĐ30
const BODY_SPACING = {
    before: 120,   // 6pt
    after: 0,
    line: 340,     // ~17pt (KHÁC HD36: 360 = 18pt)
    lineRule: LineRuleType.AT_LEAST,
};

// Hàm phụ: kiểm tra IN HOA (>60% chữ hoa)
function isUpperCase(str) {
    const letters = str.replace(/[^a-zA-ZÀ-ỹ]/g, '');
    if (letters.length === 0) return false;
    const upper = letters.replace(/[^A-ZÀ-Ỹ]/g, '');
    return upper.length / letters.length > 0.6;
}

// ====== BẢNG TRA KÝ HIỆU LOẠI VB ======

const TEN_LOAI_VB = {
    nghi_quyet: 'NGHỊ QUYẾT',
    quyet_dinh: 'QUYẾT ĐỊNH',
    chi_thi: 'CHỈ THỊ',
    quy_che: 'QUY CHẾ',
    quy_dinh: 'QUY ĐỊNH',
    thong_bao: 'THÔNG BÁO',
    huong_dan: 'HƯỚNG DẪN',
    chuong_trinh: 'CHƯƠNG TRÌNH',
    ke_hoach: 'KẾ HOẠCH',
    phuong_an: 'PHƯƠNG ÁN',
    de_an: 'ĐỀ ÁN',
    du_an: 'DỰ ÁN',
    bao_cao: 'BÁO CÁO',
    to_trinh: 'TỜ TRÌNH',
    thong_cao: 'THÔNG CÁO',
    bien_ban: 'BIÊN BẢN',
    giay_moi: 'GIẤY MỜI',
    giay_gioi_thieu: 'GIẤY GIỚI THIỆU',
    giay_nghi_phep: 'GIẤY NGHỈ PHÉP',
    giay_uy_quyen: 'GIẤY ỦY QUYỀN',
    hop_dong: 'HỢP ĐỒNG',
    cong_dien: 'CÔNG ĐIỆN',
    ban_ghi_nho: 'BẢN GHI NHỚ',
    cong_van: '',  // Công văn không có tên loại
};

// ====== HÀM TẠO HEADER (GỘP CQ + SỐ KH + NGÀY THÁNG) ======

/**
 * Tạo 1 table duy nhất chứa header:
 * - Trái: CQ chủ quản → CQ ban hành → gạch 1/3 → Số KH → (V/v trích yếu CV)
 * - Phải: Quốc hiệu → Tiêu ngữ + gạch → Địa danh, ngày tháng
 */
/**
 * Tách dòng cơ quan hành chính chuẩn NĐ30:
 * Nhảy dòng ngay trước chữ "TỈNH", "THÀNH PHỐ", "HUYỆN", "XÃ"...
 * Ví dụ: "ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG" -> ["ỦY BAN NHÂN DÂN", "TỈNH LÂM ĐỒNG"]
 */
function splitAgencyLines(name, isCapTren = false) {
    if (!name || !name.trim()) return [];
    const trimmed = name.trim();
    if (trimmed.includes('\n')) {
        return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
    }

    // Khi là cơ quan chủ quản cấp trên của Sở/Ngành (ví dụ: Sở Tài chính, Sở Công Thương)
    // Mẫu chuẩn thực tế các Sở: "UBND TỈNH LÂM ĐỒNG" trên 1 dòng duy nhất
    if (isCapTren) {
        const capTrenMatch = trimmed.match(/^(?:ỦY BAN NHÂN DÂN|UBND)\s+(TỈNH|THÀNH PHỐ|TP\.?|HUYỆN|THỊ XÃ|TX\.?)\s+(.+)$/i);
        if (capTrenMatch) {
            const type = capTrenMatch[1].trim().toUpperCase();
            const place = capTrenMatch[2].trim().toUpperCase();
            return [`UBND ${type} ${place}`];
        }
        return [trimmed.toUpperCase()];
    }

    // Khi là cơ quan ban hành trực tiếp (ví dụ: văn bản do UBND tỉnh ban hành)
    const regex = /^(ỦY BAN NHÂN DÂN|HỘI ĐỒNG NHÂN DÂN|UBND|HĐND)\s+(TỈNH|THÀNH PHỐ|TP\.?|HUYỆN|THỊ XÃ|TX\.?|XÃ|PHƯỜNG|ĐẶC KHU)\s+(.+)$/i;
    const match = trimmed.match(regex);
    if (match) {
        const org = match[1].trim().toUpperCase();
        const locType = match[2].trim().toUpperCase();
        const locName = match[3].trim().toUpperCase();
        return [org, `${locType} ${locName}`];
    }

    return [trimmed.toUpperCase()];
}

/**
 * Tạo Header Table 2 hàng x 2 cột:
 * - Hàng 0: CQ chủ quản, CQ ban hành (trái) - Quốc hiệu, Tiêu ngữ (phải)
 * - Hàng 1: Số KH, Trích yếu CV (trái) - Địa danh, ngày tháng (phải)
 */
function createHeader(data) {
    // --- ROW 0: CƠ QUAN BAN HÀNH (TRÁI) & QUỐC HIỆU, TIÊU NGỮ (PHẢI) ---
    const row0Left = [];

    // CQ chủ quản (nếu có, ví dụ "UBND TỈNH LÂM ĐỒNG")
    if (data.co_quan_chu_quan) {
        const chuQuanLines = splitAgencyLines(data.co_quan_chu_quan, true);
        chuQuanLines.forEach(line => {
            row0Left.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: line,
                            font: LAYOUT.FONT, size: 26, // 13pt
                        }),
                    ],
                })
            );
        });
    }

    // CQ ban hành (IN HOA ĐẬM, ví dụ "SỞ TÀI CHÍNH" hoặc "ỦY BAN NHÂN DÂN / TỈNH LÂM ĐỒNG")
    const banHanh = data.co_quan_ban_hanh || 'ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG';
    const banHanhLines = splitAgencyLines(banHanh, false);
    banHanhLines.forEach(line => {
        row0Left.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: line,
                        font: LAYOUT.FONT, size: 26, bold: true, // 13pt, đậm
                    }),
                ],
            })
        );
    });

    // Gạch ngang dưới tên cơ quan ban hành (1/3 đến 1/2 chiều rộng)
    row0Left.push(
        new Paragraph({
            spacing: { before: 20, after: 60 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 1350, right: 1350 },
        })
    );

    const row0Right = [
        // Quốc hiệu (13pt, đậm, IN HOA)
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                    font: LAYOUT.FONT, size: 26, bold: true, // 13pt
                }),
            ],
        }),
        // Tiêu ngữ (14pt, đậm)
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: 'Độc lập - Tự do - Hạnh phúc',
                    font: LAYOUT.FONT, size: 28, bold: true, // 14pt
                }),
            ],
        }),
        // Gạch dưới tiêu ngữ (bằng độ dài dòng chữ)
        new Paragraph({
            spacing: { before: 20, after: 60 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 1100, right: 1100 },
        }),
    ];

    // --- ROW 1: SỐ KÝ HIỆU + TRÍCH YẾU (TRÁI) & ĐỊA DANH NGÀY THÁNG (PHẢI) ---
    const row1Left = [];
    const soKH = data.so_ky_hieu || `Số:      /${data.ky_hieu_loai || 'UBND'}-${data.ky_hieu_co_quan || 'NC'}`;
    row1Left.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 0 },
            children: [
                new TextRun({
                    text: soKH,
                    font: LAYOUT.FONT, size: 26, // 13pt
                }),
            ],
        })
    );

    // V/v Trích yếu (cho Công văn: cỡ 12-13, chữ ĐỨNG chuẩn NĐ30 Phụ lục I mục II.4.b)
    if (data.loai_van_ban === 'cong_van' && data.trich_yeu) {
        const trichYeuLines = data.trich_yeu.split('\n');
        trichYeuLines.forEach(line => {
            row1Left.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 0 },
                    children: [
                        new TextRun({
                            text: line.trim(),
                            font: LAYOUT.FONT, size: 24, italics: false, // 12pt, chữ ĐỨNG chuẩn NĐ30
                        }),
                    ],
                })
            );
        });
    }

    const row1Right = [];
    const ngay = data.ngay || '    ';
    const thang = data.thang || '    ';
    const nam = data.nam || '2026';
    const diaDanh = data.dia_danh || 'Lâm Đồng';
    row1Right.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 0 },
            children: [
                new TextRun({
                    text: `${diaDanh}, ngày ${ngay} tháng ${thang} năm ${nam}`,
                    font: LAYOUT.FONT, size: 28, italics: true, // 14pt, nghiêng
                }),
            ],
        })
    );

    // Tạo Header Table 2 hàng x 2 cột (chuẩn NĐ30, đảm bảo Số và Ngày tháng cùng hàng ngang)
    return new Table({
        width: { size: LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
        borders: BORDERS_NONE,
        columnWidths: [LAYOUT.HEADER_COLS.left, LAYOUT.HEADER_COLS.right],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.HEADER_COLS.left, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: row0Left,
                    }),
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.HEADER_COLS.right, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: row0Right,
                    }),
                ],
            }),
            new TableRow({
                children: [
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.HEADER_COLS.left, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: row1Left,
                    }),
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.HEADER_COLS.right, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: row1Right,
                    }),
                ],
            }),
        ],
    });
}

// ====== HÀM TẠO TÊN LOẠI VB + TRÍCH YẾU ======

/**
 * Tên loại VB (IN HOA, đậm, 14pt) + trích yếu + gạch ngang
 * Chỉ dùng cho VB có tên loại (không dùng cho Công văn)
 */
function createTenLoai(data) {
    const elements = [];

    const tenLoai = TEN_LOAI_VB[data.loai_van_ban] || data.ten_loai || '';
    if (tenLoai) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 360, after: 0 },
                children: [
                    new TextRun({
                        text: tenLoai,
                        font: LAYOUT.FONT, size: 28, bold: true, // 14pt, đậm
                    }),
                ],
            })
        );
    }

    // Trích yếu (nếu có, đậm, cỡ 14)
    if (data.trich_yeu && data.loai_van_ban !== 'cong_van') {
        const trichYeuLines = data.trich_yeu.split('\n');
        trichYeuLines.forEach(line => {
            elements.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: line.trim(),
                            font: LAYOUT.FONT, size: 28, bold: true,
                        }),
                    ],
                })
            );
        });

        // Gạch ngang
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 120 },
                children: [
                    new TextRun({
                        text: '_______________',
                        font: LAYOUT.FONT, size: 28,
                    }),
                ],
            })
        );
    }

    return elements;
}

// ====== HÀM TẠO KÍNH GỬI ======

function createKinhGui(data) {
    const elements = [];
    if (!data.kinh_gui || data.kinh_gui.length === 0) return elements;

    if (data.kinh_gui.length === 1) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 120 },
                children: [
                    new TextRun({
                        text: 'Kính gửi: ',
                        font: LAYOUT.FONT, size: 28, // KHÔNG đậm (đã sửa)
                    }),
                    new TextRun({
                        text: data.kinh_gui[0],
                        font: LAYOUT.FONT, size: 28,
                    }),
                ],
            })
        );
    } else {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 0 },
                children: [
                    new TextRun({
                        text: 'Kính gửi:',
                        font: LAYOUT.FONT, size: 28,
                    }),
                ],
            })
        );
        data.kinh_gui.forEach((item, idx) => {
            const suffix = idx === data.kinh_gui.length - 1 ? '.' : ';';
            elements.push(
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

    return elements;
}

// ====== HÀM TẠO CĂN CỨ ======

function createCanCu(data) {
    const elements = [];
    if (!data.can_cu || data.can_cu.length === 0) return elements;

    data.can_cu.forEach((cc, idx) => {
        const isLast = idx === data.can_cu.length - 1;
        const suffix = isLast ? ',' : ';';
        elements.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: BODY_SPACING,
                indent: { firstLine: 567 },
                children: [
                    new TextRun({
                        text: cc + suffix,
                        font: LAYOUT.FONT, size: 28, italics: true, // NĐ30: căn cứ NGHIÊNG (khác HD36)
                    }),
                ],
            })
        );
    });

    return elements;
}

// ====== HÀM TẠO NỘI DUNG (BODY) ======

function createBody(data) {
    const elements = [];

    // Căn cứ
    if (data.can_cu && data.can_cu.length > 0) {
        elements.push(...createCanCu(data));
    }

    // Theo đề nghị
    if (data.theo_de_nghi) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: BODY_SPACING,
                indent: { firstLine: 567 },
                children: [
                    new TextRun({
                        text: data.theo_de_nghi,
                        font: LAYOUT.FONT, size: 28, italics: true,
                    }),
                ],
            })
        );
    }

    // Dòng "QUYẾT ĐỊNH:" / "QUYẾT NGHỊ:"
    if (data.dong_quyet_dinh) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { ...BODY_SPACING, before: 240 },
                children: [
                    new TextRun({
                        text: data.dong_quyet_dinh,
                        font: LAYOUT.FONT, size: 28, bold: true,
                    }),
                ],
            })
        );
    }

    // Nếu VB có cac_dieu
    if (data.cac_dieu && data.cac_dieu.length > 0) {
        data.cac_dieu.forEach((dieu, idx) => {
            const isLast = idx === data.cac_dieu.length - 1;
            let rawContent = typeof dieu === 'string' ? dieu : (dieu.noi_dung || '');
            rawContent = rawContent.trim();

            // Nếu là điều cuối cùng của văn bản, tự động chuẩn hóa dấu kết thúc ./.
            if (isLast) {
                if (rawContent.endsWith('./.')) {
                    // đã chuẩn
                } else if (rawContent.endsWith('.')) {
                    rawContent = rawContent.slice(0, -1) + './.';
                } else {
                    rawContent = rawContent + './.';
                }
            }

            // Chuẩn hóa tiền tố Điều và nội dung (tránh lặp "Điều X. Điều X.")
            let dieuPrefix = `Điều ${idx + 1}. `;
            let dieuBody = rawContent;
            const matchExistingDieu = rawContent.match(/^(Điều\s+\d+[\.\:]\s*)(.*)$/);
            if (matchExistingDieu) {
                dieuPrefix = matchExistingDieu[1];
                dieuBody = matchExistingDieu[2];
            }

            // Tách tiêu đề Điều nếu có (ví dụ: "Phạm vi điều chỉnh. Quy định này...")
            const titleMatch = dieuBody.match(/^([^\.\:]+[\.\:])\s*(.*)$/);
            if (titleMatch && titleMatch[1].length < 80 && titleMatch[2].length > 0) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: BODY_SPACING,
                        indent: { firstLine: 567 },
                        children: [
                            new TextRun({
                                text: dieuPrefix + titleMatch[1] + ' ',
                                font: LAYOUT.FONT, size: 28, bold: true, // "Điều X. Tiêu đề điều: " ĐẬM
                            }),
                            new TextRun({
                                text: titleMatch[2],
                                font: LAYOUT.FONT, size: 28, // Nội dung tiếp theo THƯỜNG
                            }),
                        ],
                    })
                );
            } else {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: BODY_SPACING,
                        indent: { firstLine: 567 },
                        children: [
                            new TextRun({
                                text: dieuPrefix,
                                font: LAYOUT.FONT, size: 28, bold: true,
                            }),
                            new TextRun({
                                text: dieuBody,
                                font: LAYOUT.FONT, size: 28,
                            }),
                        ],
                    })
                );
            }
        });
    }

    // Nếu VB có noi_dung dạng text — tự nhận diện cấu trúc đề mục chuẩn NĐ30
    if (data.noi_dung) {
        let lines = data.noi_dung.split('\n').map(l => l.trim()).filter(Boolean);

        // Loại bỏ triệt để bất kỳ dòng nào chỉ chứa mỗi "./." hoặc "." hoặc khoảng trắng đứng riêng ở cuối
        while (lines.length > 0) {
            const last = lines[lines.length - 1];
            if (last === './.' || last === '.' || last === '...' || last === '') {
                lines.pop();
            } else {
                break;
            }
        }

        // Gắn chặt "./." vào cuối chữ cuối cùng của dòng cuối cùng (KHÔNG TẠO DÒNG RIÊNG)
        if (lines.length > 0) {
            const lastIdx = lines.length - 1;
            let lastLine = lines[lastIdx];
            if (lastLine.endsWith('./.')) {
                // Đã có chuẩn ./.
            } else if (lastLine.endsWith('.')) {
                lastLine = lastLine.slice(0, -1) + './.';
            } else {
                lastLine = lastLine + './.';
            }
            lines[lastIdx] = lastLine;
        }

        lines.forEach(line => {
            const trimmed = line.trim();

            // 1. Phần / Chương (ví dụ: "Chương I", "Phần thứ nhất")
            if (/^(Chương|Phần)\s+[IVXLCDM\d]+/i.test(trimmed)) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { ...BODY_SPACING, before: 240, after: 60 },
                        children: [
                            new TextRun({
                                text: trimmed,
                                font: LAYOUT.FONT, size: 28, bold: true, // 14pt, đậm
                            }),
                        ],
                    })
                );
                return;
            }

            // 2. Tên chương / Tiêu đề IN HOA đứng riêng (ví dụ: "NHỮNG QUY ĐỊNH CHUNG")
            if (trimmed.length >= 4 && isUpperCase(trimmed) && !trimmed.startsWith('CỘNG HÒA')) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 120 },
                        children: [
                            new TextRun({
                                text: trimmed,
                                font: LAYOUT.FONT, size: 28, bold: true, // 14pt, đậm
                            }),
                        ],
                    })
                );
                return;
            }

            // 3. Mục (ví dụ: "Mục 1", "Mục 2")
            if (/^Mục\s+\d+/i.test(trimmed)) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { ...BODY_SPACING, before: 180, after: 60 },
                        children: [
                            new TextRun({
                                text: trimmed,
                                font: LAYOUT.FONT, size: 28, bold: true,
                            }),
                        ],
                    })
                );
                return;
            }

            // 4. Mục La Mã (ví dụ: "I. MỤC ĐÍCH, YÊU CẦU", "II. NỘI DUNG", "I- ĐÁNH GIÁ...")
            const matchRoman = trimmed.match(/^([IVXLCDM]+[\.\-]\s*)(.*)$/);
            if (matchRoman) {
                const prefix = matchRoman[1];
                const rest = matchRoman[2];
                // Kiểm tra nếu có dấu hai chấm ":" chia tách tiêu đề và nội dung
                const colonIdx = rest.indexOf(':');
                if (colonIdx !== -1 && rest.length > 50) {
                    const titlePart = rest.substring(0, colonIdx + 1);
                    const bodyPart = rest.substring(colonIdx + 1);
                    elements.push(
                        new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: { ...BODY_SPACING, before: 180 },
                            indent: { firstLine: 567 },
                            children: [
                                new TextRun({
                                    text: prefix + titlePart,
                                    font: LAYOUT.FONT, size: 28, bold: true,
                                }),
                                new TextRun({
                                    text: bodyPart,
                                    font: LAYOUT.FONT, size: 28,
                                }),
                            ],
                        })
                    );
                } else {
                    // Toàn bộ dòng là tiêu đề mục La Mã -> ĐẬM
                    elements.push(
                        new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: { ...BODY_SPACING, before: 180 },
                            indent: { firstLine: 567 },
                            children: [
                                new TextRun({
                                    text: trimmed,
                                    font: LAYOUT.FONT, size: 28, bold: true,
                                }),
                            ],
                        })
                    );
                }
                return;
            }

            // 5. Điều (NĐ30: "Điều X. Tên điều" = đậm, nội dung sau = thường)
            const matchDieu = trimmed.match(/^(Điều\s+\d+[\.\:]\s*)(.*)$/);
            if (matchDieu) {
                const prefix = matchDieu[1];
                const rest = matchDieu[2];
                // Tìm dấu chấm hoặc dấu hai chấm kết thúc tiêu đề Điều
                const titleEndMatch = rest.match(/^([^\.\:]+[\.\:])\s*(.*)$/);
                if (titleEndMatch && rest.length > 30) {
                    elements.push(
                        new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: BODY_SPACING,
                            indent: { firstLine: 567 },
                            children: [
                                new TextRun({
                                    text: prefix + titleEndMatch[1] + ' ',
                                    font: LAYOUT.FONT, size: 28, bold: true, // Điều X. Tên điều: ĐẬM
                                }),
                                new TextRun({
                                    text: titleEndMatch[2],
                                    font: LAYOUT.FONT, size: 28, // Nội dung tiếp theo: THƯỜNG
                                }),
                            ],
                        })
                    );
                } else {
                    elements.push(
                        new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: BODY_SPACING,
                            indent: { firstLine: 567 },
                            children: [
                                new TextRun({
                                    text: prefix,
                                    font: LAYOUT.FONT, size: 28, bold: true,
                                }),
                                new TextRun({
                                    text: rest,
                                    font: LAYOUT.FONT, size: 28,
                                }),
                            ],
                        })
                    );
                }
                return;
            }

            // 6. Khoản / Mục số Ả Rập (ví dụ: "1. Về tổ chức bộ máy:", "2. Mục tiêu cụ thể:")
            const matchNumber = trimmed.match(/^(\d+[\.\)]\s*)(.*)$/);
            if (matchNumber) {
                const prefix = matchNumber[1];
                const rest = matchNumber[2];
                const colonIdx = rest.indexOf(':');
                if (colonIdx !== -1 && colonIdx < 80) {
                    // Có tiêu đề trước dấu hai chấm -> In đậm tiêu đề
                    const titlePart = rest.substring(0, colonIdx + 1);
                    const bodyPart = rest.substring(colonIdx + 1);
                    elements.push(
                        new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: BODY_SPACING,
                            indent: { firstLine: 567 },
                            children: [
                                new TextRun({
                                    text: prefix + titlePart,
                                    font: LAYOUT.FONT, size: 28, bold: true, // 1. Tiêu đề: ĐẬM
                                }),
                                new TextRun({
                                    text: bodyPart,
                                    font: LAYOUT.FONT, size: 28, // Nội dung sau: THƯỜNG
                                }),
                            ],
                        })
                    );
                    return;
                }
            }

            // 7. Tiểu mục chữ cái (ví dụ: "a) Về kinh phí:", "b) Về nhân sự:")
            const matchLetter = trimmed.match(/^([a-zđ]\)\s*)(.*)$/i);
            if (matchLetter) {
                const prefix = matchLetter[1];
                const rest = matchLetter[2];
                const colonIdx = rest.indexOf(':');
                if (colonIdx !== -1 && colonIdx < 80) {
                    const titlePart = rest.substring(0, colonIdx + 1);
                    const bodyPart = rest.substring(colonIdx + 1);
                    elements.push(
                        new Paragraph({
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: BODY_SPACING,
                            indent: { firstLine: 567 },
                            children: [
                                new TextRun({
                                    text: prefix + titlePart,
                                    font: LAYOUT.FONT, size: 28, bold: true, // a) Tiêu đề: ĐẬM
                                }),
                                new TextRun({
                                    text: bodyPart,
                                    font: LAYOUT.FONT, size: 28, // Nội dung sau: THƯỜNG
                                }),
                            ],
                        })
                    );
                    return;
                }
            }

            // 8. Dòng nội dung thông thường: thụt đầu dòng 567 dxa (~1cm), căn đều 2 bên
            elements.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: BODY_SPACING,
                    indent: { firstLine: 567 },
                    children: [
                        new TextRun({
                            text: trimmed,
                            font: LAYOUT.FONT, size: 28,
                        }),
                    ],
                })
            );
        });
    }

    return elements;
}

// ====== HÀM TẠO KHỐI CHỮ KÝ ======

function createSignature(data) {
    const chuKyChildren = [];

    // Dòng 1: Quyền hạn (TM., KT., TL.) — đậm
    if (data.quyen_han_ky) {
        chuKyChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.quyen_han_ky,
                        font: LAYOUT.FONT, size: 28, bold: true,
                    }),
                ],
            })
        );
    }

    // Dòng 2: KT. chức vụ (nếu TL+KT kết hợp) — đậm
    // VD: "KT. VỤ TRƯỞNG VỤ TỔ CHỨC CÁN BỘ"
    if (data.kt_chuc_vu) {
        chuKyChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.kt_chuc_vu,
                        font: LAYOUT.FONT, size: 28, bold: true,
                    }),
                ],
            })
        );
    }

    // Dòng 3: Chức vụ người ký
    // - Nếu ký trực tiếp hoặc KT 2 dòng (không có kt_chuc_vu): ĐẬM
    // - Nếu TL+KT 3 dòng (có kt_chuc_vu): KHÔNG đậm (vì là chức vụ cấp dưới)
    if (data.chuc_vu_ky) {
        const isBold = !data.kt_chuc_vu; // Đậm khi không phải TL+KT 3 dòng
        chuKyChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.chuc_vu_ky,
                        font: LAYOUT.FONT, size: 28, bold: isBold,
                    }),
                ],
            })
        );
    }

    // 4 dòng trống
    for (let i = 0; i < 4; i++) {
        chuKyChildren.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: '', font: LAYOUT.FONT, size: 28 })],
            })
        );
    }

    // Họ tên (đậm)
    chuKyChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: data.nguoi_ky || '',
                    font: LAYOUT.FONT, size: 28, bold: true,
                }),
            ],
        })
    );

    return chuKyChildren;
}

// ====== HÀM TẠO NƠI NHẬN ======

/**
 * "Nơi nhận:" (đậm + nghiêng, cỡ 12) + danh sách (cỡ 11)
 * KHÁC HD36: HD36 dùng gạch chân, NĐ30 dùng đậm + nghiêng
 */
function createNoiNhan(data) {
    const noiNhanChildren = [];

    // "Nơi nhận:" — đậm + nghiêng (KHÁC HD36: gạch chân)
    noiNhanChildren.push(
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: 'Nơi nhận:',
                    font: LAYOUT.FONT, size: 24, // cỡ 12
                    bold: true, italics: true,
                }),
            ],
        })
    );

    // Danh sách (cỡ 11)
    if (data.noi_nhan && data.noi_nhan.length > 0) {
        data.noi_nhan.forEach((item, idx) => {
            const isLast = idx === data.noi_nhan.length - 1;
            const isLuu = item.trim().startsWith('Lưu');
            const suffix = isLuu ? '.' : ';';
            noiNhanChildren.push(
                new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: '- ' + item + suffix,
                            font: LAYOUT.FONT, size: 22, // cỡ 11
                        }),
                    ],
                })
            );
        });
    }

    return noiNhanChildren;
}

// ====== TABLE CHỮ KÝ + NƠI NHẬN ======

function createSignatureBlock(data) {
    return new Table({
        width: { size: LAYOUT.CONTENT_WIDTH, type: WidthType.DXA },
        borders: BORDERS_NONE,
        columnWidths: [LAYOUT.SIGNATURE_COLS.left, LAYOUT.SIGNATURE_COLS.right],
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.SIGNATURE_COLS.left, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: createNoiNhan(data),
                    }),
                    new TableCell({
                        borders: BORDERS_NONE,
                        width: { size: LAYOUT.SIGNATURE_COLS.right, type: WidthType.DXA },
                        verticalAlign: VerticalAlign.TOP,
                        children: createSignature(data),
                    }),
                ],
            }),
        ],
    });
}

// ====== HÀM TẠO DOCUMENT ======

function createDocument(children) {
    // Header số trang: căn giữa, cỡ 14, trang 1 không đánh số
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

    return new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: LAYOUT.FONT,
                        size: 28,
                    },
                },
            },
        },
        sections: [{
            properties: {
                titlePage: true,
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
        }],
    });
}

// ====== EXPORT ======

module.exports = {
    LAYOUT,
    BORDERS_NONE,
    BODY_SPACING,
    TEN_LOAI_VB,
    createHeader,
    createTenLoai,
    createKinhGui,
    createCanCu,
    createBody,
    createSignature,
    createNoiNhan,
    createSignatureBlock,
    createDocument,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
};
