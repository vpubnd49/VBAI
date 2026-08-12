# Quy Tac The Thuc Van Ban (Chuan ND30 / QD4114)

Tai lieu nay chua thong so ky thuat pixel-perfect de lap trinh sinh file `.docx`.

## 1. Page Layout

| Thong so | Gia tri |
|:---|:---|
| Kho giay | A4 (210 x 297 mm) |
| Le trai | 30 mm (~1701 dxa) |
| Le phai | 20 mm (~1134 dxa) |
| Le tren | 20 mm (~1134 dxa) |
| Le duoi | 20 mm (~1134 dxa) |
| Font mac dinh | Times New Roman, Unicode |
| Dan dong (line spacing) | single den 1.5 lines |
| Gian doan (before/after) | Toi thieu 6pt |

## 2. Header (BAT BUOC dung Table 2 cot, 2 dong an vien)

### Cau truc Header Table (2 cot x 2 dong)

```
+---------------------------+------------------------------------------+
| DONG 1 - COT TRAI (3500) | DONG 1 - COT PHAI (5571)                 |
| - Ten co quan chu quan     | - QUOC HIEU (in hoa, dam, co 13)         |
| - TEN CO QUAN BAN HANH    | - Tieu ngu (dam, thuong, co 14)          |
|   + Gach ngang 1/3 can trai|   + Gach ngang = chieu dai tieu ngu      |
+---------------------------+------------------------------------------+
| DONG 2 - COT TRAI (3500) | DONG 2 - COT PHAI (5571)                 |
| - So, Ky hieu             | - Dia danh, ngay thang (nghieng, co 14)  |
| - V/v (Trich yeu, co 12)  |                                          |
+---------------------------+------------------------------------------+
```

### Bang thong so chi tiet Header

| Yeu to | Dong/Cot | Co chu | Style | Ky thuat Ke duoi |
|:---|:---:|:---:|:---|:---|
| **QUOC HIEU** | D1 - Phai (5571 dxa) | 13 | **DAM**, IN HOA | Khong |
| **Tieu ngu** | D1 - Phai (duoi QH) | 14 | **Dam**, Thuong | Border Top (size 2), indent 1100 dxa (bang chieu dai tieu ngu) |
| **CO QUAN CHU QUAN** | D1 - Trai (3500 dxa) | 13 | Thuong, IN HOA | Khong |
| **CO QUAN BAN HANH** | D1 - Trai (giua) | 13 | **DAM**, IN HOA | Border Top (size 2), indent left/right 1350 dxa (1/3 can trai) |
| **So, Ky hieu** | D2 - Trai | 13 | Thuong + Ky hieu HOA | Khong |
| **Dia danh, ngay thang** | D2 - Phai | 14 | *Nghieng*, Thuong | Khong |
| **V/v (Trich yeu)** | D2 - Trai (dong rieng) | 12 | Thuong | Khong |

## 3. Body & Chu Ky

### Spacing chuan Body
- **Spacing before**: 6pt (120 twips)
- **Spacing after**: 6pt (120 twips)
- **Line spacing**: Exact 17pt (340 twips)
- **Line rule**: `LineRuleType.EXACT`

### Dinh dang
- **Doan van**: Lui dau dong 1 cm - 1.27 cm. Co chu `14` (hoac `13`). Canh deu 2 ben (Justified).
- **Kinh gui**: Co `14`, dung.
- **Quyen han ky (TM. KT. TL.)**: IN HOA, **Dam**, co `13`.
- **Chuc vu (BO TRUONG)**: IN HOA, **Dam**, co `13` hoac `14`.
- **Ten nguoi ky**: Thuong, **Dam**, co `14`. Can giua duoi Chuc vu.
- **Noi nhan**: "Noi nhan:" *nghieng*, **dam**, co `12`. Cac dau muc co `11`, dung. Bat dau bang dau `-`. Ket thuc: `Luu: VT,...`.

## 4. Code Snippet Header Table (Node.js docx-js) — 2 cot x 2 dong

```javascript
const headerTable = new Table({
  columnWidths: [3500, 5571], // TY LE VANG chong rot chu "NAM"
  borders: noBorders,         // An toan bo vien
  rows: [
    // DONG 1: Co quan (trai) + Quoc hieu, Tieu ngu (phai)
    new TableRow({
      children: [
        new TableCell({ /* COT TRAI D1: Co quan chu quan + Co quan ban hanh (DAM) + Line 1/3 */ }),
        new TableCell({ /* COT PHAI D1: Quoc hieu (DAM, HOA, 13) + Tieu ngu (Dam, 14) + Line */ })
      ]
    }),
    // DONG 2: So ky hieu (trai) + Dia danh ngay thang (phai)
    new TableRow({
      children: [
        new TableCell({ /* COT TRAI D2: So, Ky hieu + V/v Trich yeu */ }),
        new TableCell({ /* COT PHAI D2: Dia danh, ngay thang (nghieng, 14) */ })
      ]
    })
  ]
});
```

## 5. Code Ke Vien (Border Top) - KHONG dung UnderlineType

```javascript
// Gach duoi Ten co quan ban hanh (1/3 chieu rong cot trai = ~800 dxa)
// Cot trai 3500 dxa, indent 1350/1350 → line con lai ~800 dxa
new Paragraph({
  spacing: { before: 20, after: 0 },
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 } },
  indent: { left: 1350, right: 1350 }
});

// Gach duoi Tieu ngu (bang chieu dai chu "Doc lap - Tu do - Hanh phuc")
// Cot phai 5571 dxa, indent 1100/1100 → line con lai ~3371 dxa
new Paragraph({
  spacing: { before: 20, after: 0 },
  border: { top: { style: BorderStyle.SINGLE, size: 2, color: "000000", space: 1 } },
  indent: { left: 1100, right: 1100 }
});
```

## 6. Code Body Spacing chuan

```javascript
const bodySpacing = {
  before: 120,  // 6pt
  after: 120,   // 6pt
  line: 340,    // 17pt exact
  lineRule: LineRuleType.EXACT,
};
```

> **TUYET DOI KHONG** dung `UnderlineType`, `ImageRun`, hay `<v:line>` de tao duong gach ngang.
