const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType,
  LineRuleType,
} = require('docx');

const FONT = 'Times New Roman';

const BORDERS_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

const BORDER_SOLID_BLACK = {
  style: BorderStyle.SINGLE,
  size: 6, // 0.75 pt
  color: '000000',
};

const CELL_BORDER_ALL = {
  top: BORDER_SOLID_BLACK,
  bottom: BORDER_SOLID_BLACK,
  left: BORDER_SOLID_BLACK,
  right: BORDER_SOLID_BLACK,
};

const SPACING_COMPACT = {
  before: 40,
  after: 40,
  line: 260,
  lineRule: LineRuleType.AT_LEAST,
};

function createPhieuTrinhDocx(data) {
  const d = {
    so_ky_hieu: data.so_ky_hieu || '25-9/26/PT-NC',
    co_quan_cap_tren: data.co_quan_cap_tren || 'UBND TỈNH LÂM ĐỒNG',
    co_quan_ban_hanh: data.co_quan_ban_hanh || 'VĂN PHÒNG',
    kinh_gui: data.kinh_gui || [
      'Lãnh đạo UBND tỉnh;',
      'Lãnh đạo Văn phòng UBND tỉnh.',
    ],
    van_ban_trinh: data.van_ban_trinh || 'Báo cáo số 559/BC-STP ngày 10/10/2026 của Sở Tư pháp.',
    trich_yeu: data.trich_yeu || '',
    check_van_ban_trinh: Boolean(data.check_van_ban_trinh),
    check_trung_uong: Boolean(data.check_trung_uong),
    check_tinh_uy: Boolean(data.check_tinh_uy),
    check_hdnd: Boolean(data.check_hdnd),
    check_dang_uy: Boolean(data.check_dang_uy),
    check_khac: Boolean(data.check_khac),
    check_ubnd: Boolean(data.check_ubnd),
    cac_co_quan_trinh: data.cac_co_quan_trinh || 'Sở Tư pháp.',
    tham_quyen: data.tham_quyen || 'Chủ tịch Ủy ban nhân dân tỉnh.',
    de_xuat_phuong_an: data.de_xuat_phuong_an || '',
    y_kien_lua_chon: data.y_kien_lua_chon || 1,
    y_kien_sua: data.y_kien_sua || '',
    y_kien_ly_do: data.y_kien_ly_do || '',
    do_mat: data.do_mat || 'Không',
    phong_xu_ly: data.phong_xu_ly || 'PHÒNG NỘI CHÍNH',
    chuyen_vien: data.chuyen_vien || 'Trương Hải Châu',
    ngay_chuyen_vien: data.ngay_chuyen_vien || 'Ngày 07 tháng 10 năm 2026',
    lanh_dao_phong: data.lanh_dao_phong || 'Lương Thị Nguyệt Thanh',
    ngay_lanh_dao_phong: data.ngay_lanh_dao_phong || 'Ngày 07 tháng 10 năm 2026',
    lanh_dao_vp: data.lanh_dao_vp || 'Nguyễn Tuấn Anh',
    ngay_lanh_dao_vp: data.ngay_lanh_dao_vp || 'Ngày ..... tháng 10 năm 2026',
    lanh_dao_tinh: data.lanh_dao_tinh || 'Đinh Văn Tuấn',
    ngay_lanh_dao_tinh: data.ngay_lanh_dao_tinh || 'Ngày ....... tháng 10 năm 2026',
  };

  const box = (checked) => (checked ? '☑' : '☐');

  const headerTable = new Table({
    width: { size: 9071, type: WidthType.DXA },
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4000, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: d.co_quan_cap_tren, font: FONT, size: 24, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 20 },
                children: [new TextRun({ text: d.co_quan_ban_hanh, font: FONT, size: 24, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 0 },
                children: [new TextRun({ text: `Số: ${d.so_ky_hieu}`, font: FONT, size: 24 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5071, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font: FONT, size: 24, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: 'Độc lập - Tự do - Hạnh phúc',
                    font: FONT,
                    size: 26,
                    bold: true,
                    underline: { type: 'single' },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text: 'PHIẾU TRÌNH', font: FONT, size: 28, bold: true })],
  });

  const kinhGuiParagraphs = [
    new Paragraph({
      spacing: { before: 0, after: 20 },
      indent: { left: 3000 },
      children: [new TextRun({ text: 'Kính gửi:', font: FONT, size: 26, bold: true })],
    }),
    ...d.kinh_gui.map(
      (item) =>
        new Paragraph({
          spacing: { before: 0, after: 20 },
          indent: { left: 4000 },
          children: [new TextRun({ text: `- ${item.replace(/^-+\s*/, '')}`, font: FONT, size: 24 })],
        })
    ),
  ];

  const checkboxGridTable = new Table({
    width: { size: 8700, type: WidthType.DXA },
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Văn bản của cơ quan trình `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_van_ban_trinh), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Quy chế làm việc của Tỉnh ủy `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_tinh_uy), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Quy chế làm việc của Đảng ủy UBND tỉnh `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_dang_uy), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Quy chế làm việc của UBND tỉnh `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_ubnd), font: FONT, size: 26 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4200, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Bộ, ngành Trung ương `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_trung_uong), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ HĐND tỉnh `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_hdnd), font: FONT, size: 26 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({ text: `+ Cơ quan khác `, font: FONT, size: 23 }),
                  new TextRun({ text: box(d.check_khac), font: FONT, size: 26 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const proposalParagraphs = [];
  if (d.de_xuat_phuong_an) {
    const parts = d.de_xuat_phuong_an.split(/\n\s*\n|\n/);
    for (const part of parts) {
      if (part.trim()) {
        proposalParagraphs.push(
          new Paragraph({
            spacing: SPACING_COMPACT,
            children: [new TextRun({ text: part.trim(), font: FONT, size: 23 })],
          })
        );
      }
    }
  }

  const mainContentCell = new TableCell({
    width: { size: 9071, type: WidthType.DXA },
    borders: CELL_BORDER_ALL,
    children: [
      new Paragraph({
        spacing: { before: 60, after: 40 },
        children: [new TextRun({ text: 'I. NỘI DUNG TRÌNH/CHỈ ĐẠO', font: FONT, size: 24, bold: true })],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({ text: '1. Văn bản/cơ quan, đơn vị: ', font: FONT, size: 23, bold: true, italics: true }),
          new TextRun({ text: d.van_ban_trinh, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({ text: '2. Trích yếu: ', font: FONT, size: 23, bold: true, italics: true }),
          new TextRun({ text: d.trich_yeu, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({
            text: 'II. RÀ SOÁT, TỔNG HỢP CỦA PHÒNG CHUYÊN MÔN THUỘC VĂN PHÒNG',
            font: FONT,
            size: 24,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: '1. Lưu ý thêm (Rà soát cần phải xin ý kiến các cơ quan thì đánh dấu X vào ô tương ứng):',
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
        ],
      }),
      checkboxGridTable,
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: '2. Các sở, ban, ngành, đơn vị, địa phương trình (kết quả đề nghị): ',
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
          new TextRun({ text: d.cac_co_quan_trinh, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: '3. Thẩm quyền (Chọn ghi thẩm quyền tương ứng): ',
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
          new TextRun({ text: d.tham_quyen, font: FONT, size: 23 }),
        ],
      }),
      new Paragraph({
        spacing: SPACING_COMPACT,
        children: [
          new TextRun({
            text: '4. Phòng chuyên môn của Văn phòng UBND tỉnh đề xuất phương án: ',
            font: FONT,
            size: 23,
            bold: true,
            italics: true,
          }),
        ],
      }),
      ...proposalParagraphs,
      new Paragraph({
        spacing: { before: 40, after: 20 },
        children: [
          new TextRun({ text: '4.1. Thống nhất hoàn toàn   ', font: FONT, size: 23, italics: true }),
          new TextRun({ text: box(d.y_kien_lua_chon === 1), font: FONT, size: 26 }),
          new TextRun({
            text: ' ......................................................................................................................',
            font: FONT,
            size: 20,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({ text: '4.2. Thống nhất              ', font: FONT, size: 23, italics: true }),
          new TextRun({ text: box(d.y_kien_lua_chon === 2), font: FONT, size: 26 }),
          new TextRun({
            text: ` Sửa: ${d.y_kien_sua || '..................................................................................................................'}`,
            font: FONT,
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 40 },
        children: [
          new TextRun({ text: '4.3. Không thống nhất        ', font: FONT, size: 23, italics: true }),
          new TextRun({ text: box(d.y_kien_lua_chon === 3), font: FONT, size: 26 }),
          new TextRun({
            text: ` Lý do: ${d.y_kien_ly_do || '...............................................................................................................'}`,
            font: FONT,
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 60 },
        children: [
          new TextRun({ text: '5. Độ mật: ', font: FONT, size: 23, bold: true, italics: true }),
          new TextRun({ text: d.do_mat, font: FONT, size: 23 }),
        ],
      }),
    ],
  });

  const signatureBlockRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 5200, type: WidthType.DXA },
        borders: CELL_BORDER_ALL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: `PHÒNG XỬ LÝ CHÍNH: ${d.phong_xu_ly}`,
                font: FONT,
                size: 24,
                bold: true,
              }),
            ],
          }),
          new Table({
            width: { size: 5200, type: WidthType.DXA },
            borders: {
              top: BORDER_SOLID_BLACK,
              bottom: BORDERS_NONE.bottom,
              left: BORDERS_NONE.left,
              right: BORDERS_NONE.right,
              insideHorizontal: BORDERS_NONE.insideHorizontal,
              insideVertical: BORDER_SOLID_BLACK,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 20, after: 0 },
                        children: [new TextRun({ text: 'Chuyên viên', font: FONT, size: 23, bold: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 400 },
                        children: [new TextRun({ text: d.ngay_chuyen_vien, font: FONT, size: 21, italics: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 20 },
                        children: [new TextRun({ text: d.chuyen_vien, font: FONT, size: 23, bold: true })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 2600, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 20, after: 0 },
                        children: [new TextRun({ text: 'Lãnh đạo phòng', font: FONT, size: 23, bold: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 400 },
                        children: [new TextRun({ text: d.ngay_lanh_dao_phong, font: FONT, size: 21, italics: true })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400, after: 20 },
                        children: [new TextRun({ text: d.lanh_dao_phong, font: FONT, size: 23, bold: true })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 3871, type: WidthType.DXA },
        borders: CELL_BORDER_ALL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 20 },
            children: [new TextRun({ text: 'LÃNH ĐẠO VĂN PHÒNG', font: FONT, size: 24, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 300 },
            children: [new TextRun({ text: '_________________________', font: FONT, size: 20 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 300 },
            children: [new TextRun({ text: d.ngay_lanh_dao_vp, font: FONT, size: 21, italics: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 20 },
            children: [new TextRun({ text: d.lanh_dao_vp, font: FONT, size: 23, bold: true })],
          }),
        ],
      }),
    ],
  });

  const lanhDaoTinhRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 9071, type: WidthType.DXA },
        columnSpan: 2,
        borders: CELL_BORDER_ALL,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 20 },
            children: [new TextRun({ text: 'Ý KIẾN CỦA LÃNH ĐẠO UBND TỈNH', font: FONT, size: 24, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 1200 },
            children: [new TextRun({ text: d.ngay_lanh_dao_tinh, font: FONT, size: 21, italics: true })],
          }),
        ],
      }),
    ],
  });

  const outerBoxTable = new Table({
    width: { size: 9071, type: WidthType.DXA },
    borders: CELL_BORDER_ALL,
    rows: [
      new TableRow({ children: [mainContentCell] }),
      signatureBlockRow,
      lanhDaoTinhRow,
    ],
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
          },
        },
        children: [
          headerTable,
          titleParagraph,
          ...kinhGuiParagraphs,
          new Paragraph({ spacing: { before: 60, after: 60 } }),
          outerBoxTable,
        ],
      },
    ],
  });
}

module.exports = { createPhieuTrinhDocx };
