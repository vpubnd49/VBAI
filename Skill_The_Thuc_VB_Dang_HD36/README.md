# 📄 Skill Sinh Văn Bản Đảng — HD 36-HD/VPTW

## Giới Thiệu

Bộ kỹ năng (skill) giúp Agent AI tự động tạo file **văn bản Đảng (.docx)** đúng thể thức theo **Hướng dẫn số 36-HD/VPTW** ngày 03/4/2018 của Văn phòng Trung ương Đảng.

### Phục vụ ai?

Cán bộ, đảng viên cần soạn văn bản Đảng ở **mọi cấp**: từ Trung ương, tỉnh uỷ, huyện uỷ, đảng uỷ cơ sở đến chi bộ.

### Hỗ trợ những loại VB nào?

**Tất cả 14 loại văn bản Đảng:**

| Loại VB | Ký hiệu | Script |
|---|:---:|---|
| Nghị quyết | NQ | `generate_vb_co_ten_loai.js` |
| Chỉ thị | CT | `generate_vb_co_ten_loai.js` |
| Kết luận | KL | `generate_vb_co_ten_loai.js` |
| Quyết định | QĐ | `generate_vb_co_ten_loai.js` |
| Quy định | QĐi | `generate_vb_co_ten_loai.js` |
| Quy chế | QC | `generate_vb_co_ten_loai.js` |
| Báo cáo | BC | `generate_vb_co_ten_loai.js` |
| Tờ trình | TTr | `generate_vb_co_ten_loai.js` |
| Thông báo | TB | `generate_vb_co_ten_loai.js` |
| Hướng dẫn | HD | `generate_vb_co_ten_loai.js` |
| Chương trình | CTr | `generate_vb_co_ten_loai.js` |
| Thông tri | TT | `generate_vb_co_ten_loai.js` |
| **Công văn** | CV | `generate_cong_van_dang.js` |
| **Biên bản** | BB | `generate_bien_ban.js` |

---

## Cài Đặt

### Yêu cầu

- **Node.js** ≥ 14
- AI Agent (Gemini, Claude, ChatGPT...) có khả năng đọc file và chạy lệnh

### Cài đặt

```bash
cd Skill_The_Thuc_VB_Dang_HD36
npm install
```

---

## Cách Sử Dụng

### Bước 1: Tạo file JSON đầu vào

Xem các ví dụ trong `assets/examples/`:

| Ví dụ | Loại VB | Cấp |
|---|---|---|
| `nghi_quyet.json` | Nghị quyết | Tỉnh uỷ |
| `cong_van.json` | Công văn | BCSĐ Bộ Tài chính |
| `cv_dubtc.json` | Công văn | Đảng uỷ Bộ Tài chính |
| `bc_daihoi_cb3.json` | Báo cáo | Chi bộ |
| `qc_cb1.json` | Quy chế | Chi bộ |

### Bước 2: Chạy script

```bash
# VB có tên loại (NQ, QĐ, BC, CT, KL, TB, HD, QC, QĐi, CTr, TT, TTr)
node engine/generate_vb_co_ten_loai.js --input <file.json> --output <output.docx>

# Công văn
node engine/generate_cong_van_dang.js --input <file.json> --output <output.docx>

# Biên bản
node engine/generate_bien_ban.js --input <file.json> --output <output.docx>
```

### Bước 3: Mở file .docx bằng Word để kiểm tra

---

## Cấu Trúc JSON Đầu Vào

### Các trường bắt buộc

```json
{
  "loai_van_ban": "nghi_quyet",               // Tên loại (xem bảng dưới)
  "co_quan_ban_hanh": "TỈNH UỶ ĐỒNG THÁP",   // IN HOA
  "so_ky_hieu": "Số 15-NQ/TU",
  "dia_danh": "Đồng Tháp",
  "ngay": "15", "thang": "03", "nam": "2026",
  "trich_yeu": "về công tác cán bộ",
  "noi_dung": "Nội dung văn bản...",
  "quyen_han_ky": "T/M TỈNH UỶ",
  "chuc_vu_ky": "BÍ THƯ",
  "nguoi_ky": "Nguyễn Văn A",
  "noi_nhan": ["Các huyện uỷ trực thuộc", "Lưu VPTU"]
}
```

### Các trường tuỳ chọn

| Trường | Khi nào dùng |
|---|---|
| `co_quan_cap_tren` | CQ có 2 cấp (huyện uỷ, ban tham mưu, chi bộ...) |
| `can_cu` | VB có phần căn cứ (QĐ, NQ, QC...) |
| `kinh_gui` | Công văn, Tờ trình |
| `cac_dieu` | VB có cấu trúc Điều (thay thế `noi_dung`) |
| `dong_quyet_dinh` | "QUYẾT ĐỊNH:" hoặc bỏ trống |

### Giá trị `loai_van_ban`

```
nghi_quyet, chi_thi, ket_luan, quyet_dinh, quy_dinh,
quy_che, bao_cao, to_trinh, thong_bao, huong_dan,
chuong_trinh, thong_tri, bien_ban, cong_van
```

---

## Điểm Khác Biệt Với VB Hành Chính (NĐ30)

| Yếu tố | VB Đảng (HD36) | VB Hành chính (NĐ30) |
|---|---|---|
| Tiêu đề | **ĐẢNG CỘNG SẢN VIỆT NAM** (cỡ 15) | Quốc hiệu + Tiêu ngữ |
| Lề phải | **15 mm** | 20 mm |
| Dưới CQ ban hành | **Dấu sao (*)** | Gạch ngang 1/3 |
| Quyền hạn ký | **T/M, K/T, T/L** (gạch chéo) | TM., KT., TL. (dấu chấm) |
| Nơi nhận | **Gạch chân** | Đậm + nghiêng |
| Căn cứ | Chữ đứng, gạch đầu dòng | Nghiêng |
| Line spacing | **≥ 18pt** | ~17pt |
| Số ký hiệu | `Số 15-NQ/TU` (gạch nối + gạch chéo) | `Số:   /BTC-TCCB` |

---

## Cấu Trúc Thư Mục

```
Skill_The_Thuc_VB_Dang_HD36/
├── SKILL.md                           ← Agent đọc file này đầu tiên
├── README.md                          ← Bạn đang đọc file này
├── package.json
│
├── engine/                            ← Code sinh văn bản
│   ├── docx_core.js                   ← Engine chung (12 hàm)
│   ├── generate_vb_co_ten_loai.js     ← 11 loại VB có tên loại
│   ├── generate_cong_van_dang.js      ← Công văn
│   └── generate_bien_ban.js           ← Biên bản (2 chữ ký)
│
├── references/                        ← Tài liệu tham chiếu
│   ├── quy_tac_the_thuc_dang.md       ← Thông số pixel-perfect
│   ├── phan_quyen_ky_dang.md          ← T/M, K/T, T/L đầy đủ
│   └── bang_viet_tat_dang.md          ← Ký hiệu CQ + loại VB
│
└── assets/examples/                   ← JSON mẫu
    ├── nghi_quyet.json
    ├── cong_van.json
    ├── cv_dubtc.json
    ├── bc_daihoi_cb3.json
    └── qc_cb1.json
```

---

## Tính Năng Tự Động

Engine tự nhận diện và format đúng theo HD36:

- **Chương I, Phần I** → Đậm, căn giữa
- **QUY ĐỊNH CHUNG** (tên chương, IN HOA) → Đậm, căn giữa
- **Mục 1** → Đậm, căn giữa
- **Điều 1. Phạm vi điều chỉnh** → Toàn bộ đậm
- **I- TÌNH HÌNH...** → Đậm (tiêu đề La Mã)
- **a), b)** → Thường
- **1. 2. 3.** (khoản) → Thường

---

## Lưu Ý Quan Trọng

1. **Luôn đọc `references/quy_tac_the_thuc_dang.md`** trước khi sửa code
2. Chữ ký: **4 dòng trống** (KHÔNG dùng `spacing: { before: 600 }`)
3. Căn cứ: gạch đầu dòng "- ", chữ đứng, **KHÔNG nghiêng**
4. Số ký hiệu: dấu gạch nối `-` và gạch chéo `/` (KHÔNG dấu hai chấm)
5. Quyền hạn ký: gạch chéo T/M, K/T, T/L (KHÔNG dấu chấm)
6. "Nơi nhận:" có **gạch chân** (KHÔNG đậm nghiêng)

---

## Nguồn Tham Chiếu

- **Hướng dẫn số 36-HD/VPTW** ngày 03/4/2018 của Văn phòng Trung ương Đảng
- **Phụ lục 3** — Bảng phông chữ, cỡ chữ, kiểu chữ các thành phần thể thức
