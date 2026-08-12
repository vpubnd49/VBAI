---
name: tao-van-ban-hanh-chinh
description: "Skill tao va ra soat van ban hanh chinh chuan Nghi dinh 30/2020/ND-CP. Su dung khi nguoi dung yeu cau tao, kiem tra, hoac sua cong van, quyet dinh, hoac bat ky van ban hanh chinh nao. Triggers: 'cong van', 'quyet dinh', 'van ban hanh chinh', 'ND30', 'tao van ban', 'soan van ban', 'trinh ky', 'gui cong van', 'ra soat', 'kiem tra van ban', 'sua van ban', 'review', 'doi chieu the thuc'. Script sinh file .docx dung chuan the thuc Nghi dinh 30 voi thu vien docx-js (Node.js)."
---

# Tao Van Ban Hanh Chinh (Chuan ND30)

Skill nay sinh file `.docx` van ban hanh chinh chuan **Nghi dinh 30/2020/ND-CP**. Ho tro 2 chuc nang chinh:

### Chuc nang 1: Tao moi van ban
Ho tro 2 loai van ban:

1. **Cong van** (van ban khong co ten loai)
2. **Quyet dinh** (van ban co ten loai)

### Chuc nang 2: Ra soat & sua van ban san co
Kiem tra van ban hanh chinh dua tren checklist the thuc ND30, chi ra loi va de xuat sua.

## Workflow 1: Tao Moi Van Ban

### Buoc 1: Thu thap thong tin dau vao

Hoi nguoi dung cac thong tin:
- **Loai van ban**: Cong van hay Quyet dinh?
- **Co quan ban hanh**: Ten co quan cap tren va co quan ban hanh
- **Gui cho ai** (Kinh gui): Ten co quan nhan
- **Noi dung chinh**: Tom tat noi dung van ban
- **Ai ky**: Nguoi dung dau / Cap pho / Cap Vu? -> Tra bang phan quyen ky

### Buoc 2: Tra cuu phan quyen ky

Doc file `references/phan_quyen_ky.md` de xac dinh:
- Cap ky (TM / KT / TL)
- Cach trinh bay khoi chu ky (chuc vu, quyen han)
- Ten nguoi ky

### Buoc 3: Tao file JSON dau vao

Tao file JSON voi cac truong bat buoc:

```json
{
  "loai_van_ban": "cong_van | quyet_dinh",
  "co_quan_chu_quan": "TEN CO QUAN CAP TREN",
  "co_quan_ban_hanh": "TEN CO QUAN BAN HANH",
  "don_vi_soan_thao": "Viet tat don vi soan thao",
  "trich_yeu": "V/v ...",
  "kinh_gui": ["Ten co quan"],
  "noi_dung": "Noi dung...",
  "cap_ky": "TM | KT | TL",
  "chuc_vu_ky": "CHUC VU NGUOI KY",
  "nguoi_ky": "Nguyen Van A",
  "noi_nhan": ["Nhu tren", "Luu: VT, ..."]
}
```

### Buoc 4: Chay script sinh file DOCX

```bash
# Cong van
node scripts/generate_cong_van.js --input <path/to/input.json> --output <path/to/output.docx>

# Quyet dinh
node scripts/generate_quyet_dinh.js --input <path/to/input.json> --output <path/to/output.docx>
```

### Buoc 5: Kiem tra thu cong

Mo file `.docx` bang Microsoft Word de kiem tra:
- Header 2 cot co dung khong?
- Quoc hieu co bi rot chu "NAM" khong?
- Duong ke (underline) co dung ty le khong?
- Font, co chu, le co dung thong so khong?

## Luu y ky thuat BAT BUOC

> **CRITICAL**: Truoc khi sua bat ky script nao, PHAI doc file `references/quy_tac_the_thuc.md` de nam vung:
> - Table an vien 2 cot (3500:5571 dxa)
> - Ky thuat Border Top thay cho Underline
> - Thong so font, spacing, margins

## References

| File | Noi dung |
|:---|:---|
| `references/quy_tac_the_thuc.md` | Thong so pixel-perfect Header, Body, Chu ky |
| `references/phan_quyen_ky.md` | Ma tran phan quyen ky TM/KT/TL |

---

## Workflow 2: Ra Soat & Sua Van Ban Hanh Chinh

### Khi nao dung?

- Khi nguoi dung gui file `.docx` kem yeu cau kiem tra, ra soat, sua loi the thuc
- Khi nguoi dung paste noi dung van ban va hoi "dung chua?", "chuan chua?"
- Triggers: "kiem tra", "ra soat", "sua van ban", "review", "doi chieu"

### Buoc 1: Nhan van ban dau vao

User cung cap theo 1 trong 2 cach:
- **Dinh kem file .docx** -> AI doc noi dung
- **Paste truc tiep** noi dung van ban vao chat

### Buoc 2: Xac dinh loai VB

Dua vao noi dung de xac dinh:
- Loai VB (Cong van hay Quyet dinh)
- Co quan ban hanh, co quan cap tren
- Doi chieu bang phan quyen ky trong `references/phan_quyen_ky.md`

### Buoc 3: Doi chieu Checklist The Thuc

Doc `references/quy_tac_the_thuc.md` va kiem tra tung hang muc:

| # | Hang muc | Quy tac chuan (ND30) |
|---|----------|---------------------|
| 1 | Font chu | Times New Roman |
| 2 | Co chu noi dung | 13-14pt |
| 3 | Le trang | Tren 20-25mm, duoi 20-25mm, trai 30-35mm, phai 15-20mm |
| 4 | Line spacing | 17pt Exactly |
| 5 | Header 2 cot | Table an vien 2 cot (3500:5571 dxa). Cot trai: co quan. Cot phai: CONG HOA XA HOI CHU NGHIA VIET NAM |
| 6 | Quoc hieu | In hoa, in dam, co duong ke phia duoi (Border Top) |
| 7 | So ky hieu | Dung format: So XX/[loai VB]-[co quan] |
| 8 | Trich yeu | V/v ..., in nghieng (Cong van) hoac in dam (Quyet dinh) |
| 9 | Khoi chu ky | TM / KT / TL dung quy tac phan_quyen_ky |
| 10 | Noi nhan | In nghieng, co gach ngang, format dung |

### Buoc 4: Xuat bao cao ket qua

Xuat bang ket qua cho user:

```
| # | Hang muc       | Ket qua | Ghi chu            |
|---|----------------|---------|--------------------|
| 1 | Font chu       | ✅ Dat  |                    |
| 2 | Co chu         | ❌ Loi  | Dang 12pt, can 13pt|
| 3 | Le trang       | ✅ Dat  |                    |
| ...                                                |
```

### Buoc 5: De xuat sua

Neu co loi, hoi user:
> "Van ban co X loi the thuc. Ban co muon toi tao lai file .docx chuan ND30 khong?"

Neu user dong y:
1. Trich xuat noi dung tu VB goc (trich yeu, noi dung, nguoi ky, noi nhan...)
2. Tao file JSON dau vao theo dung format
3. Chay script tuong ung (Workflow 1) de sinh file .docx moi chuan the thuc
