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
function createHeader(data) {
    // --- CỘT TRÁI ---
    const leftChildren = [];

    // CQ chủ quản (nếu có)
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

    // CQ ban hành (ĐẬM)
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: data.co_quan_ban_hanh || 'BỘ TÀI CHÍNH',
                    font: LAYOUT.FONT, size: 26, bold: true, // 13pt, đậm
                }),
            ],
        })
    );

    // Gạch ngang 1/3 (KHÁC HD36: dấu sao *)
    leftChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 80 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 1500, right: 1500 },
        })
    );

    // Số ký hiệu
    const soKH = data.so_ky_hieu || `Số:      /${data.ky_hieu_loai || 'CV'}-${data.ky_hieu_co_quan || 'BTC'}`;
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: soKH,
                    font: LAYOUT.FONT, size: 26, // 13pt
                }),
            ],
        })
    );

    // V/v Trích yếu (chỉ cho Công văn, cỡ 12, nghiêng)
    if (data.loai_van_ban === 'cong_van' && data.trich_yeu) {
        const trichYeuLines = data.trich_yeu.split('\n');
        trichYeuLines.forEach(line => {
            leftChildren.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 0 },
                    children: [
                        new TextRun({
                            text: line.trim(),
                            font: LAYOUT.FONT, size: 24, italics: true, // cỡ 12, nghiêng
                        }),
                    ],
                })
            );
        });
    }

    // --- CỘT PHẢI ---
    const rightChildren = [];

    // Quốc hiệu (13pt, đậm, IN HOA)
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                    font: LAYOUT.FONT, size: 26, bold: true, // 13pt
                }),
            ],
        })
    );

    // Tiêu ngữ (14pt, đậm)
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

    // Gạch dưới tiêu ngữ
    rightChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 0 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 1100, right: 1100 },
        })
    );

    // Địa danh, ngày tháng (14pt, nghiêng)
    const ngay = data.ngay || '    ';
    const thang = data.thang || '    ';
    const nam = data.nam || '2026';
    const diaDanh = data.dia_danh || 'Hà Nội';
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: `${diaDanh}, ngày ${ngay} tháng ${thang} năm ${nam}`,
                    font: LAYOUT.FONT, size: 28, italics: true, // 14pt, nghiêng
                }),
            ],
        })
    );

    // Tạo 1 table duy nhất
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
            elements.push(
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: BODY_SPACING,
                    indent: { firstLine: 567 },
                    children: [
                        new TextRun({
                            text: `Điều ${idx + 1}. `,
                            font: LAYOUT.FONT, size: 28, bold: true,
                        }),
                        new TextRun({
                            text: typeof dieu === 'string' ? dieu : (dieu.noi_dung || ''),
                            font: LAYOUT.FONT, size: 28,
                        }),
                    ],
                })
            );
        });
    }

    // Nếu VB có noi_dung dạng text — tự nhận diện cấu trúc
    if (data.noi_dung) {
        const lines = data.noi_dung.split('\n').filter(l => l.trim());

        // Tự động thêm "./" trước "." cuối cùng nếu chưa có (VBHC kết thúc ./.)
        if (lines.length > 0) {
            const lastIdx = lines.length - 1;
            const lastLine = lines[lastIdx].trimEnd();
            if (lastLine.endsWith('.') && !lastLine.endsWith('./.')) {
                lines[lastIdx] = lastLine.slice(0, -1) + './.';
            } else if (!lastLine.endsWith('./.')) {
                lines[lastIdx] = lastLine + './.';
            }
        }
        lines.forEach(line => {
            const trimmed = line.trim();

            // Phần / Chương
            if (/^(Chương|Phần)\s/i.test(trimmed)) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { ...BODY_SPACING, before: 240 },
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

            // Tên chương IN HOA
            if (trimmed.length >= 5 && isUpperCase(trimmed)) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 120 },
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

            // Mục
            if (/^Mục\s\d/i.test(trimmed)) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: BODY_SPACING,
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

            // Điều (NĐ30: Điều X. + tên = đậm, nội dung thường)
            const matchDieu = trimmed.match(/^(Điều\s\d+\.\s*)(.*)$/);
            if (matchDieu) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: BODY_SPACING,
                        indent: { firstLine: 567 },
                        children: [
                            new TextRun({
                                text: matchDieu[1],
                                font: LAYOUT.FONT, size: 28, bold: true,
                            }),
                            new TextRun({
                                text: matchDieu[2],
                                font: LAYOUT.FONT, size: 28,
                            }),
                        ],
                    })
                );
                return;
            }

            // Tiêu đề La Mã I-, II-
            const matchRoman = trimmed.match(/^([IVXLC]+-\s*)(.*)$/);
            if (matchRoman) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: BODY_SPACING,
                        indent: { firstLine: 567 },
                        children: [
                            new TextRun({
                                text: matchRoman[1],
                                font: LAYOUT.FONT, size: 28, bold: true,
                            }),
                            new TextRun({
                                text: matchRoman[2],
                                font: LAYOUT.FONT, size: 28, bold: true,
                            }),
                        ],
                    })
                );
                return;
            }

            // Dòng thường
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
