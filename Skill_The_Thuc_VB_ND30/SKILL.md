---
name: Soạn VB Hành chính (NĐ30)
description: "Tạo văn bản hành chính chuẩn Nghị định số 30/2020/NĐ-CP và chuẩn mẫu thực tế Phòng Nội chính Văn phòng UBND tỉnh. Hỗ trợ tất cả loại VBHC: công văn chỉ đạo, quyết định, nghị quyết, thông báo, báo cáo, tờ trình, kế hoạch, chương trình, hướng dẫn, quy chế, quy định, biên bản, bảng biểu Excel phụ lục... Triggers: 'công văn', 'quyết định', 'văn bản hành chính', 'NĐ30', 'tạo văn bản', 'soạn văn bản', 'trình ký', 'phụ lục excel'."
---

# Soạn Thảo Văn Bản Hành Chính (Chuẩn NĐ 30/2020/NĐ-CP & Mẫu Thực Tế Hồ Sơ Nội Chính)

Skill chuyên sâu sinh file `.docx` và bảng biểu phụ lục `.xlsx` đúng chuẩn thể thức hành chính nhà nước theo **Nghị định số 30/2020/NĐ-CP** và chuẩn mẫu hơn **1.800 văn bản thực tế tại Phòng Nội chính Văn phòng UBND tỉnh**.

---

## 1. BẢNG QUY TẮC BẮT BUỘC (TUYỆT ĐỐI KHÔNG VI PHẠM)

| Thành phần | Quy tắc chuẩn xác | Lỗi thường gặp (CẤM) |
|:---|:---|:---|
| **Header Table** | **BẮT BUỘC Table 2 hàng x 2 cột** ẩn viền.<br>Hàng 1: Cơ quan (trái) - Quốc hiệu, Tiêu ngữ (phải).<br>Hàng 2: Số ký hiệu + Trích yếu (trái) - Địa danh, ngày tháng (phải). | CẤM gộp 1 hàng duy nhất làm lệch hàng ngang giữa Số và Ngày tháng khi tên cơ quan dài. |
| **Trích yếu Công văn** | Chữ thường, cỡ **12-13pt**, kiểu chữ **ĐỨNG** (`italics: false`, `bold: false`), căn giữa ô trái dưới Số ký hiệu. *(Căn cứ NĐ30 Phụ lục I mục II.4.b)* | **CẤM IN NGHIÊNG**, cấm in đậm trích yếu công văn. |
| **Dấu kết thúc `./.`** | Gắn **TRỰC TIẾP** vào từ cuối cùng của câu cuối cùng trong văn bản (ví dụ: `...theo quy định./.`). | **CẤM TÁCH DÒNG RIÊNG**, cấm tạo Paragraph riêng cho `./.`, cấm chèn dòng rỗng trước chữ ký. |
| **Kính gửi** | Chữ thường, cỡ **14pt**, kiểu chữ **ĐỨNG** (`bold: false`). Thụt lề trái hoặc căn đều. | CẤM in đậm chữ "Kính gửi". |
| **Căn cứ pháp lý** | Cỡ **14pt**, kiểu chữ **IN NGHIÊNG** (`italics: true`), thụt đầu dòng 1cm, căn đều 2 bên. Kết thúc mỗi căn cứ bằng dấu `;`, căn cứ cuối bằng dấu `,`. | Cấm in đứng, cấm căn giữa căn cứ. |
| **Nề mục (Điều, Khoản)** | `Điều 1. Tên điều:` In đậm chữ Điều và tên điều trước dấu `:` hoặc `.`; nội dung sau in thường. Thụt đầu dòng 1cm, căn đều 2 bên. | Cấm in đậm toàn bộ cả điều, cấm thụt lề lộn xộn. |
| **Khối Chữ ký & Nơi nhận** | Cột trái: `Nơi nhận:` (đậm + nghiêng, cỡ 12), danh sách cỡ 11 đứng. Dòng đầu tiên gửi đối tượng tại "Kính gửi:" BẮT BUỘC là `- Như trên;` (TUYỆT ĐỐI CẤM dùng `- Như kính gửi`). Mỗi dòng kết thúc bằng `;`, dòng `- Lưu: VT, NC...` kết thúc bằng dấu chấm `.`<br>Cột phải: Quyền hạn, chức vụ IN HOA ĐẬM (cỡ 13-14), **4 dòng trống**, Họ tên in đậm (cỡ 14). | Cấm dùng `spacing: { before: 600 }` thay cho 4 dòng trống chữ ký. **TUYỆT ĐỐI CẤM** dùng `- Như kính gửi`. |
| **Mẫu biểu đóng khung (Phiếu trình, Mẫu 2C, Biểu mẫu người dùng tải lên)** | **BẮT BUỘC BẢO TOÀN NGUYÊN BẢN 100% VỀ CẤU TRÚC DÒNG, KHUNG VIỀN VÀ FONT CHỮ (ZERO MUTATION ENGINE)**.<br>Khi người dùng gửi bất kỳ file mẫu nào hoặc yêu cầu điền/chỉnh sửa biểu mẫu (ví dụ: `Phiếu trình.docx`, hợp đồng, biểu mẫu có khung):<br>1. **CẤM TUYỆT ĐỐI** bóc tách text rồi tạo lại docx mới từ đầu (docx-js/pandoc/markdown) làm biến mất khung viền, lệch lề và vỡ cột.<br>2. **CẤM TUYỆT ĐỐI** gán thô `paragraph.text = ...` hoặc `cell.text = ...` trong python-docx vì sẽ xóa sạch thẻ `<w:r>`, làm mất trắng font Times New Roman, cỡ chữ, in đậm/nghiêng của nhãn tiền tố.<br>3. **BẮT BUỘC SỬ DỤNG** engine chỉnh sửa tại chỗ Run-Level (`scripts/edit_docx_template_in_place.py` hoặc `scripts/edit_phieu_trinh_template.py`) để thay thế text ở cấp độ Run bên trong thẻ `<w:t>`, giữ nguyên vẹn 100% khung viền, bảng lồng, thuộc tính đoạn `<w:pPr>`, ô vuông checkbox `☐`, dấu chấm dòng `.....` và khối chữ ký/phê duyệt. | **CẤM XÓA KHUNG**, cấm phá vỡ bảng biểu, cấm biến Phiếu trình thành văn bản trôi, cấm đổi ô vuông checkbox `☐` thành chữ `[X]`. |
| **Phụ lục Excel** | Font **Times New Roman** toàn sheet, Tiêu đề bảng IN HOA ĐẬM căn giữa (Merge), dòng căn cứ in nghiêng, tiêu đề cột in đậm wrap-text có đánh số cột `(1)`, `(2)`, thin borders toàn bộ. | Cấm dùng font Arial/Calibri, cấm thiếu dòng số cột `(1), (2)`. |

---

## 2. PHÂN LOẠI VĂN BẢN VÀ ENGINE XỬ LÝ

### Nhóm 1: Công văn hành chính (Không có tên loại) → `engine/generate_cong_van_nd30.js`
- Dùng cho: Công văn giao việc, công văn triển khai, công văn phúc đáp, công văn xin ý kiến, công văn hướng dẫn...
- Cấu trúc:
  1. Header 2 hàng (Số ký hiệu + Trích yếu "V/v..." đứng cỡ 12pt).
  2. Địa chỉ nhận "Kính gửi:" (cỡ 14pt, chữ đứng, không đậm).
  3. Đoạn 1 (viện dẫn văn bản đến): In nghiêng (ví dụ: `Ủy ban nhân dân tỉnh nhận được Công văn số... ngày... của...; Chủ tịch UBND tỉnh có ý kiến chỉ đạo như sau:`).
  4. Đoạn 2 (nội dung chỉ đạo/giao việc): In đứng, thụt đầu dòng 1cm, gắn `./.` ở từ cuối cùng.
  5. Chữ ký (TL. CHỦ TỊCH / KT. CHÁNH VĂN PHÒNG / PHÓ CHÁNH VĂN PHÒNG) + Nơi nhận.

### Nhóm 2: Văn bản có tên loại → `engine/generate_vb_co_ten_loai_nd30.js`
- Hỗ trợ 20+ loại: `quyet_dinh`, `nghi_quyet`, `to_trinh`, `bao_cao`, `ke_hoach`, `thong_bao`, `chuong_trinh`, `quy_che`, `quy_dinh`, `huong_dan`, `phuong_an`, `de_an`, `giay_moi`...
- Cấu trúc:
  1. Header 2 hàng (Số ký hiệu và Địa danh ngày tháng ngang hàng).
  2. Tên loại văn bản (IN HOA, ĐẬM, cỡ 14-15pt, căn giữa) + Trích yếu (ĐẬM, cỡ 13-14pt, căn giữa) + Gạch ngang ngăn cách.
  3. Thẩm quyền ban hành (nếu là QĐ/Quy định): `ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG` (IN HOA, ĐẬM, cỡ 14pt).
  4. Hệ thống Căn cứ (in nghiêng, lùi đầu dòng 1cm, căn đều 2 bên).
  5. Lời ban hành (`QUYẾT ĐỊNH:` / `QUYẾT NGHỊ:` / `KẾ HOẠCH:`).
  6. Các Điều/Khoản/Mục nội dung (đã tự động nhận diện nề mục chuẩn).
  7. Dấu `./.` liền ở câu cuối cùng của Điều cuối.
  8. Khối Chữ ký (TM. ỦY BAN NHÂN DÂN / CHỦ TỊCH) + Nơi nhận.

### Nhóm 3: Biên bản → `engine/generate_bien_ban_nd30.js`
- 2 chữ ký ngang hàng: THƯ KÝ (trái) và CHỦ TRÌ (phải).

### Nhóm 4: Mẫu biểu đóng khung cố định & Mọi file mẫu người dùng tải lên (Form-based / Bordered Template) → `scripts/edit_docx_template_in_place.py` & `scripts/edit_phieu_trinh_template.py`
- Dùng cho: **MỌI FILE MẪU NGƯỜI DÙNG TẢI LÊN YÊU CẦU CHỈNH SỬA**, **PHIẾU TRÌNH** (chuẩn Văn phòng UBND tỉnh), Phiếu chuyển, Giấy mời có khung chương trình, Mẫu 2C-TCTW/98, Biểu mẫu rà soát...
- **Quy tắc vàng:**
  1. Khi người dùng gửi file mẫu DOCX hoặc yêu cầu sửa mẫu: Giữ nguyên file đó làm gốc, dùng `scripts/edit_docx_template_in_place.py` để cập nhật trực tiếp tại chỗ (in-place).
  2. Khi người dùng yêu cầu tạo/điền Phiếu trình: Sử dụng file mẫu chuẩn `bosung/Phiếu trình.docx`, chạy `scripts/edit_phieu_trinh_template.py`.
  3. **Nguyên tắc bảo toàn 100% nguyên bản:**
     - Giữ nguyên 100% viền bảng (`<w:tblBorders>`, `<w:tcBorders>`), chiều rộng cột (`<w:gridCol>`), chiều cao hàng (`<w:trHeight>`).
     - Giữ nguyên 100% font chữ (Times New Roman), cỡ chữ (11, 12, 13, 14pt), in đậm prefix, khoảng cách đoạn và giãn dòng.
     - Giữ nguyên toàn bộ ô vuông checkbox `☐`/`☑`, dấu chấm chấm dòng `.....` và chữ ký 3 bên.
     - Khử trùng lặp (de-duplicate) các ô gộp (merged cells) tránh ghi đè lặp lại.
  4. **Đặc tả cấu trúc Phiếu trình chuẩn:**
     - Header: 2 hàng x 2 cột ẩn viền (UBND TỈNH LÂM ĐỒNG - VĂN PHÒNG / QUỐC HIỆU - TIÊU NGỮ / Số ký hiệu).
     - Tiêu đề: `PHIẾU TRÌNH` (in hoa đậm, căn giữa) + `Kính gửi: Lãnh đạo UBND tỉnh; Lãnh đạo Văn phòng UBND tỉnh`.
     - **Khung lớn cố định bao quanh toàn bộ nội dung (Full Outer Bordered Table)**:
       - Hàng I: `I. NỘI DUNG TRÌNH/CHỈ ĐẠO` (1. Văn bản/cơ quan trình; 2. Trích yếu).
       - Hàng II: `II. RÀ SOÁT, TỔNG HỢP CỦA PHÒNG CHUYÊN MÔN THUỘC VĂN PHÒNG` (1. Bảng checkbox 2 cột `☐`; 2. Cơ quan trình; 3. Thẩm quyền; 4. Đề xuất phương án 4.1/4.2/4.3; 5. Độ mật).
       - Hàng Chữ ký (chia 2 cột viền): Trái: `PHÒNG XỬ LÝ CHÍNH: NỘI CHÍNH` (Chuyên viên | Lãnh đạo phòng); Phải: `LÃNH ĐẠO VĂN PHÒNG`.
       - Hàng Phê duyệt: `KÍNH TRÌNH LÃNH ĐẠO UBND TỈNH` / `Ý KIẾN CỦA LÃNH ĐẠO UBND TỈNH` (vùng trống có viền để ghi bút phê).


---

## 3. QUY TRÌNH THỰC HIỆN CHUẨN (WORKFLOW)

### Bước 1: Xác định đúng loại văn bản và thẩm quyền ký
- Tra cứu thẩm quyền ký theo `references/phan_quyen_ky.md` (TM. / KT. / TL.).
- Lấy đúng ký hiệu cơ quan, đơn vị theo `references/bang_viet_tat.md`.

### Bước 2: Chuẩn bị file dữ liệu JSON đầu vào
Mẫu JSON chuẩn cho Công văn chỉ đạo/giao việc của UBND tỉnh (theo mẫu Phòng Nội chính):
```json
{
  "loai_van_ban": "cong_van",
  "co_quan_chu_quan": "ỦY BAN NHÂN DÂN",
  "co_quan_ban_hanh": "TỈNH LÂM ĐỒNG",
  "so_ky_hieu": "Số:             /UBND-NC",
  "dia_danh": "Lâm Đồng",
  "ngay": "      ",
  "thang": "04",
  "nam": "2026",
  "trich_yeu": "V/v triển khai thực hiện Công văn số 1099/VPCP-CĐS\ncủa Văn phòng Chính phủ",
  "kinh_gui": ["Sở Khoa học và Công nghệ"],
  "noi_dung": "Ủy ban nhân dân tỉnh nhận được Công văn số 1099/VPCP-CĐS ngày 04/02/2026 của Văn phòng Chính phủ về việc bảo đảm các điều kiện triển khai Hệ thống Quản lý văn bản và hồ sơ công việc mật của Chính phủ (gửi kèm theo); Chủ tịch Ủy ban nhân dân tỉnh chỉ đạo như sau:\n\nGiao Sở Khoa học và Công nghệ chủ trì, phối hợp với các sở, ban, ngành, địa phương và các cơ quan, đơn vị có liên quan nghiên cứu, chủ động triển khai các đề xuất, kiến nghị của Văn phòng Chính phủ tại Công văn số 1099/VPCP-CĐS theo thời gian quy định.",
  "quyen_han_ky": "TL. CHỦ TỊCH",
  "kt_chuc_vu": "KT. CHÁNH VĂN PHÒNG",
  "chuc_vu_ky": "PHÓ CHÁNH VĂN PHÒNG",
  "nguoi_ky": "Trịnh Ngọc Duệ",
  "noi_nhan": [
    "Như trên",
    "Chủ tịch, các PCT UBND tỉnh",
    "Các sở, ban, ngành tỉnh",
    "CVP, các PCVP UBND tỉnh",
    "UBND các huyện, thành phố",
    "Lưu: VT, NC.Châu"
  ]
}
```

Mẫu JSON chuẩn cho Quyết định của UBND tỉnh:
```json
{
  "loai_van_ban": "quyet_dinh",
  "co_quan_chu_quan": "ỦY BAN NHÂN DÂN",
  "co_quan_ban_hanh": "TỈNH LÂM ĐỒNG",
  "so_ky_hieu": "Số:             /QĐ-UBND",
  "dia_danh": "Lâm Đồng",
  "ngay": "      ",
  "thang": "04",
  "nam": "2026",
  "ten_loai": "QUYẾT ĐỊNH",
  "trich_yeu": "Về việc phê chuẩn kết quả bầu cử chức danh...",
  "can_cu": [
    "Căn cứ Luật Tổ chức chính quyền địa phương ngày 19 tháng 02 năm 2025",
    "Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư"
  ],
  "theo_de_nghi": "Theo đề nghị của Giám đốc Sở Nội vụ tại Tờ trình số 120/TTr-SNV ngày 10 tháng 4 năm 2026,",
  "dong_quyet_dinh": "QUYẾT ĐỊNH:",
  "cac_dieu": [
    "Phê chuẩn kết quả bầu cử...",
    "Quyết định này có hiệu lực thi hành kể từ ngày ký.",
    "Chánh Văn phòng UBND tỉnh, Giám đốc Sở Nội vụ và các cơ quan, cá nhân có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này."
  ],
  "quyen_han_ky": "TM. ỦY BAN NHÂN DÂN",
  "chuc_vu_ky": "CHỦ TỊCH",
  "nguoi_ky": "Trần Văn A",
  "noi_nhan": [
    "Như Điều 3",
    "Thường trực Tỉnh ủy",
    "Thường trực HĐND tỉnh",
    "Lưu: VT, NC"
  ]
}
```

### Bước 3: Chạy script sinh file
```bash
# Công văn:
node engine/generate_cong_van_nd30.js --input <input.json> --output <output.docx>

# Văn bản có tên loại (Quyết định, Tờ trình, Báo cáo, Kế hoạch...):
node engine/generate_vb_co_ten_loai_nd30.js --input <input.json> --output <output.docx>
```

### Bước 4: ⚠️ Checklist Rà Soát Trước Khi Xuất Bản (BẮT BUỘC)
- [ ] Trích yếu công văn là **chữ đứng, cỡ 12-13pt**, không nghiêng, không đậm.
- [ ] Số ký hiệu và Ngày tháng nằm trên **cùng một hàng ngang** (nhờ Table 2 hàng).
- [ ] Dấu `./.` **gắn trực tiếp** vào từ cuối cùng của câu cuối, không có dòng riêng.
- [ ] Không có đoạn văn trống ngăn cách giữa nội dung và bảng chữ ký.
- [ ] Đề mục (Điều, Khoản, La mã) thụt đầu dòng 1cm, in đậm chuẩn xác.
- [ ] Kính gửi in thường cỡ 14pt, không in đậm.
- [ ] Khối chữ ký đủ 4 dòng trống cho chữ ký tươi và con dấu.

---

## 4. TÀI LIỆU THAM KHẢO KÈM THEO
- `references/toan_bo_27_mau_noi_chinh.md`: **KHO TOÀN BỘ 27 MẪU LĨNH VỰC NỘI CHÍNH** (Trích xuất từ toàn bộ 3.553 hồ sơ thực tế: Tòa án - Tố tụng, Công an tỉnh, Cải cách TTHC, Các hội, Tư pháp, Tổ chức bộ máy, Thanh tra, Nghị quyết HĐND, Đảng ủy, Khiếu nại - Tố cáo...). BẮT BUỘC tra cứu file này để lấy đúng thể thức, căn cứ và nơi nhận mẫu.
- `references/quy_tac_the_thuc.md`: Toàn bộ thông số pixel-perfect và chuẩn bảng biểu Excel.
- `references/mau_cau_truc_vbhc.md`: Cấu trúc mẫu chuẩn từ hồ sơ thực tế Phòng Nội chính.
- `references/bang_viet_tat.md`: Bảng viết tắt cơ quan chuẩn theo Quyết định 4114.
- `references/phan_quyen_ky.md`: Quy định phân quyền ký văn bản hành chính.

