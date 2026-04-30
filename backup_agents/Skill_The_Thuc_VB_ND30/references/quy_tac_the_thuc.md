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
- **Kinh gui**: Co `14`, dung. **KHONG in dam** (chi in thuong, co the nghieng tuy truong hop).
- **Quyen han ky (TM. KT. TL.)**: IN HOA, **Dam**, co `13`.
- **Chuc vu (BO TRUONG)**: IN HOA, **Dam**, co `13` hoac `14`.
- **Khoang trong de ky**: **4 dong trong** (4 Paragraph rong) giua chuc vu va ten nguoi ky. KHONG dung `spacing: { before: 600 }` ma PHAI dung 4 Paragraph.
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

## 7. Code Khoang trong de ky (4 dong)

```javascript
// 4 dong trong giua chuc vu va ten nguoi ky
for (let i = 0; i < 4; i++) {
    chuKyChildren.push(
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: '', font: LAYOUT.FONT, size: 28 })],
        })
    );
}
```

> **TUYET DOI KHONG** dung `UnderlineType`, `ImageRun`, hay `<v:line>` de tao duong gach ngang.

> **TUYET DOI KHONG** in dam chu "Kinh gui". Kinh gui chi in thuong, co 14.

> **TUYET DOI KHONG** dung `spacing: { before: 600 }` de tao khoang trong chu ky. PHAI dung 4 Paragraph rong.

## 8. Danh so trang

- So trang: o tren (header), can giua, co 14, font Times New Roman.
- Trang 1 KHONG danh so (dung `titlePage: true`).
- Bat dau tu trang 2 tro di.

```javascript
// Import them Header, PageNumber
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

// Trong sections:
properties: {
    titlePage: true, // Bo trang 1
    ...
},
headers: {
    default: pageNumberHeader,
},
```

## 9. Ket thuc van ban hanh chinh

- VBHC ket thuc bang dau **`./.`** (cham gach cheo cham), KHONG phai dau `.` don.
- Engine tu dong them `./` truoc dau `.` cuoi cung cua `noi_dung`.

```
Sai:  ...dung thanh phan va thoi gian neu tren.
Dung: ...dung thanh phan va thoi gian neu tren./.
```

## 10. Noi nhan: dau ket thuc

- Cac dong noi nhan ket thuc bang dau **`;`** (cham phay).
- Dong **"Luu:"** ket thuc bang dau **`.`** (cham).

```
- Cac don vi thuoc Bo;
- Thanh tra Bo;
- Luu: VT, TCCB.
```

## 11. TL + KT ket hop (3 dong)

- Khi Bo truong uy quyen (TL) cho Vu truong, ma Pho Vu truong ky thay (KT):

```
TL. BO TRUONG               <-- quyen_han_ky (dam)
KT. VU TRUONG VU TCCB       <-- kt_chuc_vu (dam)
PHO VU TRUONG               <-- chuc_vu_ky (thuong)
(4 dong trong)
Nguyen Xuan X               <-- nguoi_ky (dam)
```
