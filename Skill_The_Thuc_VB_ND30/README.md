# 📄 Skill Sinh Văn Bản Hành Chính — Nghị Định 30/2020/NĐ-CP

## Giới Thiệu

Bộ kỹ năng (skill) giúp **Agent AI** tự động tạo file **văn bản hành chính (.docx)** đúng thể thức theo **Nghị định 30/2020/NĐ-CP** về công tác Văn thư.

### Phục vụ ai?

Cán bộ, công chức, viên chức cần soạn VBHC ở **mọi cơ quan**: Bộ, Sở, Cục, Vụ, phòng...

### Hỗ trợ bao nhiêu loại VB?

**Tất cả 24+ loại VBHC**, chia 3 nhóm:

| Nhóm | Loại VB | Template |
|---|---|---|
| **1. VB có tên loại** | NQ, QĐ, CT, QC, QĐi, TB, HD, CTr, KH, PA, ĐA, BC, TTr, TC, GM, GGT, GNP, HĐ, CĐ | `generate_vb_co_ten_loai_nd30.js` |
| **2. Công văn** | CV (không có tên loại, có V/v + Kính gửi) | `generate_cong_van_nd30.js` |
| **3. Biên bản** | BB (2 chữ ký: thư ký + chủ trì) | `generate_bien_ban_nd30.js` |

---

## Cài Đặt

```bash
cd Skill_The_Thuc_VB_ND30
npm install
```

Yêu cầu: **Node.js ≥ 14**

---

## Cách Sử Dụng

### Bước 1: Tạo file JSON đầu vào

```json
{
  "loai_van_ban": "giay_moi",
  "co_quan_chu_quan": "BỘ TÀI CHÍNH",
  "co_quan_ban_hanh": "VỤ TỔ CHỨC CÁN BỘ",
  "so_ky_hieu": "Số      /GM-TCCB",
  "dia_danh": "Hà Nội",
  "ngay": "17", "thang": "03", "nam": "2026",
  "trich_yeu": "Về việc tham dự họp bốc thăm đơn vị kiểm tra...",
  "noi_dung": "Nội dung VB...",
  "quyen_han_ky": "TL. BỘ TRƯỞNG",
  "kt_chuc_vu": "KT. VỤ TRƯỞNG VỤ TỔ CHỨC CÁN BỘ",
  "chuc_vu_ky": "PHÓ VỤ TRƯỞNG",
  "nguoi_ky": "Nguyễn Xuân X",
  "noi_nhan": ["Các đơn vị thuộc Bộ", "Lưu: VT, TCCB"]
}
```

### Bước 2: Chạy script

```bash
# VB có tên loại (NQ, QĐ, TB, BC, GM, HD, KH...)
node engine/generate_vb_co_ten_loai_nd30.js --input <file.json> --output <output.docx>

# Công văn
node engine/generate_cong_van_nd30.js --input <file.json> --output <output.docx>

# Biên bản
node engine/generate_bien_ban_nd30.js --input <file.json> --output <output.docx>
```

### Bước 3: Mở file `.docx` bằng Word để kiểm tra

---

## Cấu Trúc JSON Chi Tiết

### Các trường bắt buộc

| Trường | Mô tả | Ví dụ |
|---|---|---|
| `loai_van_ban` | Mã loại VB (xem bảng dưới) | `"thong_bao"` |
| `co_quan_ban_hanh` | IN HOA | `"BỘ TÀI CHÍNH"` |
| `so_ky_hieu` | Số và ký hiệu | `"Số      /TB-BTC"` |
| `dia_danh` | Địa danh | `"Hà Nội"` |
| `ngay`, `thang`, `nam` | Ngày ban hành | `"17"`, `"03"`, `"2026"` |
| `noi_dung` | Nội dung chính | Chuỗi text, `\n` xuống dòng |
| `nguoi_ky` | Họ tên người ký | `"Nguyễn Văn A"` |
| `noi_nhan` | Danh sách nơi nhận | `["Như trên", "Lưu: VT, TCCB"]` |

### Các trường tuỳ chọn

| Trường | Khi nào dùng | Ví dụ |
|---|---|---|
| `co_quan_chu_quan` | CQ cấp trên | `"BỘ TÀI CHÍNH"` |
| `trich_yeu` | Trích yếu nội dung | `"về công tác cán bộ"` |
| `kinh_gui` | Công văn, Tờ trình | `["Thủ tướng Chính phủ"]` |
| `can_cu` | VB có căn cứ (QĐ, NQ) | `["Luật Cán bộ, công chức"]` |
| `quyen_han_ky` | TM./KT./TL. | `"TL. BỘ TRƯỞNG"` |
| `kt_chuc_vu` | **TL+KT kết hợp** | `"KT. VỤ TRƯỞNG VỤ TCCB"` |
| `chuc_vu_ky` | Chức vụ người ký | `"PHÓ VỤ TRƯỞNG"` |
| `cac_dieu` | VB có Điều | `["Nội dung Điều 1", "..."]` |
| `dong_quyet_dinh` | Dòng "QUYẾT ĐỊNH:" | `"QUYẾT ĐỊNH:"` |
| `theo_de_nghi` | Theo đề nghị của... | `"Theo đề nghị của Vụ trưởng..."` |

### Giá trị `loai_van_ban`

```
nghi_quyet, quyet_dinh, chi_thi, quy_che, quy_dinh,
thong_bao, huong_dan, chuong_trinh, ke_hoach, phuong_an,
de_an, du_an, bao_cao, to_trinh, thong_cao,
bien_ban, giay_moi, giay_gioi_thieu, giay_nghi_phep,
giay_uy_quyen, hop_dong, cong_dien, ban_ghi_nho, cong_van
```

---

## Tính Năng Tự Động

Engine tự động xử lý:

| Tính năng | Chi tiết |
|---|---|
| **Nhận diện cấu trúc** | Chương/Mục/Điều/khoản/điểm/I- II- tự phát hiện |
| **Kết thúc VB** | Tự thêm `./. ` cuối dòng cuối nội dung |
| **Nơi nhận** | Tự thêm `;` sau mỗi mục, `.` sau dòng "Lưu" |
| **Đánh số trang** | Trên, căn giữa, bỏ trang 1 |
| **TL+KT kết hợp** | Hỗ trợ 3 dòng: TL → KT → chức vụ thực |
| **4 dòng trống ký** | Tự động tạo khoảng trống cho chữ ký tay |

---

## Bài Học Quan Trọng ⚠️

### 1. Kết thúc VB hành chính = `./.`

```
Sai: ...đúng thành phần và thời gian nêu trên.
Đúng: ...đúng thành phần và thời gian nêu trên./.
```

### 2. Nơi nhận: dấu `;` chứ không phải `,`

```
- Các đơn vị thuộc Bộ;     ← dấu chấm phẩy
- Thanh tra Bộ;              ← dấu chấm phẩy
- Lưu: VT, TCCB.            ← dấu chấm (dòng Lưu)
```

### 3. TL + KT kết hợp: 3 dòng

Khi Bộ trưởng uỷ quyền (TL) cho Vụ trưởng, mà Phó Vụ trưởng ký thay (KT):

```
TL. BỘ TRƯỞNG                        ← quyền hạn (đậm)
KT. VỤ TRƯỞNG VỤ TỔ CHỨC CÁN BỘ    ← ký thay ai (đậm)
PHÓ VỤ TRƯỞNG                        ← chức vụ thực (thường)

Nguyễn Xuân X                         ← họ tên (đậm)
```

### 4. Sử dụng JSON field `kt_chuc_vu`

```json
{
  "quyen_han_ky": "TL. BỘ TRƯỞNG",
  "kt_chuc_vu": "KT. VỤ TRƯỞNG VỤ TỔ CHỨC CÁN BỘ",
  "chuc_vu_ky": "PHÓ VỤ TRƯỞNG",
  "nguoi_ky": "Nguyễn Xuân X"
}
```

### 5. Căn cứ: in nghiêng (khác VB Đảng!)

```
VBHC (NĐ30): Căn cứ Luật Cán bộ, công chức...  ← nghiêng
VB Đảng (HD36): - Căn cứ Điều lệ Đảng...        ← đứng, gạch đầu dòng
```

### 6. "Nơi nhận:" = đậm + nghiêng (khác VB Đảng!)

```
VBHC (NĐ30):  𝘕𝘰̛𝘪 𝘯𝘩𝘢̣̂𝘯:  ← đậm + nghiêng
VB Đảng (HD36): Nơi nhận:  ← gạch chân
```

### 7. Quyền hạn ký: dấu chấm (khác VB Đảng!)

```
VBHC (NĐ30): TM.  KT.  TL.   ← dấu chấm
VB Đảng (HD36): T/M  K/T  T/L  ← gạch chéo
```

---

## Cấu Trúc Thư Mục

```
Skill_The_Thuc_VB_ND30/
├── SKILL.md                               ← Agent đọc đầu tiên
├── README.md                              ← Bạn đang đọc
├── package.json
│
├── engine/                                ← Code mới (Engine + Templates)
│   ├── docx_core_nd30.js                  ← Engine chung (13+ hàm)
│   ├── generate_vb_co_ten_loai_nd30.js    ← 14+ loại VB có tên loại
│   ├── generate_cong_van_nd30.js          ← Công văn
│   └── generate_bien_ban_nd30.js          ← Biên bản
│
├── scripts/                               ← Code cũ (tương thích ngược)
│   ├── generate_cong_van.js
│   └── generate_quyet_dinh.js
│
├── references/                            ← Tài liệu tham chiếu
│   ├── quy_tac_the_thuc.md                ← Thông số pixel-perfect
│   ├── phan_quyen_ky.md                   ← TM./KT./TL. đầy đủ
│   └── bang_viet_tat.md                   ← Ký hiệu CQ (QĐ 4114)
│
└── assets/examples/                       ← JSON mẫu
    ├── input_cong_van.json                ← Công văn
    ├── input_quyet_dinh.json              ← Quyết định
    ├── cong_van_nd30.json                 ← CV (engine mới)
    ├── thong_bao.json                     ← Thông báo
    └── giay_moi_boc_tham.json             ← Giấy mời (TL+KT)
```

---

## So Sánh Với VB Đảng (HD36)

| Yếu tố | VBHC (NĐ30) | VB Đảng (HD36) |
|---|---|---|
| Tiêu đề | Quốc hiệu + Tiêu ngữ (13pt) | ĐẢNG CỘNG SẢN VN (15pt) |
| Lề phải | **20 mm** | 15 mm |
| Dưới CQ | Gạch ngang 1/3 | Dấu sao (*) |
| Căn cứ | **Nghiêng** | Đứng, "- " |
| "Nơi nhận" | **Đậm + nghiêng** | Gạch chân |
| Quyền hạn ký | TM. KT. TL. (dấu chấm) | T/M K/T T/L (gạch chéo) |
| Số ký hiệu | `Số:   /QĐ-BTC` | `Số 15-NQ/TU` |
| Line spacing | ~17pt | ≥18pt |
| Kết thúc VB | **`./.`** | `.` |

---

## Nguồn Tham Chiếu

- **Nghị định 30/2020/NĐ-CP** ngày 05/3/2020 về công tác Văn thư
- **Quyết định 4114/QĐ-BTC** — Quy chế văn thư Bộ Tài chính
- **Quyết định 1528/QĐ-BTC** — Phân quyền ký văn bản
