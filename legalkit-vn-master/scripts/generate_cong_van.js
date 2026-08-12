#!/usr/bin/env node
/**
 * generate_cong_van.js
 * Sinh file .docx Cong van chuan Nghi dinh 30/2020/ND-CP
 *
 * Usage:
 *   node scripts/generate_cong_van.js --input <path/to/input.json> --output <path/to/output.docx>
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
// CONSTANTS - Thong so chuan ND30 / QD4114
// =============================================
const FONT = "Times New Roman";
const PAGE_MARGIN = {
  top: convertMillimetersToTwip(20),
  bottom: convertMillimetersToTwip(20),
  left: convertMillimetersToTwip(30),
  right: convertMillimetersToTwip(20),
};
const COL_LEFT = 3500;  // dxa
const COL_RIGHT = 5571; // dxa
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const BODY_SPACING = {
  before: 120,  // 6pt
  after: 120,   // 6pt
  line: 340,    // 17pt exact
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
    console.error("Usage: node generate_cong_van.js --input <file.json> --output <file.docx>");
    process.exit(1);
  }
  return { input, output };
}

function today() {
  const d = new Date();
  const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
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
// HEADER TABLE - 2 cot x 2 dong, an vien
// =============================================
function buildHeaderTable(data) {
  const diaDanh = data.dia_danh || "Hà Nội";

  return new Table({
    columnWidths: [COL_LEFT, COL_RIGHT],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      // DONG 1: Co quan (trai) + Quoc hieu (phai)
      new TableRow({
        children: [
          // COT TRAI - Dong 1: Co quan chu quan + Co quan ban hanh
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_LEFT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              // Co quan chu quan
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: data.co_quan_chu_quan.toUpperCase(),
                    font: FONT, size: 26, // 13pt
                  }),
                ],
              }),
              // Co quan ban hanh (DAM)
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: data.co_quan_ban_hanh.toUpperCase(),
                    font: FONT, size: 26, bold: true, // 13pt dam
                  }),
                ],
              }),
              // Duong ke 1/3 chieu rong cot trai
              borderTopLine(1350, 1350),
            ],
          }),
          // COT PHAI - Dong 1: Quoc hieu + Tieu ngu
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_RIGHT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              // Quoc hieu
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                    font: FONT, size: 26, bold: true, // 13pt dam, HOA
                  }),
                ],
              }),
              // Tieu ngu
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: "Độc lập - Tự do - Hạnh phúc",
                    font: FONT, size: 28, bold: true, // 14pt dam
                  }),
                ],
              }),
              // Duong ke bang chieu dai tieu ngu
              borderTopLine(1100, 1100),
            ],
          }),
        ],
      }),

      // DONG 2: So ky hieu (trai) + Dia danh ngay thang (phai)
      new TableRow({
        children: [
          // COT TRAI - Dong 2: So, Ky hieu + Trich yeu
          new TableCell({
            borders: NO_BORDERS,
            width: { size: COL_LEFT, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              // So, Ky hieu
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 0 },
                children: [
                  new TextRun({
                    text: `Số: ....../${data.don_vi_soan_thao || "..."}`,
                    font: FONT, size: 26, // 13pt
                  }),
                ],
              }),
              // V/v Trich yeu
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 0 },
                children: [
                  new TextRun({
                    text: data.trich_yeu,
                    font: FONT, size: 24, // 12pt
                  }),
                ],
              }),
            ],
          }),
          // COT PHAI - Dong 2: Dia danh, ngay thang
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
                    font: FONT, size: 28, italics: true, // 14pt nghieng
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
// BODY - Kinh gui + Noi dung
// =============================================
function buildBody(data) {
  const paragraphs = [];

  // Kinh gui
  if (data.kinh_gui && data.kinh_gui.length > 0) {
    if (data.kinh_gui.length === 1) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 360, ...BODY_SPACING },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Kính gửi: ", font: FONT, size: 28, bold: true }),
            new TextRun({ text: data.kinh_gui[0], font: FONT, size: 28 }),
          ],
        })
      );
    } else {
      // Nhieu nguoi nhan
      paragraphs.push(
        new Paragraph({
          spacing: { before: 360, after: 0 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Kính gửi:", font: FONT, size: 28, bold: true }),
          ],
        })
      );
      data.kinh_gui.forEach((kg, i) => {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 0, after: 0 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `- ${kg}${i < data.kinh_gui.length - 1 ? ";" : "."}`,
                font: FONT, size: 28,
              }),
            ],
          })
        );
      });
    }
  }

  // Noi dung chinh - tach theo dong
  const lines = data.noi_dung.split("\n").filter(l => l.trim());
  lines.forEach(line => {
    paragraphs.push(
      new Paragraph({
        spacing: BODY_SPACING,
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 }, // ~1.27cm
        children: [
          new TextRun({ text: line.trim(), font: FONT, size: 28 }), // 14pt
        ],
      })
    );
  });

  return paragraphs;
}

// =============================================
// CHU KY - Quyen han + Chuc vu + Ten
// =============================================
function buildSignature(data) {
  const paragraphs = [];

  // Quyen han ky (TM. / KT. / TL.)
  const quyenHanMap = {
    "TM": "TM.",
    "KT": "KT.",
    "TL": "TL.",
    "TUQ": "TUQ.",
  };
  const quyenHan = quyenHanMap[data.cap_ky] || "";

  // Dong 1: Quyen han + Chuc vu cap tren (neu co)
  if (quyenHan) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 240, after: 0 },
        alignment: AlignmentType.CENTER,
        indent: { left: 4500 },
        children: [
          new TextRun({
            text: `${quyenHan} ${data.chuc_vu_cap_tren || data.chuc_vu_ky}`.toUpperCase(),
            font: FONT, size: 26, bold: true, // 13pt dam HOA
          }),
        ],
      })
    );
  }

  // Dong 2: Chuc vu nguoi ky (neu KT/TL)
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
    // Bo truong ky truc tiep, khong co TM/KT/TL
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

  // Dong 3: (Ky, ghi ro ho ten)
  paragraphs.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.CENTER,
      indent: { left: 4500 },
      children: [
        new TextRun({
          text: "(Ký, ghi rõ họ tên)",
          font: FONT, size: 28, italics: true,
        }),
      ],
    })
  );

  // Khoang trong cho chu ky (3 dong)
  for (let i = 0; i < 3; i++) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: "", font: FONT, size: 28 })],
      })
    );
  }

  // Dong cuoi: Ten nguoi ky (Dam)
  paragraphs.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.CENTER,
      indent: { left: 4500 },
      children: [
        new TextRun({
          text: data.nguoi_ky,
          font: FONT, size: 28, bold: true, // 14pt dam
        }),
      ],
    })
  );

  return paragraphs;
}

// =============================================
// NOI NHAN - Goc trai, co 11-12
// =============================================
function buildNoiNhan(data) {
  const paragraphs = [];

  paragraphs.push(
    new Paragraph({
      spacing: { before: 240, after: 0 },
      children: [
        new TextRun({
          text: "Nơi nhận:",
          font: FONT, size: 24, bold: true, italics: true, // 12pt dam nghieng
        }),
      ],
    })
  );

  (data.noi_nhan || ["- Như trên;", "- Lưu: VT."]).forEach(item => {
    const text = item.startsWith("-") ? item : `- ${item}`;
    paragraphs.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text, font: FONT, size: 22 }), // 11pt
        ],
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

  // Validate
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
        // Header table
        buildHeaderTable(data),
        // Body
        ...buildBody(data),
        // Chu ky
        ...buildSignature(data),
        // Noi nhan
        ...buildNoiNhan(data),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(output, buffer);
  console.log(`Da tao cong van: ${output}`);
  console.log(`Kich thuoc: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error("Loi:", err.message);
  process.exit(1);
});
