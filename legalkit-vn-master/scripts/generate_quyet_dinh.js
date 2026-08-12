#!/usr/bin/env node
/**
 * generate_quyet_dinh.js
 * Sinh file .docx Quyet dinh chuan Nghi dinh 30/2020/ND-CP
 *
 * Quyet dinh khac Cong van o:
 * - Co TEN LOAI VAN BAN ("QUYET DINH") in hoa, dam, giua trang
 * - Phan "Can cu" truoc noi dung
 * - Cau truc: Can cu → QUYET DINH → Dieu 1, 2, 3...
 *
 * Usage:
 *   node scripts/generate_quyet_dinh.js --input <path/to/input.json> --output <path/to/output.docx>
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, HeadingLevel,
  SectionType, PageSize, convertMillimetersToTwip,
  TableLayoutType, VerticalAlign
} = require("docx");

// =============================================
// CONSTANTS - Thong so chuan ND30
// =============================================
const FONT = "Times New Roman";
const PAGE_MARGIN = {
  top: convertMillimetersToTwip(20),
  bottom: convertMillimetersToTwip(20),
  left: convertMillimetersToTwip(30),
  right: convertMillimetersToTwip(20),
};
const COL_LEFT = 3500;
const COL_RIGHT = 5571;
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const BODY_SPACING = {
  before: 120,
  after: 120,
  line: 340,
};

// =============================================
// HELPERS
// =============================================
function parseArgs() {
  const args = process.argv.slice(2);
  let input = null, output = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) input = args[++i];
    if (args[i] === "--output" && args[i + 1]) output = args[++i];
  }
  if (!input || !output) {
    console.error("Usage: node generate_quyet_dinh.js --input <file.json> --output <file.docx>");
    process.exit(1);
  }
  return { input, output };
}

function today() {
  const d = new Date();
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

function borderTopLine(indentLeft, indentRight) {
  return new Paragraph({
    spacing: { before: 20, after: 0 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 },
    },
    indent: { left: indentLeft, right: indentRight },
  });
}

// =============================================
// HEADER TABLE - Giong cong van
// =============================================
function buildHeaderTable(data) {
  const diaDanh = data.dia_danh || "Hà Nội";

  return new Table({
    columnWidths: [COL_LEFT, COL_RIGHT],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      // DONG 1
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_LEFT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: data.co_quan_chu_quan.toUpperCase(),
                    font: FONT, size: 26,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: data.co_quan_ban_hanh.toUpperCase(),
                    font: FONT, size: 26, bold: true,
                  }),
                ],
              }),
              borderTopLine(1350, 1350),
            ],
          }),
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_RIGHT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                    font: FONT, size: 26, bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: "Độc lập - Tự do - Hạnh phúc",
                    font: FONT, size: 28, bold: true,
                  }),
                ],
              }),
              borderTopLine(1100, 1100),
            ],
          }),
        ],
      }),

      // DONG 2: So ky hieu + Dia danh
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_LEFT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 0 },
                children: [
                  new TextRun({
                    text: `Số: ....../${data.don_vi_soan_thao || "QĐ-..."}`,
                    font: FONT, size: 26,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_RIGHT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 0 },
                children: [
                  new TextRun({
                    text: `${diaDanh}, ${data.ngay_thang || today()}`,
                    font: FONT, size: 28, italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// =============================================
// TEN LOAI VAN BAN + TRICH YEU
// =============================================
function buildTenLoai(data) {
  return [
    // QUYET DINH (in hoa, dam, giua)
    new Paragraph({
      spacing: { before: 360, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "QUYẾT ĐỊNH",
          font: FONT, size: 28, bold: true, // 14pt dam HOA
        }),
      ],
    }),
    // Trich yeu (khong co "V/v", in thuong, dam)
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: data.trich_yeu,
          font: FONT, size: 28, bold: true,
        }),
      ],
    }),
    // Duong ke duoi trich yeu
    borderTopLine(2500, 2500),
  ];
}

// =============================================
// CAN CU
// =============================================
function buildCanCu(data) {
  if (!data.can_cu || data.can_cu.length === 0) return [];

  const paragraphs = [];
  data.can_cu.forEach((cc, i) => {
    paragraphs.push(
      new Paragraph({
        spacing: BODY_SPACING,
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        children: [
          new TextRun({
            text: `Căn cứ ${cc}${i < data.can_cu.length - 1 ? ";" : "."}`,
            font: FONT, size: 28, italics: true,
          }),
        ],
      })
    );
  });

  return paragraphs;
}

// =============================================
// BODY - Cac Dieu
// =============================================
function buildBody(data) {
  const paragraphs = [];

  // Neu noi_dung la chuoi, tach theo dong
  if (typeof data.noi_dung === "string") {
    const lines = data.noi_dung.split("\n").filter(l => l.trim());
    lines.forEach(line => {
      const trimmed = line.trim();
      // Phat hien "Dieu X." -> Dam
      if (/^Điều \d+\./.test(trimmed)) {
        paragraphs.push(
          new Paragraph({
            spacing: { ...BODY_SPACING, before: 240 },
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 720 },
            children: [
              new TextRun({ text: trimmed, font: FONT, size: 28, bold: true }),
            ],
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            spacing: BODY_SPACING,
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 720 },
            children: [
              new TextRun({ text: trimmed, font: FONT, size: 28 }),
            ],
          })
        );
      }
    });
  }

  // Neu noi_dung la mang cac Dieu
  if (Array.isArray(data.noi_dung)) {
    data.noi_dung.forEach((dieu, i) => {
      // Tieu de Dieu
      paragraphs.push(
        new Paragraph({
          spacing: { ...BODY_SPACING, before: 240 },
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 },
          children: [
            new TextRun({
              text: `Điều ${i + 1}. ${dieu.tieu_de || ""}`,
              font: FONT, size: 28, bold: true,
            }),
          ],
        })
      );
      // Noi dung Dieu
      if (dieu.noi_dung) {
        const lines = dieu.noi_dung.split("\n").filter(l => l.trim());
        lines.forEach(line => {
          paragraphs.push(
            new Paragraph({
              spacing: BODY_SPACING,
              alignment: AlignmentType.JUSTIFIED,
              indent: { firstLine: 720 },
              children: [
                new TextRun({ text: line.trim(), font: FONT, size: 28 }),
              ],
            })
          );
        });
      }
    });
  }

  return paragraphs;
}

// =============================================
// CHU KY (giong cong van)
// =============================================
function buildSignature(data) {
  const paragraphs = [];
  const quyenHanMap = { "TM": "TM.", "KT": "KT.", "TL": "TL.", "TUQ": "TUQ." };
  const quyenHan = quyenHanMap[data.cap_ky] || "";

  if (quyenHan) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 240, after: 0 },
        alignment: AlignmentType.CENTER,
        indent: { left: 4500 },
        children: [
          new TextRun({
            text: `${quyenHan} ${data.chuc_vu_cap_tren || data.chuc_vu_ky}`.toUpperCase(),
            font: FONT, size: 26, bold: true,
          }),
        ],
      })
    );
  }

  if (data.cap_ky === "KT" || data.cap_ky === "TL" || data.cap_ky === "TUQ") {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        alignment: AlignmentType.CENTER,
        indent: { left: 4500 },
        children: [
          new TextRun({
            text: data.chuc_vu_ky.toUpperCase(),
            font: FONT, size: 26, bold: true,
          }),
        ],
      })
    );
  } else if (!quyenHan) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 240, after: 0 },
        alignment: AlignmentType.CENTER,
        indent: { left: 4500 },
        children: [
          new TextRun({
            text: data.chuc_vu_ky.toUpperCase(),
            font: FONT, size: 26, bold: true,
          }),
        ],
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.CENTER,
      indent: { left: 4500 },
      children: [
        new TextRun({ text: "(Ký, ghi rõ họ tên)", font: FONT, size: 28, italics: true }),
      ],
    })
  );

  for (let i = 0; i < 3; i++) {
    paragraphs.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "", font: FONT, size: 28 })] }));
  }

  paragraphs.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.CENTER,
      indent: { left: 4500 },
      children: [
        new TextRun({ text: data.nguoi_ky, font: FONT, size: 28, bold: true }),
      ],
    })
  );

  return paragraphs;
}

// =============================================
// NOI NHAN
// =============================================
function buildNoiNhan(data) {
  const paragraphs = [];

  paragraphs.push(
    new Paragraph({
      spacing: { before: 240, after: 0 },
      children: [
        new TextRun({ text: "Nơi nhận:", font: FONT, size: 24, bold: true, italics: true }),
      ],
    })
  );

  (data.noi_nhan || ["- Như Điều 3;", "- Lưu: VT."]).forEach(item => {
    const text = item.startsWith("-") ? item : `- ${item}`;
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, font: FONT, size: 22 })],
      })
    );
  });

  return paragraphs;
}

// =============================================
// MAIN
// =============================================
async function main() {
  const { input, output } = parseArgs();
  const raw = fs.readFileSync(input, "utf-8");
  const data = JSON.parse(raw);

  const required = ["co_quan_chu_quan", "co_quan_ban_hanh", "trich_yeu", "noi_dung", "chuc_vu_ky", "nguoi_ky"];
  for (const key of required) {
    if (!data[key]) {
      console.error(`Thieu truong bat buoc: ${key}`);
      process.exit(1);
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
          margin: PAGE_MARGIN,
        },
      },
      children: [
        buildHeaderTable(data),
        ...buildTenLoai(data),
        ...buildCanCu(data),
        ...buildBody(data),
        ...buildSignature(data),
        ...buildNoiNhan(data),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(output, buffer);
  console.log(`Da tao quyet dinh: ${output}`);
  console.log(`Kich thuoc: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error("Loi:", err.message);
  process.exit(1);
});
