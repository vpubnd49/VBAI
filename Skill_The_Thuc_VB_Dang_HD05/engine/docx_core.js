/**
 * docx_core.js — Engine chung sinh văn bản Đảng (.docx)
 * Chuẩn Hướng dẫn 05-HD/VPTW (thay thế HD36-HD/VPTW từ ngày ký)
 *
 * Export các hàm tạo từng thành phần thể thức:
 *   createHeader, createSoKyHieu, createTenLoai, createBody,
 *   createSignature, createNoiNhan, createDocument, LAYOUT
 */

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, BorderStyle, WidthType,
    ShadingType, VerticalAlign, LineRuleType, UnderlineType,
    Header, PageNumber,
} = require('docx');

// ====== THÔNG SỐ THỂ THỨC (HD05) ======

const LAYOUT = {
    PAGE: { width: 11906, height: 16838 },   // A4
    MARGIN: {
        top: 1134,      // 20mm
        bottom: 1134,   // 20mm
        left: 1701,     // 30mm
        right: 850,     // 15mm (KHÁC NĐ30: 1134) — HD05 giữ nguyên
    },
    FONT: 'Times New Roman',
    // Chiều rộng vùng trình bày = 11906 - 1701 - 850 = 9355 dxa
    CONTENT_WIDTH: 9355,
    HEADER_COLS: {
        left: 3500,     // Cột trái: Cơ quan
        right: 5855,    // Cột phải: Tiêu đề Đảng
    },
    SIGNATURE_COLS: {
        left: 4500,     // Nơi nhận
        right: 4855,    // Chữ ký
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

// Body spacing chuẩn HD05: ≥6pt, line ≥18pt exactly (giữ nguyên từ HD36)
const BODY_SPACING = {
    before: 120,   // 6pt
    after: 120,    // 6pt
    line: 360,     // 18pt (KHÁC NĐ30: 340 = 17pt)
    lineRule: LineRuleType.EXACT,
};

// Hàm phụ: kiểm tra chuỗi có phải IN HOA không (>60% ký tự hoa)
function isUpperCase(str) {
    const letters = str.replace(/[^a-zA-ZÀ-ỹ]/g, '');
    if (letters.length === 0) return false;
    const upper = letters.replace(/[^A-ZÀ-Ỹ]/g, '');
    return upper.length / letters.length > 0.6;
}

// ====== BẢNG TRA KÝ HIỆU LOẠI VB ======

const TEN_LOAI_VB = {
    nghi_quyet: 'NGHỊ QUYẾT',
    chi_thi: 'CHỈ THỊ',
    ket_luan: 'KẾT LUẬN',
    quyet_dinh: 'QUYẾT ĐỊNH',
    quy_dinh: 'QUY ĐỊNH',
    quy_che: 'QUY CHẾ',
    bao_cao: 'BÁO CÁO',
    to_trinh: 'TỜ TRÌNH',
    thong_bao: 'THÔNG BÁO',
    huong_dan: 'HƯỚNG DẪN',
    chuong_trinh: 'CHƯƠNG TRÌNH',
    thong_tri: 'THÔNG TRI',
    bien_ban: 'BIÊN BẢN',
    cong_van: '',  // Công văn không có tên loại
};

// ====== HÀM TẠO HEADER (GỘP CQ + SỐ KÝ HIỆU + NGÀY THÁNG) ======

/**
 * Tạo 1 table duy nhất chứa toàn bộ header:
 * - Trái: CQ cấp trên → CQ ban hành → * → Số KH → (trích yếu CV)
 * - Phải: ĐẢNG CỘNG SẢN VIỆT NAM → gạch dưới → Ngày tháng
 * Mỗi bên ở vị trí tự nhiên, KHÔNG ép ngang hàng.
 */
function createHeader(data) {
    // --- CỘT TRÁI ---
    const leftChildren = [];

    // Tên CQ cấp trên (nếu có)
    if (data.co_quan_cap_tren) {
        leftChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                    new TextRun({
                        text: data.co_quan_cap_tren,
                        font: LAYOUT.FONT, size: 28, // cỡ 14
                    }),
                ],
            })
        );
    }

    // Tên CQ ban hành (ĐẬM)
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: data.co_quan_ban_hanh,
                    font: LAYOUT.FONT, size: 28, bold: true, // cỡ 14, đậm
                }),
            ],
        })
    );

    // Dấu sao (*)
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 80 },
            children: [
                new TextRun({
                    text: '*',
                    font: LAYOUT.FONT, size: 28,
                }),
            ],
        })
    );

    // Số ký hiệu
    const soKH = data.so_ky_hieu || `Số      -${data.ky_hieu_loai || 'CV'}/${data.ky_hieu_co_quan || ''}`;
    leftChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: soKH,
                    font: LAYOUT.FONT, size: 28,
                }),
            ],
        })
    );

    // Trích yếu công văn (nếu là công văn, cỡ 12, nghiêng, dưới số ký hiệu)
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

    // Tiêu đề "ĐẢNG CỘNG SẢN VIỆT NAM" (cỡ 15, đậm)
    rightChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
                new TextRun({
                    text: 'ĐẢNG CỘNG SẢN VIỆT NAM',
                    font: LAYOUT.FONT, size: 30, bold: true, // cỡ 15
                }),
            ],
        })
    );

    // Gạch dưới tiêu đề (Border Top, bằng chiều dài tiêu đề)
    rightChildren.push(
        new Paragraph({
            spacing: { before: 20, after: 0 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 },
            },
            indent: { left: 928, right: 928 },
        })
    );

    // Địa danh, ngày tháng
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
                    font: LAYOUT.FONT, size: 28, italics: true, // cỡ 14, nghiêng
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

// Giữ createSoKyHieu nhưng bây giờ nó chỉ là alias, các template cũ gọi createHeader là đủ
function createSoKyHieu(data) {
    // Trả về mảng rỗng — thông tin đã gộp vào createHeader
    return new Paragraph({ spacing: { before: 0, after: 0 }, children: [] });
}

// ====== HÀM TẠO TÊN LOẠI VB + TRÍCH YẾU ======

/**
 * Tạo dòng tên loại VB (IN HOA, đậm, cỡ 15-16) + trích yếu + gạch ngang -----
 * Chỉ dùng cho VB có tên loại (không dùng cho công văn)
 */
function createTenLoai(data) {
    const elements = [];

    // Tên loại VB
    const tenLoai = TEN_LOAI_VB[data.loai_van_ban] || data.ten_loai || '';
    if (tenLoai) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 360, after: 0 },
                children: [
                    new TextRun({
                        text: tenLoai,
                        font: LAYOUT.FONT, size: 32, bold: true, // cỡ 16, đậm
                    }),
                ],
            })
        );
    }

    // Trích yếu
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
                            font: LAYOUT.FONT, size: 28, bold: true, // cỡ 14, đậm
                        }),
                    ],
                })
            );
        });

        // 5 dấu gạch nối
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 120 },
                children: [
                    new TextRun({
                        text: '-----',
                        font: LAYOUT.FONT, size: 28,
                    }),
                ],
            })
        );
    }

    return elements;
}

// ====== HÀM TẠO KÍNH GỬI ======

/**
 * "Kính gửi:" / "Kính trình:" + danh sách CQ nhận
 * HD05: Công văn dùng "Kính gửi", Tờ trình dùng "Kính trình" (9.2.4)
 * Nghiêng, cỡ 14
 */
function createKinhGui(data) {
    // HD05 9.2.4: Tờ trình dùng "Kính trình", Công văn dùng "Kính gửi"
    const label = data.loai_van_ban === 'to_trinh' ? 'Kính trình' : 'Kính gửi';
    const elements = [];
    if (!data.kinh_gui || data.kinh_gui.length === 0) return elements;

    if (data.kinh_gui.length === 1) {
        elements.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 120 },
                children: [
                    new TextRun({
                        text: label + ': ',
                        font: LAYOUT.FONT, size: 28, italics: true,
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
                        text: label + ':',
                        font: LAYOUT.FONT, size: 28, italics: true,
                    }),
                ],
            })
        );
        data.kinh_gui.forEach((item, idx) => {
            const suffix = idx === data.kinh_gui.length - 1 ? '.' : ',';
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
        // Căn cứ cuối cùng: dấu phẩy; các căn cứ khác: dấu chấm phẩy
        const suffix = isLast ? ',' : ';';
        elements.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: BODY_SPACING,
                indent: { firstLine: 567 },
                children: [
                    new TextRun({
                        text: '- ' + cc + suffix,
                        font: LAYOUT.FONT, size: 28,
                    }),
                ],
            })
        );
    });

    return elements;
}

// ====== HÀM TẠO NỘI DUNG (BODY) ======

/**
 * Tạo nội dung VB từ data.noi_dung (chuỗi) hoặc data.cac_dieu (mảng)
 */
function createBody(data) {
    const elements = [];

    // Nếu có phần căn cứ
    if (data.can_cu && data.can_cu.length > 0) {
        elements.push(...createCanCu(data));
    }

    // Nếu có "Theo đề nghị"
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

    // Nếu VB có "cac_dieu" (QĐ, NQ dạng cấu trúc)
    if (data.cac_dieu && data.cac_dieu.length > 0) {
        // Dòng "[TÊN LOẠI:]" ví dụ "QUYẾT ĐỊNH:" hoặc bỏ qua
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

    // Nếu VB có "noi_dung" dạng text thường — tự nhận diện cấu trúc
    if (data.noi_dung) {
        const lines = data.noi_dung.split('\n').filter(l => l.trim());
        lines.forEach(line => {
            const trimmed = line.trim();

            // --- Phần / Chương: "Chương I", "Chương II", "Phần thứ nhất"... ---
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

            // --- Tên chương/phần/mục: toàn bộ IN HOA (≥5 ký tự, >60% hoa) → đậm, giữa ---
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

            // --- Mục: "Mục 1", "Mục 2"... → đậm, giữa ---
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

            // --- Điều: "Điều 1. Phạm vi" → TOÀN BỘ DÒNG ĐẬM (Phụ lục 3 HD05) ---
            const matchDieu = trimmed.match(/^(Điều\s\d+\..*)$/);
            if (matchDieu) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: BODY_SPACING,
                        indent: { firstLine: 567 },
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

            // --- Điểm: "a)", "b)"... → lùi đầu dòng bình thường ---
            // --- Khoản kiểu I-, II-: "I-", "II-"... → đậm ---
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

            // --- Khoản: "1. ...", "2. ..."... → phần số in đậm (VB Đảng dùng 1,2,3 thay vì a,b,c) ---
            const matchKhoan = trimmed.match(/^(\d+\.\s)(.*)$/);
            if (matchKhoan) {
                elements.push(
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: BODY_SPACING,
                        indent: { firstLine: 567 },
                        children: [
                            new TextRun({
                                text: matchKhoan[1],
                                font: LAYOUT.FONT, size: 28, bold: true,
                            }),
                            new TextRun({
                                text: matchKhoan[2],
                                font: LAYOUT.FONT, size: 28,
                            }),
                        ],
                    })
                );
                return;
            }

            // --- Dòng thường ---
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

/**
 * Tạo khối chữ ký:
 *   [QUYỀN HẠN + TÊN TẬP THỂ]  ← đậm
 *   [CHỨC VỤ]                    ← thường
 *   (4 dòng trống)
 *   [Họ và tên]                  ← đậm
 */
function createSignature(data) {
    const chuKyChildren = [];

    // Quyền hạn (T/M, K/T, T/L)
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

    // Chức vụ
    if (data.chuc_vu_ky) {
        chuKyChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: data.chuc_vu_ky,
                        font: LAYOUT.FONT, size: 28,
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

    // Họ tên
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
 * "Nơi nhận:" (gạch chân, cỡ 14) + danh sách (cỡ 12)
 */
function createNoiNhan(data) {
    const noiNhanChildren = [];

    // "Nơi nhận:" — gạch chân (KHÁC NĐ30: đậm+nghiêng) — HD05 giữ nguyên
    noiNhanChildren.push(
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: 'Nơi nhận:',
                    font: LAYOUT.FONT, size: 28,
                    underline: { type: UnderlineType.SINGLE },
                }),
            ],
        })
    );

    // HD05 9.2.5: Dòng đầu "Như trên" cho CV/TTr khi có Kính gửi/Kính trình
    if ((data.loai_van_ban === 'cong_van' || data.loai_van_ban === 'to_trinh') &&
        data.kinh_gui && data.kinh_gui.length > 0) {
        noiNhanChildren.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: '- Như trên;',
                        font: LAYOUT.FONT, size: 24, // cỡ 12
                    }),
                ],
            })
        );
    }

    // Danh sách nơi nhận (cỡ 12)
    // HD05 9.2.5: giữa các CQ dùng dấu chấm phẩy (;), cuối cùng dấu chấm (.)
    if (data.noi_nhan && data.noi_nhan.length > 0) {
        data.noi_nhan.forEach((item, idx) => {
            const isLast = idx === data.noi_nhan.length - 1;
            const suffix = isLast ? '.' : ';';
            noiNhanChildren.push(
                new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                        new TextRun({
                            text: '- ' + item + suffix,
                            font: LAYOUT.FONT, size: 24, // cỡ 12
                        }),
                    ],
                })
            );
        });
    }

    return noiNhanChildren;
}

// ====== HÀM TẠO TABLE CHỮ KÝ + NƠI NHẬN ======

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
    // Header số trang: căn giữa, cỡ 14, cách mép trên 10mm
    const pageNumberHeader = new Header({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        children: [PageNumber.CURRENT],
                        font: LAYOUT.FONT,
                        size: 28, // cỡ 14
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
                        size: 28, // 14pt default
                    },
                },
            },
        },
        sections: [{
            properties: {
                titlePage: true, // Trang 1 không đánh số (HD05)
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
                // first: không set → trang 1 không có header
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
    createSoKyHieu,
    createTenLoai,
    createKinhGui,
    createCanCu,
    createBody,
    createSignature,
    createNoiNhan,
    createSignatureBlock,
    createDocument,
    // Re-export docx components for convenience
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
};
