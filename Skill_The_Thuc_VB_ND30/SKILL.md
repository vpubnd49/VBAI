---
name: Văn bản Hành chính (NĐ30)
description: "Tạo văn bản hành chính chuẩn Nghị định số 30/2020/NĐ-CP. Hỗ trợ tất cả loại VBHC: công văn, quyết định, nghị quyết, thông báo, báo cáo, tờ trình, kế hoạch, chương trình, hướng dẫn, quy chế, quy định, biên bản, giấy mời, hợp đồng, công điện... Triggers: 'công văn', 'quyết định', 'văn bản hành chính', 'NĐ30', 'tạo văn bản', 'soạn văn bản', 'trình ký'. Script sinh file .docx đúng chuẩn thể thức NĐ30 với thư viện docx-js (Node.js)."
---

# Tạo Văn Bản Hành Chính (NĐ30)

Skill sinh file `.docx` VB hành chính chuẩn **Nghị định 30/2020/NĐ-CP**.

## Hỗ trợ tất cả loại VBHC

### Nhóm 1: VB có tên loại (14 loại) → `engine/generate_vb_co_ten_loai_nd30.js`
NQ, QĐ, CT, QC, QĐi, TB, HD, CTr, KH, PA, ĐA, BC, TTr, TC, GM, GGT, GNP, HĐ, CĐ...

### Nhóm 2: Công văn → `engine/generate_cong_van_nd30.js`
VB không có tên loại, V/v dưới số KH, Kính gửi giữa trang.

### Nhóm 3: Biên bản → `engine/generate_bien_ban_nd30.js`
2 chữ ký: Thư ký (trái) + Chủ trì (phải).

## Workflow

### Bước 1: Thu thập thông tin
- **Loại VB**: Xác định loại (công văn, quyết định, thông báo...)
- **CQ ban hành**: Tên cơ quan
- **Nội dung**: Tóm tắt
- **Ai ký**: Tra `references/phan_quyen_ky.md`

### Bước 2: Tạo file JSON đầu vào

```json
{
  "loai_van_ban": "thong_bao",
  "co_quan_chu_quan": "BỘ TÀI CHÍNH",
  "co_quan_ban_hanh": "VỤ TỔ CHỨC CÁN BỘ",
  "so_ky_hieu": "Số      /TB-TCCB",
  "dia_danh": "Hà Nội",
  "ngay": "17", "thang": "03", "nam": "2026",
  "trich_yeu": "kết luận của Vụ trưởng tại cuộc họp giao ban",
  "noi_dung": "Nội dung...",
  "quyen_han_ky": "TL. BỘ TRƯỞNG",
  "chuc_vu_ky": "VỤ TRƯỞNG VỤ TỔ CHỨC CÁN BỘ",
  "nguoi_ky": "Nguyễn Văn A",
  "noi_nhan": ["Các đơn vị thuộc Bộ", "Lưu: VT, TCCB"]
}
```

### Bước 3: ⚠️ Rà Soát Thể Thức (BẮT BUỘC — KHÔNG ĐƯỢC BỎ QUA)

**TRƯỚC KHI chạy script**, PHẢI đọc `references/quy_tac_the_thuc.md` và đối chiếu JSON với checklist sau:

- [ ] **Chữ ký**: Chức vụ ký có **in đậm** đúng không? (Ký trực tiếp/KT 2 dòng → đậm; TL+KT 3 dòng → dòng cuối không đậm)
- [ ] **Quyền hạn**: TM./KT./TL. có đúng format? (NĐ30 dùng dấu chấm, VD: `TL. BỘ TRƯỞNG`)
- [ ] **Kính gửi**: KHÔNG in đậm (chỉ in thường, cỡ 14)
- [ ] **Nơi nhận**: "Nơi nhận:" có đậm + nghiêng? Danh sách cỡ 11?
- [ ] **4 dòng trống** cho chữ ký (KHÔNG dùng spacing)
- [ ] **Kết thúc VB**: Dấu `./. `

> **TẠI SAO phải làm bước này?** Vì các lỗi thể thức (đậm/không đậm, cỡ chữ, khoảng cách) rất khó phát hiện bằng mắt thường sau khi đã sinh file .docx. Rà soát TRƯỚC khi chạy script giúp tiết kiệm thời gian sửa lỗi.

### Bước 4: Chạy script

```bash
# VB có tên loại (NQ, QĐ, TB, BC, HD, KH, CTr, QC...)
node engine/generate_vb_co_ten_loai_nd30.js --input <file.json> --output <output.docx>

# Công văn
node engine/generate_cong_van_nd30.js --input <file.json> --output <output.docx>

# Biên bản
node engine/generate_bien_ban_nd30.js --input <file.json> --output <output.docx>
```

### Giá trị `loai_van_ban`
```
nghi_quyet, quyet_dinh, chi_thi, quy_che, quy_dinh,
thong_bao, huong_dan, chuong_trinh, ke_hoach, phuong_an,
de_an, du_an, bao_cao, to_trinh, thong_cao,
bien_ban, giay_moi, giay_gioi_thieu, giay_nghi_phep,
giay_uy_quyen, hop_dong, cong_dien, ban_ghi_nho, cong_van
```

## Lưu ý BAT BUOC

> Trước khi sửa code: ĐỌC `references/quy_tac_the_thuc.md`

> KHÔNG in đậm "Kính gửi". Kính gửi chỉ in thường, cỡ 14.

> PHẢI dùng 4 Paragraph rỗng cho khoảng trống chữ ký.

## References

| File | Nội dung |
|:---|:---|
| `references/quy_tac_the_thuc.md` | Thông số pixel-perfect |
| `references/bang_viet_tat.md` | Chữ viết tắt CQ (QĐ 4114) |
| `references/phan_quyen_ky.md` | Ma trận TM./KT./TL. (QĐ 1528) |

## Scripts

| Script | Chức năng |
|:---|:---|
| `engine/docx_core_nd30.js` | Engine chung (13 hàm) |
| `engine/generate_vb_co_ten_loai_nd30.js` | VB có tên loại (14+ loại) |
| `engine/generate_cong_van_nd30.js` | Công văn |
| `engine/generate_bien_ban_nd30.js` | Biên bản |
| `scripts/generate_cong_van.js` | *(cũ, tương thích ngược)* |
| `scripts/generate_quyet_dinh.js` | *(cũ, tương thích ngược)* |
