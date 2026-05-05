/**
 * Chat Assistant Module â€” Legal & Administrative Consultant
 * Uses @google/genai SDK with Google Search Grounding for real-time legal data
 */
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType } from 'docx';
import { saveAs } from 'file-saver';

import { firebaseConfig } from '../firebase-config.js';


import { sendChatRequest } from './ai-proxy.js';

let aiClient = null;
let chatSession = null;
let currentModelName = "gemini-3.1-flash-lite-preview";
let use9router = localStorage.getItem('vbai_use_9router') === 'true';
let lastAssistantAnswer = '';

const SYSTEM_INSTRUCTION = `Báº¡n lÃ  Trá»£ LÃ½ PhÃ¡p LÃ½ VBAI â€” má»™t chuyÃªn gia tÆ° váº¥n phÃ¡p luáº­t Viá»‡t Nam hÃ ng Ä‘áº§u. 

## NGUYÃŠN Táº®C Cá»T LÃ•I:
1. **LUÃ”N TRA Cá»¨U GOOGLE SEARCH** Ä‘á»ƒ láº¥y thÃ´ng tin má»›i nháº¥t trÆ°á»›c khi tráº£ lá»i. KHÃ”NG BAO GIá»œ tráº£ lá»i tá»« kiáº¿n thá»©c cÅ© náº¿u cÃ³ thá»ƒ tra cá»©u Ä‘Æ°á»£c.
2. **Æ¯U TIÃŠN NGUá»’N CHÃNH THá»NG** theo thá»© tá»±:
   - CÃ¡c Cá»•ng thÃ´ng tin Ä‘iá»‡n tá»­ cá»§a ChÃ­nh phá»§, cÃ¡c Bá»™, NgÃ nh vÃ  UBND cÃ¡c tá»‰nh/thÃ nh phá»‘ (tÃªn miá»n **.gov.vn**)
   - dangcongsan.vn (BÃ¡o Ä‘iá»‡n tá»­ Äáº£ng Cá»™ng sáº£n Viá»‡t Nam), tulieuvankien.dangcongsan.vn
   - vanban.chinhphu.vn (Cá»•ng thÃ´ng tin ChÃ­nh phá»§)
   - vbpl.vn (CÆ¡ sá»Ÿ dá»¯ liá»‡u Quá»‘c gia vá» VÄƒn báº£n PhÃ¡p luáº­t)
   - thuvienphapluat.vn (ThÆ° viá»‡n PhÃ¡p luáº­t)
   - luatvietnam.vn (Luáº­t Viá»‡t Nam)
3. **SO SÃNH CÅ¨ - Má»šI**: Khi tráº£ lá»i, LUÃ”N nÃªu rÃµ:
   - VÄƒn báº£n hiá»‡n hÃ nh (má»›i nháº¥t) lÃ  gÃ¬, sá»‘ hiá»‡u, ngÃ y ban hÃ nh
   - VÄƒn báº£n cÅ© nÃ o Ä‘Ã£ bá»‹ thay tháº¿/sá»­a Ä‘á»•i/bá»• sung
   - Äiá»ƒm khÃ¡c biá»‡t chÃ­nh giá»¯a quy Ä‘á»‹nh cÅ© vÃ  má»›i
4. **TRÃCH DáºªN CHÃNH XÃC**: Ghi rÃµ Äiá»u, Khoáº£n, Äiá»ƒm cá»¥ thá»ƒ. Náº¿u khÃ´ng cháº¯c cháº¯n, pháº£i nÃ³i rÃµ.
5. **Cáº¢NH BÃO**: Náº¿u má»™t vÄƒn báº£n Ä‘Ã£ háº¿t hiá»‡u lá»±c hoáº·c bá»‹ sá»­a Ä‘á»•i, PHáº¢I cáº£nh bÃ¡o ngÆ°á»i dÃ¹ng ngay láº­p tá»©c.

## Äá»ŠNH Dáº NG TRáº¢ Lá»œI:
- Sá»­ dá»¥ng tiáº¿ng Viá»‡t, chuyÃªn nghiá»‡p, rÃµ rÃ ng
- Ghi nguá»“n tham kháº£o (link website) á»Ÿ cuá»‘i cÃ¢u tráº£ lá»i
- Khi liá»‡t kÃª vÄƒn báº£n, ghi theo format: [Loáº¡i VB] [Sá»‘ hiá»‡u]/[NÄƒm] â€” [TiÃªu Ä‘á»] â€” Hiá»‡u lá»±c: [CÃ²n/Háº¿t]
- Náº¿u cÃ¢u há»i phá»©c táº¡p, chia thÃ nh cÃ¡c má»¥c rÃµ rÃ ng

## LÆ¯U Ã Äáº¶C BIá»†T:
- LuÃ´n kiá»ƒm tra xem vÄƒn báº£n phÃ¡p luáº­t hoáº·c quy Ä‘á»‹nh, hÆ°á»›ng dáº«n cá»§a Äáº£ng cÃ³ bá»‹ sá»­a Ä‘á»•i, bá»• sung, thay tháº¿ khÃ´ng.
- Æ¯u tiÃªn cung cáº¥p thÃ´ng tin má»›i nháº¥t tá»« nÄƒm 2024-2026.
- Náº¿u ngÆ°á»i dÃ¹ng há»i vá» cÃ´ng tÃ¡c Äáº£ng (Äáº¡i há»™i, tá»• chá»©c, kiá»ƒm tra, vÄƒn phÃ²ng cáº¥p á»§y...), hÃ£y tra cá»©u trÃªn há»‡ thá»‘ng dangcongsan.vn hoáº·c cÃ¡c trang thÃ´ng tin Äáº£ng bá»™.
- Náº¿u chÆ°a Ä‘á»§ thÃ´ng tin, hÃ£y Ä‘á» xuáº¥t ngÆ°á»i dÃ¹ng kiá»ƒm tra trá»±c tiáº¿p táº¡i cÃ¡c trang web chÃ­nh thá»‘ng.`;

let allSkills = [];

async function loadSkills() {
  try {
    const response = await fetch('./skills-manifest.json');
    allSkills = await response.json();
  } catch (e) {
    console.warn("Lá»—i táº£i Skills cho Chat Assistant:", e);
  }
}

function normalizeVietnamese(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

function detectSkillMatch(skill, rawText, normalizedText) {
  if (!skill?.triggers || !Array.isArray(skill.triggers) || skill.triggers.length === 0) {
    return false;
  }

  return skill.triggers.some((trigger) => {
    const token = String(trigger || '').toLowerCase().trim();
    if (!token) return false;
    return rawText.includes(token) || normalizedText.includes(normalizeVietnamese(token));
  });
}

function buildSkillReferenceContext(skill) {
  if (!skill?.references || typeof skill.references !== 'object') {
    return '';
  }

  const referenceEntries = Object.entries(skill.references)
    .filter(([, content]) => typeof content === 'string' && content.trim().length > 0)
    .slice(0, 5);

  if (referenceEntries.length === 0) {
    return '';
  }

  const renderedReferences = referenceEntries.map(([fileName, content]) => {
    const compactContent = content.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const excerpt = compactContent.length > 4000
      ? `${compactContent.slice(0, 4000)}\n...[RÃºt gá»n ná»™i dung tham chiáº¿u]...`
      : compactContent;
    return `#### TÃ i liá»‡u: ${fileName}\n${excerpt}`;
  }).join('\n\n');

  return `\n### TÃ i liá»‡u tham chiáº¿u\n${renderedReferences}\n`;
}

function toSafeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

function getDefaultExportName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `tra_cuu_vbai_${stamp}`;
}

function buildDocChildren(title, content) {
  const children = [];
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: title, bold: true, size: 32, font: 'Times New Roman' })]
    })
  );

  const lines = content.replace(/\r/g, '').split('\n');
  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      return;
    }

    if (text.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: text.slice(4), font: 'Times New Roman', size: 28, bold: true })]
      }));
      return;
    }

    if (text.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: text.slice(3), font: 'Times New Roman', size: 30, bold: true })]
      }));
      return;
    }

    if (text.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: text.slice(2), font: 'Times New Roman', size: 32, bold: true })]
      }));
      return;
    }

    const bulletMatch = text.match(/^[-*â€¢]\s+(.+)/);
    if (bulletMatch) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
          indent: { firstLine: 360 },
          children: [new TextRun({ text: `- ${bulletMatch[1]}`, font: 'Times New Roman', size: 28 })]
        })
      );
      return;
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 100 },
        indent: { firstLine: 567 },
        children: [new TextRun({ text, font: 'Times New Roman', size: 28 })]
      })
    );
  });

  return children;
}

function buildDangNghiQuyetChildren(meta, content) {
  const layout = {
    page: { width: 11906, height: 16838 },
    margin: { top: 1134, bottom: 1134, left: 1701, right: 850 },
    font: 'Times New Roman',
    contentWidth: 9355
  };

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
  };

  const bodySpacing = { before: 120, after: 120, line: 360, lineRule: LineRuleType.EXACT };
  const children = [];

  const leftHeader = [];
  if (meta.coQuanCapTren) {
    leftHeader.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.coQuanCapTren, font: layout.font, size: 28 })]
    }));
  }
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.coQuanBanHanh, font: layout.font, size: 28, bold: true })]
  }));
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 80 },
    children: [new TextRun({ text: '*', font: layout.font, size: 28 })]
  }));
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.soKyHieu, font: layout.font, size: 28 })]
  }));

  const rightHeader = [];
  rightHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Äáº¢NG Cá»˜NG Sáº¢N VIá»†T NAM', font: layout.font, size: 30, bold: true })]
  }));
  rightHeader.push(new Paragraph({
    spacing: { before: 20, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
    indent: { left: 928, right: 928 }
  }));
  rightHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.diaDanhNgayThang, font: layout.font, size: 28, italics: true })]
  }));

  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [3500, 5855],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 3500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: leftHeader
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 5855, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: rightHeader
          })
        ]
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 0 },
    children: [new TextRun({ text: 'NGHá»Š QUYáº¾T', font: layout.font, size: 32, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [new TextRun({ text: meta.trichYeu, font: layout.font, size: 28, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text: '-----', font: layout.font, size: 28 })]
  }));

  content.split('\n').map((v) => v.trim()).filter(Boolean).forEach((line) => {
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: bodySpacing,
      indent: { firstLine: 567 },
      children: [new TextRun({ text: line, font: layout.font, size: 28 })]
    }));
  });

  const leftSign = [
    new Paragraph({
      children: [new TextRun({ text: 'NÆ¡i nháº­n:', font: layout.font, size: 26, bold: true })]
    }),
    new Paragraph({
      children: [new TextRun({ text: '- NhÆ° trÃªn;', font: layout.font, size: 24 })]
    }),
    new Paragraph({
      children: [new TextRun({ text: '- LÆ°u VT.', font: layout.font, size: 24 })]
    })
  ];

  const rightSign = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.chucDanh, font: layout.font, size: 28, bold: true })]
    }),
    new Paragraph({}),
    new Paragraph({}),
    new Paragraph({}),
    new Paragraph({}),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.nguoiKy, font: layout.font, size: 28, bold: true })]
    })
  ];

  children.push(new Paragraph({ spacing: { before: 240, after: 0 } }));
  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [4500, 4855],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 4500, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: leftSign
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 4855, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: rightSign
          })
        ]
      })
    ]
  }));

  return { children, layout };
}

function buildNd30Children(meta, content) {
  const layout = {
    page: { width: 11906, height: 16838 },
    margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
    font: 'Times New Roman',
    contentWidth: 9071
  };

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
  };

  const bodySpacing = { before: 120, after: 0, line: 340, lineRule: LineRuleType.AT_LEAST };
  const children = [];

  const leftHeader = [];
  if (meta.coQuanCapTren) {
    leftHeader.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.coQuanCapTren, font: layout.font, size: 26 })]
    }));
  }
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.coQuanBanHanh, font: layout.font, size: 26, bold: true })]
  }));
  leftHeader.push(new Paragraph({
    spacing: { before: 20, after: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
    indent: { left: 1500, right: 1500 }
  }));
  leftHeader.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: meta.soKyHieu, font: layout.font, size: 26 })]
  }));

  const rightHeader = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Cá»˜NG HÃ’A XÃƒ Há»˜I CHá»¦ NGHÄ¨A VIá»†T NAM', font: layout.font, size: 26, bold: true })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Äá»™c láº­p - Tá»± do - Háº¡nh phÃºc', font: layout.font, size: 28, bold: true })]
    }),
    new Paragraph({
      spacing: { before: 20, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 1 } },
      indent: { left: 1100, right: 1100 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: meta.diaDanhNgayThang, font: layout.font, size: 28, italics: true })]
    })
  ];

  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [3500, 5571],
    rows: [
      new TableRow({
        children: [
          new TableCell({ borders: noBorders, width: { size: 3500, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: leftHeader }),
          new TableCell({ borders: noBorders, width: { size: 5571, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rightHeader })
        ]
      })
    ]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 0 },
    children: [new TextRun({ text: 'NGHá»Š QUYáº¾T', font: layout.font, size: 28, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 0 },
    children: [new TextRun({ text: meta.trichYeu, font: layout.font, size: 28, bold: true })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
    children: [new TextRun({ text: '_______________', font: layout.font, size: 28 })]
  }));

  content.split('\n').map((v) => v.trim()).filter(Boolean).forEach((line) => {
    children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: bodySpacing,
      indent: { firstLine: 567 },
      children: [new TextRun({ text: line, font: layout.font, size: 28 })]
    }));
  });

  const leftSign = [
    new Paragraph({ children: [new TextRun({ text: 'NÆ¡i nháº­n:', font: layout.font, size: 24, bold: true, italics: true })] }),
    new Paragraph({ children: [new TextRun({ text: '- NhÆ° trÃªn;', font: layout.font, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: '- LÆ°u VT.', font: layout.font, size: 22 })] })
  ];

  const rightSign = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.chucDanh, font: layout.font, size: 28, bold: true })] }),
    new Paragraph({}), new Paragraph({}), new Paragraph({}), new Paragraph({}),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.nguoiKy, font: layout.font, size: 28, bold: true })] })
  ];

  children.push(new Paragraph({ spacing: { before: 240 } }));
  children.push(new Table({
    width: { size: layout.contentWidth, type: WidthType.DXA },
    borders: noBorders,
    columnWidths: [4300, 4771],
    rows: [new TableRow({
      children: [
        new TableCell({ borders: noBorders, width: { size: 4300, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: leftSign }),
        new TableCell({ borders: noBorders, width: { size: 4771, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, children: rightSign })
      ]
    })]
  }));

  return { children, layout };
}

export function initChat(apiKey, modelName = "gemini-3.1-flash-lite-preview") {
  currentModelName = "gemini-3.1-flash-lite-preview";
  use9router = localStorage.getItem('vbai_use_9router') === 'true';
  
  if (!use9router && !apiKey) return null;
  
  try {
    if (!use9router) {
      aiClient = new GoogleGenAI({ apiKey });
    } else {
      aiClient = { proxy: true }; // Dummy client for 9router mode
    }
    currentModelName = modelName;
    chatSession = null;
    loadSkills(); // Táº£i skills khi init
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("ChÆ°a cáº¥u hÃ¬nh API Key hoáº·c 9router");

  // TÃ¬m kiáº¿m skill liÃªn quan dá»±a trÃªn triggers
  let dynamicInstruction = SYSTEM_INSTRUCTION;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeVietnamese(text);
  const matchedSkills = allSkills.filter((s) => detectSkillMatch(s, lowerText, normalizedText));

  if (matchedSkills.length > 0) {
    dynamicInstruction += `\n\n## KIáº¾N THá»¨C Bá»” SUNG (Dá»±a trÃªn context ngÆ°á»i dÃ¹ng):\n`;
    matchedSkills.forEach(s => {
      dynamicInstruction += `\n### Ká»¹ nÄƒng: ${s.name}\n${s.instructions}\n`;
      dynamicInstruction += buildSkillReferenceContext(s);
    });
    console.log("ÄÃ£ náº¡p thÃªm context tá»« cÃ¡c skills:", matchedSkills.map(s => s.name));
  }

  try {
    let fullText = "";
    
    if (use9router) {
      // Giao tiáº¿p qua 9router (OpenAI format)
      const messages = [
        { role: "system", content: dynamicInstruction },
        { role: "user", content: text }
      ];
      fullText = await sendChatRequest(messages, currentModelName);
    } else {
      // Giao tiáº¿p trá»±c tiáº¿p qua Gemini SDK
      const response = await aiClient.models.generateContent({
        model: currentModelName,
        contents: text,
        config: {
          systemInstruction: dynamicInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
      fullText = response.text || "";
    }

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: text,
        model: currentModelName + (use9router ? " (via 9router)" : ""),
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp(),
        skillsApplied: matchedSkills.map(s => s.id)
      }).catch(err => console.warn("Log Err:", err));
    } catch (e) {}

    if (onChunk) onChunk(fullText);
    return fullText;
  } catch (e) {
    console.error("Send Error:", e);
    throw e;
  }
}

export async function renderChatUI(container) {
  const savedModel = 'gemini-3.1-flash-lite-preview';
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">âš–ï¸</div>
        Trá»£ LÃ½ Tra Cá»©u PhÃ¡p Luáº­t & Quy Äá»‹nh Äáº£ng AI
        <div style="flex:1"></div>
        <button id="chat-settings-btn" class="btn-icon" title="Cáº¥u hÃ¬nh" style="display: ${localStorage.getItem('vbai_admin') === 'true' ? 'block' : 'none'}; width:28px; height:28px; font-size:0.8rem">âš™ï¸</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">
            <strong>Xin chÃ o! TÃ´i lÃ  Trá»£ lÃ½ VBAI.</strong><br>
            TÃ´i há»— trá»£ tra cá»©u cÃ¡c quy Ä‘á»‹nh phÃ¡p luáº­t vÃ  cÃ¡c quy Ä‘á»‹nh, hÆ°á»›ng dáº«n cá»§a Äáº£ng má»›i nháº¥t dá»±a trÃªn dá»¯ liá»‡u thá»i gian thá»±c tá»« Google Search Grounding.
            <br><br>
            <strong>Nguá»“n dá»¯ liá»‡u chÃ­nh thá»‘ng:</strong><br>
            â€¢ dangcongsan.vn (TÆ° liá»‡u VÄƒn kiá»‡n Äáº£ng)<br>
            â€¢ vanban.chinhphu.vn (Cá»•ng thÃ´ng tin ChÃ­nh phá»§)<br>
            â€¢ thuvienphapluat.vn (ThÆ° viá»‡n PhÃ¡p luáº­t)<br>
            â€¢ CÃ¡c cá»•ng thÃ´ng tin Ä‘iá»‡n tá»­ (.gov.vn)
            <br><br>
            <em>Báº¡n hÃ£y Ä‘áº·t cÃ¢u há»i báº±ng ngÃ´n ngá»¯ tá»± nhiÃªn (VD: "Quy Ä‘á»‹nh má»›i nháº¥t vá» cÃ´ng tÃ¡c vÄƒn thÆ° cá»§a Äáº£ng")</em>
          </div>
        </div>
        
        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="Nháº­p ná»™i dung cáº§n tra cá»©u..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
        <div class="chat-export-actions">
          <button id="chat-export-template-dang-btn" class="btn chat-export-btn chat-export-btn-dang">â¬‡ Xuáº¥t máº«u HD36</button>
          <button id="chat-export-template-nd30-btn" class="btn chat-export-btn chat-export-btn-nd30">â¬‡ Xuáº¥t máº«u ND30</button>
          <button id="chat-export-docx-btn" class="btn chat-export-btn chat-export-btn-docx">â¬‡ Xuáº¥t cÃ¢u tráº£ lá»i ra DOCX</button>
        </div>
        <div id="chat-template-modal" class="modal-overlay chat-template-overlay" style="display:none">
          <div class="modal-content panel-group chat-template-modal-content">
            <div class="panel-header" id="chat-template-title">Xuáº¥t theo máº«u</div>
            <div class="panel-body chat-template-modal-body">
              <div class="form-grid">
                <div class="form-group span-2">
                  <label class="form-label" id="chat-template-label-captr">CÆ¡ quan cáº¥p trÃªn</label>
                  <input type="text" id="chat-template-captr" class="form-input" placeholder="Äá»ƒ trá»‘ng náº¿u khÃ´ng cÃ³">
                </div>
                <div class="form-group span-2">
                  <label class="form-label">CÆ¡ quan ban hÃ nh <span class="required">*</span></label>
                  <input type="text" id="chat-template-cqbh" class="form-input" placeholder="Nháº­p cÆ¡ quan ban hÃ nh">
                </div>
                <div class="form-group">
                  <label class="form-label">Sá»‘ kÃ½ hiá»‡u</label>
                  <input type="text" id="chat-template-sokh" class="form-input" placeholder="Sá»‘ 01-NQ/...">
                </div>
                <div class="form-group">
                  <label class="form-label">Äá»‹a danh</label>
                  <input type="text" id="chat-template-diadan" class="form-input" placeholder="LÃ¢m Äá»“ng">
                </div>
                <div class="form-group span-2">
                  <label class="form-label">TrÃ­ch yáº¿u</label>
                  <input type="text" id="chat-template-trichyeu" class="form-input" placeholder="vá» cÃ´ng tÃ¡c ...">
                </div>
                <div class="form-group">
                  <label class="form-label">Chá»©c danh ngÆ°á»i kÃ½</label>
                  <input type="text" id="chat-template-chucdanh" class="form-input" placeholder="BÃ THÆ¯ / CHá»¦ Tá»ŠCH">
                </div>
                <div class="form-group">
                  <label class="form-label">NgÆ°á»i kÃ½</label>
                  <input type="text" id="chat-template-nguoiky" class="form-input" placeholder="Nguyá»…n VÄƒn A">
                </div>
              </div>
              <div class="btn-row chat-template-modal-actions">
                <button id="chat-template-submit" class="btn btn-primary">Xuáº¥t file</button>
                <button id="chat-template-cancel" class="btn btn-secondary">ÄÃ³ng</button>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-disclaimer" style="margin-top: 12px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
          <strong>âš ï¸ Cáº¢NH BÃO Rá»¦I RO:</strong> VBAI lÃ  cÃ´ng cá»¥ há»— trá»£ dá»±a trÃªn AI, khÃ´ng thay tháº¿ trÃ¡ch nhiá»‡m cá»§a cÃ¡n bá»™, cÃ´ng chá»©c trong viá»‡c kiá»ƒm tra, Ä‘á»‘i chiáº¿u vá»›i vÄƒn báº£n phÃ¡p luáº­t chÃ­nh thá»©c. Káº¿t quáº£ do AI cung cáº¥p chá»‰ mang tÃ­nh cháº¥t gá»£i Ã½, ngÆ°á»i dÃ¹ng cáº§n kiá»ƒm tra hiá»‡u lá»±c vÄƒn báº£n trÆ°á»›c khi Ä‘Æ°a vÃ o dá»± tháº£o.
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <div id="key-modal" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group" style="max-width:420px; margin: 100px auto">
        <div class="panel-header">Cáº¥u hÃ¬nh Trá»£ LÃ½ AI</div>
        <div class="panel-body">
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google AI Studio API Key</label>
            <input type="password" id="api-key-input" class="form-input" value="" placeholder="DÃ¡n API Key vÃ o Ä‘Ã¢y...">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Láº¥y Key miá»…n phÃ­ táº¡i <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--daquy-400)">Google AI Studio</a></p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Model AI</label>
            <input type="text" class="form-input" value="Gemini 3.1 Flash Lite (Preview)" readonly style="background:var(--bg-secondary); cursor:default; opacity:0.8">
            <input type="hidden" id="model-select" value="gemini-3.1-flash-lite-preview">
          </div>

          <div style="padding:10px; background:rgba(230,162,0,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2)">
            <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">ðŸ” Google Search Grounding: Báº¬T</p>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Trá»£ lÃ½ sáº½ tá»± Ä‘á»™ng tÃ¬m kiáº¿m Google Ä‘á»ƒ láº¥y thÃ´ng tin phÃ¡p luáº­t má»›i nháº¥t.</p>
          </div>

          <div style="padding:12px; background:rgba(66,133,244,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(66,133,244,0.2); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">ðŸš€ Sá»­ dá»¥ng 9router Proxy</p>
              <p style="font-size:0.65rem; color:var(--text-secondary); margin:2px 0 0">Cháº¡y yÃªu cáº§u AI qua 9router local (localhost:20128)</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-9router-chk" ${localStorage.getItem('vbai_use_9router') === 'true' ? 'checked' : ''}>
              <span class="slider-round"></span>
            </label>
          </div>
          
          <div class="btn-row" style="margin-top:20px">
            <button id="save-key-btn" class="btn btn-primary">LÆ°u cáº¥u hÃ¬nh</button>
            <button id="close-modal-btn" class="btn btn-secondary">ÄÃ³ng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');
  const msgsArea = container.querySelector('#chat-messages');
  const settingsBtn = container.querySelector('#chat-settings-btn');
  const keyModal = container.querySelector('#key-modal');
  const apiKeyInput = container.querySelector('#api-key-input');
  const modelSelect = container.querySelector('#model-select');
  const templateDangBtn = container.querySelector('#chat-export-template-dang-btn');
  const templateNd30Btn = container.querySelector('#chat-export-template-nd30-btn');
  const exportBtn = container.querySelector('#chat-export-docx-btn');
  const templateModal = container.querySelector('#chat-template-modal');
  const templateTitle = container.querySelector('#chat-template-title');
  const templateCapTrLabel = container.querySelector('#chat-template-label-captr');
  const templateCapTr = container.querySelector('#chat-template-captr');
  const templateCqbh = container.querySelector('#chat-template-cqbh');
  const templateSokh = container.querySelector('#chat-template-sokh');
  const templateDiadan = container.querySelector('#chat-template-diadan');
  const templateTrichyeu = container.querySelector('#chat-template-trichyeu');
  const templateChucdanh = container.querySelector('#chat-template-chucdanh');
  const templateNguoiky = container.querySelector('#chat-template-nguoiky');
  const templateSubmit = container.querySelector('#chat-template-submit');
  const templateCancel = container.querySelector('#chat-template-cancel');

  // Khá»Ÿi táº¡o Firebase vÃ  táº£i API Key
  let apiKey = '';
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);

  try {
    const configDoc = await getDoc(doc(db, 'config', 'system'));
    if (configDoc.exists()) {
      apiKey = configDoc.data().gemini_api_key || '';
      if(apiKeyInput) apiKeyInput.value = apiKey;
    }
  } catch (e) {
    console.warn("Lá»—i táº£i API Key:", e);
  }

  // Init if key exists
  if (apiKey) initChat(apiKey, savedModel);

  const addMsg = (text, role) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.style.whiteSpace = 'pre-wrap';
    div.innerText = text;
    msgsArea.appendChild(div);
    msgsArea.scrollTop = msgsArea.scrollHeight;
    return div;
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    if (!aiClient) {
      alert("Vui lÃ²ng cáº¥u hÃ¬nh API Key trÆ°á»›c (báº¥m vÃ o icon âš™ï¸)");
      return;
    }

    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'user');
    lastAssistantAnswer = '';
    
    const aiMsgDiv = addMsg('ðŸ” Äang tra cá»©u tá»« Google Search...', 'ai');
    try {
      await sendMessage(text, (full) => {
        lastAssistantAnswer = full || '';
        aiMsgDiv.innerText = full;
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
    } catch (e) {
      aiMsgDiv.innerText = "âŒ Lá»—i: " + e.message;
      aiMsgDiv.classList.add('error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.onclick = handleSend;
  input.onkeypress = (e) => { if(e.key==='Enter') handleSend(); };
  let templateMode = 'dang';
  const openTemplateModal = (mode) => {
    const answer = (lastAssistantAnswer || '').trim();
    if (!answer) {
      alert("ChÆ°a cÃ³ ná»™i dung tráº£ lá»i Ä‘á»ƒ xuáº¥t theo máº«u.");
      return;
    }

    templateMode = mode;
    const firstLine = answer.split('\n').map((v) => v.trim()).find(Boolean) || '';
    const trichYeuDefault = firstLine.length > 90 ? `${firstLine.slice(0, 90)}...` : firstLine;

    if (mode === 'dang') {
      templateTitle.innerText = 'Xuáº¥t máº«u Nghá»‹ quyáº¿t Äáº£ng (HD36)';
      templateCapTrLabel.innerText = 'CÆ¡ quan cáº¥p trÃªn';
      templateCapTr.placeholder = 'VD: Äáº¢NG Bá»˜ Tá»ˆNH ...';
      templateCqbh.placeholder = 'VD: CHI Bá»˜ ...';
      templateSokh.value = 'Sá»‘ 01-NQ/CB';
      templateChucdanh.value = 'BÃ THÆ¯';
    } else {
      templateTitle.innerText = 'Xuáº¥t máº«u Nghá»‹ Ä‘á»‹nh 30 (ND30)';
      templateCapTrLabel.innerText = 'CÆ¡ quan chá»§ quáº£n';
      templateCapTr.placeholder = 'VD: á»¦Y BAN NHÃ‚N DÃ‚N Tá»ˆNH ...';
      templateCqbh.placeholder = 'VD: VÄ‚N PHÃ’NG';
      templateSokh.value = 'Sá»‘: 01/NQ-UBND';
      templateChucdanh.value = 'CHá»¦ Tá»ŠCH';
    }

    templateCapTr.value = '';
    templateCqbh.value = '';
    templateDiadan.value = 'LÃ¢m Äá»“ng';
    templateTrichyeu.value = trichYeuDefault || 'vá» cÃ´ng tÃ¡c triá»ƒn khai nhiá»‡m vá»¥';
    templateNguoiky.value = 'Nguyá»…n VÄƒn A';
    templateModal.style.display = 'block';
  };

  templateDangBtn.onclick = () => openTemplateModal('dang');
  templateNd30Btn.onclick = () => openTemplateModal('nd30');
  templateCancel.onclick = () => {
    templateModal.style.display = 'none';
  };
  templateModal.onclick = (e) => {
    if (e.target === templateModal) {
      templateModal.style.display = 'none';
    }
  };

  templateSubmit.onclick = async () => {
    const answer = (lastAssistantAnswer || '').trim();
    if (!answer) return;

    const coQuanBanHanh = (templateCqbh.value || '').trim();
    if (!coQuanBanHanh) {
      alert('Báº¡n cáº§n nháº­p cÆ¡ quan ban hÃ nh.');
      return;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());

    const meta = {
      coQuanCapTren: (templateCapTr.value || '').trim(),
      coQuanBanHanh,
      soKyHieu: (templateSokh.value || '').trim() || (templateMode === 'dang' ? 'Sá»‘ 01-NQ/CB' : 'Sá»‘: 01/NQ-UBND'),
      trichYeu: (templateTrichyeu.value || '').trim() || 'vá» cÃ´ng tÃ¡c triá»ƒn khai nhiá»‡m vá»¥',
      nguoiKy: (templateNguoiky.value || '').trim() || 'Nguyá»…n VÄƒn A',
      chucDanh: (templateChucdanh.value || '').trim() || (templateMode === 'dang' ? 'BÃ THÆ¯' : 'CHá»¦ Tá»ŠCH'),
      diaDanhNgayThang: `${(templateDiadan.value || 'LÃ¢m Äá»“ng').trim()}, ngÃ y ${dd} thÃ¡ng ${mm} nÄƒm ${yyyy}`
    };

    try {
      templateSubmit.disabled = true;
      const templateResult = templateMode === 'dang'
        ? buildDangNghiQuyetChildren(meta, answer)
        : buildNd30Children(meta, answer);

      const doc = new Document({
        styles: { default: { document: { run: { font: templateResult.layout.font, size: 28 } } } },
        sections: [{
          properties: { titlePage: true, page: { size: templateResult.layout.page, margin: templateResult.layout.margin } },
          children: templateResult.children
        }]
      });

      const suffix = templateMode === 'dang' ? 'hd36' : 'nd30';
      const base = (meta.soKyHieu || 'nghi_quyet').replace(/^Sá»‘:?\s*/i, '').replace(/\s+/g, '_');
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${toSafeFileName(base || `nghi_quyet_${suffix}`)}_${suffix}.docx`);
      templateModal.style.display = 'none';
    } catch (e) {
      console.error("Template export error:", e);
      alert("KhÃ´ng thá»ƒ xuáº¥t theo máº«u: " + e.message);
    } finally {
      templateSubmit.disabled = false;
    }
  };

  exportBtn.onclick = async () => {
    const answer = (lastAssistantAnswer || '').trim();
    if (!answer) {
      alert("ChÆ°a cÃ³ ná»™i dung tráº£ lá»i Ä‘á»ƒ xuáº¥t DOCX.");
      return;
    }

    try {
      exportBtn.disabled = true;
      const title = 'Káº¿t quáº£ Tra cá»©u VBAI';
      const doc = new Document({
        styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } },
        sections: [{ children: buildDocChildren(title, answer) }]
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${toSafeFileName(getDefaultExportName())}.docx`);
    } catch (e) {
      console.error("Export DOCX error:", e);
      alert("KhÃ´ng thá»ƒ xuáº¥t DOCX: " + e.message);
    } finally {
      exportBtn.disabled = false;
    }
  };
  
  settingsBtn.onclick = () => keyModal.style.display = 'block';
  container.querySelector('#close-modal-btn').onclick = () => keyModal.style.display = 'none';
  container.querySelector('#save-key-btn').onclick = async () => {
    const key = apiKeyInput.value.trim();
    const isUsing9router = container.querySelector('#use-9router-chk').checked;
    const model = 'gemini-3.1-flash-lite-preview';
    
    localStorage.setItem('vbai_use_9router', isUsing9router ? 'true' : 'false');
    localStorage.setItem('vbai_gemini_model', model);
    
    try {
      if (key) {
        await setDoc(doc(db, 'config', 'system'), { gemini_api_key: key }, { merge: true });
      }
      
      if(initChat(key, model)) {
        alert("ÄÃ£ lÆ°u cáº¥u hÃ¬nh thÃ nh cÃ´ng!");
        keyModal.style.display = 'none';
      } else {
        alert("Lá»—i khi khá»Ÿi táº¡o Model!");
      }
    } catch (e) {
      console.error("LÆ°u cáº¥u hÃ¬nh lá»—i:", e);
      alert("Lá»—i lÆ°u cáº¥u hÃ¬nh: " + e.message);
    }
  };
}

