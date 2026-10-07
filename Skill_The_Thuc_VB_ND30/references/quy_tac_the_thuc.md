# Quy Tắc Thể Thức Văn Bản & Bảng Biểu (Chuẩn NĐ 30/2020/NĐ-CP & Thực Tế Hồ Sơ Nội Chính)

Tài liệu quy chuẩn chi tiết "pixel-perfect", rút ra từ Nghị định số 30/2020/NĐ-CP của Chính phủ và hơn 1.800 file văn bản thực tế tại Phòng Nội chính Văn phòng UBND tỉnh (Lâm Đồng / Bình Thuận).

---

## 1. Page Layout (Định Dạng Trang In Chuẩn A4)

| Thông số | Giá trị chuẩn | Giá trị DXA (Twips) | Ghi chú |
|:---|:---|:---|:---|
| **Khổ giấy** | A4 (210 x 297 mm) | - | Bắt buộc đứng (portrait), phụ lục bảng biểu có thể ngang (landscape) |
| **Lề trái (Left)** | 30 mm (3.0 cm) | **1701 dxa** | Dành để đóng gáy hồ sơ |
| **Lề phải (Right)** | 20 mm (2.0 cm) | **1134 dxa** | (NĐ30 cho phép 15 - 20 mm; chuẩn thực tế: 20 mm) |
| **Lề trên (Top)** | 20 mm (2.0 cm) | **1134 dxa** | (NĐ30 cho phép 20 - 25 mm; chuẩn thực tế: 20 mm) |
| **Lề dưới (Bottom)** | 20 mm (2.0 cm) | **1134 dxa** | (NĐ30 cho phép 20 - 25 mm; chuẩn thực tế: 20 mm) |
| **Font chữ** | **Times New Roman** | - | Bắt buộc bảng mã Unicode dựng sẵn |
| **Khoảng cách đoạn** | Before: 6pt, After: 6pt | **120 dxa** | Giãn đoạn tối thiểu 6pt |
| **Dòng dãn (Line spacing)** | Single đến 1.5 lines | **340 dxa** (17pt exact) hoặc line 264 - 280 auto |

---

## 2. Header (BẮT BUỘC Dùng Table 2 Cột x 2 Hàng Ẩn Viền)

> **NGUYÊN TẮC BẮT BUỘC TỪ THỰC TẾ NỘI CHÍNH:**
> Tuyệt đối **KHÔNG ĐƯỢC** gộp toàn bộ header vào 1 hàng (1 TableRow), vì khi tên cơ quan có 2 - 3 dòng thì dòng "Số: ..." ở ô trái sẽ bị đẩy tụt xuống thấp hơn dòng "Địa danh, ngày..." ở ô phải.
> **BẮT BUỘC** chia Header thành **2 hàng (2 TableRows)** để "Số ký hiệu" và "Địa danh, ngày tháng" **LUÔN NẰM TRÊN CÙNG MỘT HÀNG NGANG**.

```
+------------------------------------+------------------------------------------+
| HÀNG 1 - Ô TRÁI (3500 dxa)         | HÀNG 1 - Ô PHẢI (5571 dxa)               |
| - Tên cơ quan chủ quản (nếu có)    | - CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM    |
| - TÊN CƠ QUAN BAN HÀNH (ĐẬM, HOA)  |   (Cỡ 13, IN HOA, ĐẬM)                   |
|   + Đường kẻ ngang 1/3 - 1/2       | - Độc lập - Tự do - Hạnh phúc            |
|                                    |   (Cỡ 14, Chữ thường, ĐẬM)               |
|                                    |   + Đường kẻ ngang = chiều dài Tiêu ngữ  |
+------------------------------------+------------------------------------------+
| HÀNG 2 - Ô TRÁI (3500 dxa)         | HÀNG 2 - Ô PHẢI (5571 dxa)               |
| - Số:      /UBND-NC (Cỡ 12-13)     | - Lâm Đồng, ngày    tháng    năm 2026    |
| - V/v ... (ĐỨNG, cỡ 12-13)         |   (Cỡ 13-14, IN NGHIÊNG, Căn giữa)       |
+------------------------------------+------------------------------------------+
```

### Chi Tiết Từng Phần Tử Header:
1. **Quốc hiệu**: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM` — Cỡ **13pt**, IN HOA, **IN ĐẬM**, căn giữa.
2. **Tiêu ngữ**: `Độc lập - Tự do - Hạnh phúc` — Cỡ **14pt**, chữ thường hoa chữ cái đầu mỗi từ, **IN ĐẬM**, căn giữa. Kèm đường gạch ngang nét đơn dưới tiêu ngữ, chiều dài đúng bằng chiều dài tiêu ngữ (indent left/right: 1100 dxa).
3. **Cơ quan ban hành**:
   - Dòng 1 (Cơ quan chủ quản, nếu có): Cỡ **12-13pt**, IN HOA, chữ đứng, không đậm.
   - Dòng 2 (Cơ quan ban hành): Cỡ **12-13pt**, IN HOA, **IN ĐẬM**. Kèm đường gạch ngang nét đơn bằng 1/3 đến 1/2 chiều dài tên cơ quan (indent left/right: 1350 - 1500 dxa).
4. **Số và ký hiệu văn bản**:
   - Nằm ở Hàng 2, ô trái. Cỡ **12-13pt**, chữ đứng, căn giữa.
   - Ví dụ: `Số:      /UBND-NC` hoặc `Số: 1099/VPCP-CĐS`.
5. **Trích yếu nội dung Công văn**:
   - **BẮT BUỘC CHỮ ĐỨNG, KHÔNG IN NGHIÊNG, KHÔNG IN ĐẬM** (`italics: false`, `bold: false`).
   - Căn cứ: Nghị định 30/2020/NĐ-CP Phụ lục I mục II.4.b: *"bằng chữ in thường, cỡ chữ từ 12 đến 13, kiểu chữ đứng; đặt dưới chữ 'V/v'"*.
   - Căn giữa ô trái, đặt ngay dưới Số ký hiệu.
   - Ví dụ: `V/v triển khai thực hiện Công văn số 1099/VPCP-CĐS của Văn phòng Chính phủ`.
6. **Địa danh và ngày, tháng, năm ban hành**:
   - Nằm ở Hàng 2, ô phải (ngang hàng với Số ký hiệu).
   - Cỡ **13-14pt**, **IN NGHIÊNG**, căn giữa.
   - Ví dụ: `Lâm Đồng, ngày       tháng 02 năm 2026`.

---

## 3. Tên Loại Văn Bản & Trích Yếu (Cho Văn Bản Có Tên Loại: QĐ, TTr, BC, KH, TB...)

1. **Tên loại văn bản**:
   - `QUYẾT ĐỊNH`, `TỜ TRÌNH`, `BÁO CÁO`, `KẾ HOẠCH`, `THÔNG BÁO`, `QUY CHẾ`...
   - Cỡ **14pt** (hoặc 15pt), IN HOA, **IN ĐẬM**, căn giữa trang. Spacing before: 240 - 360 dxa.
2. **Trích yếu nội dung**:
   - Cỡ **13-14pt**, chữ in thường (viết hoa chữ đầu), **IN ĐẬM**, căn giữa trang.
   - Đặt ngay dưới tên loại văn bản.
   - Có đường kẻ ngang nét đơn mỏng (hoặc `_______________`) ngăn cách với phần căn cứ/nội dung.
3. **Thẩm quyền ban hành (trong Quyết định, Quy định)**:
   - `ỦY BAN NHÂN DÂN TỈNH LÂM ĐỒNG` (hoặc `CHỦ TỊCH ỦY BAN NHÂN DÂN...`)
   - Cỡ **14pt**, IN HOA, **IN ĐẬM**, căn giữa trang.

---

## 4. Căn Cứ Ban Hành Văn Bản (Trong Quyết Định, Nghị Quyết, Kế Hoạch...)

- Cỡ chữ: **14pt**, kiểu chữ **IN NGHIÊNG** (`italics: true`).
- Thụt đầu dòng: **1.0 cm - 1.27 cm** (`firstLine: 567 - 720 dxa`), căn đều 2 bên (Justified).
- Dấu câu: Mỗi dòng căn cứ kết thúc bằng dấu chấm phẩy **`;`**. Dòng căn cứ cuối cùng (hoặc dòng "Theo đề nghị của...") kết thúc bằng dấu phẩy **`,`** hoặc dấu chấm **`.`**.
- Ví dụ thực tế:
  ```
  Căn cứ Luật Tổ chức chính quyền địa phương ngày 19 tháng 02 năm 2025;
  Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;
  Theo đề nghị của Giám đốc Sở Nội vụ tại Tờ trình số 120/TTr-SNV ngày 10 tháng 3 năm 2026,
  ```

---

## 5. Kính Gửi (Địa Chỉ Nhận Văn Bản Trong Công Văn, Tờ Trình)

- Kiểu chữ: Chữ thường, cỡ **14pt**, kiểu chữ **ĐỨNG**, **TUYỆT ĐỐI KHÔNG IN ĐẬM**.
- Nếu gửi 1 nơi:
  `Kính gửi: Sở Khoa học và Công nghệ.`
  (Thụt lề trái ~2.5 - 4.5cm hoặc căn đều, lùi đầu dòng).
- Nếu gửi nhiều nơi:
  ```
  Kính gửi:
  - Sở Tư pháp;
  - Sở Tài chính;
  - Ủy ban nhân dân các huyện, thành phố.
  ```

---

## 6. Phân Cấp Nề Mục (Heading Hierarchy) Chuẩn Xác

Khi sinh văn bản, phải bóc tách và định dạng nề mục đúng phân cấp:

1. **Chương / Phần**:
   - Ví dụ: `Chương I`, `Phần thứ nhất`.
   - Cỡ **14pt**, IN HOA, **IN ĐẬM**, **CĂN GIỮA TRANG** (`AlignmentType.CENTER`).
   - Tiêu đề chương bên dưới: Cỡ 14pt, IN HOA, **IN ĐẬM**, căn giữa.
2. **Mục**:
   - Ví dụ: `Mục 1`, `Mục 2`.
   - Cỡ **14pt**, **IN ĐẬM**, **CĂN GIỮA TRANG**.
3. **Mục La Mã**:
   - Ví dụ: `I. MỤC ĐÍCH, YÊU CẦU`, `II. NHIỆM VỤ TRỌNG TÂM`.
   - Cỡ **14pt**, IN HOA, **IN ĐẬM**, thụt đầu dòng 1cm (`firstLine: 567 dxa`), căn đều 2 bên.
4. **Điều trong văn bản quy phạm / quyết định**:
   - `Điều 1. Phạm vi điều chỉnh`: Chữ `Điều 1. Phạm vi điều chỉnh` được **IN ĐẬM**, phần nội dung sau dấu hai chấm (hoặc xuống dòng) in thường.
   - Thụt đầu dòng 1cm (`firstLine: 567 dxa`), căn đều 2 bên.
5. **Khoản / Mục số Ả Rập**:
   - Ví dụ: `1. Về công tác chuyên môn:`, `2. Về kinh phí thực hiện:`.
   - Cỡ **14pt**, **IN ĐẬM** số thứ tự và tiêu đề trước dấu hai chấm `:`, nội dung tiếp theo in thường.
   - Thụt đầu dòng 1cm, căn đều 2 bên.
6. **Điểm / Tiểu mục chữ cái**:
   - Ví dụ: `a) Đối với các cơ quan chuyên môn:`, `b) Đối với Ủy ban nhân dân cấp xã:`.
   - Cỡ **14pt**, **IN ĐẬM** (hoặc nghiêng) phần `a) Tiêu đề:`, nội dung tiếp theo in thường.
   - Thụt đầu dòng 1cm, căn đều 2 bên.
7. **Đoạn gạch đầu dòng `- `**:
   - Thụt đầu dòng 1cm, cỡ 14pt, in thường đứng, căn đều 2 bên.

---

## 7. Dấu Kết Thúc Văn Bản Hành Chính (`./.`) — QUY TẮC BẮT BUỘC

> [!CAUTION]
> **LỖI PHỔ BIẾN CẦN TRÁNH TUYỆT ĐỐI:**
> 1. Không bao giờ tạo đoạn văn riêng (Paragraph riêng) chỉ chứa mỗi dấu `./.`.
> 2. Không bao giờ để dấu `./.` rớt xuống dòng trống đơn độc.
> 3. Không bao giờ chèn đoạn văn trống (`new Paragraph({ text: "" })`) trước bảng chữ ký.

**Quy tắc chuẩn:**
- Dấu `./.` **GẮN LIỀN VÀO TỪ CUỐI CÙNG CỦA CÂU CUỐI CÙNG** trong nội dung văn bản.
- Cách xử lý:
  - Nếu câu cuối là `...thực hiện theo quy định.` → chuyển thành `...thực hiện theo quy định./.`
  - Nếu câu cuối là `...thi hành Quyết định này.` → chuyển thành `...thi hành Quyết định này./.`

---

## 8. Bảng Chữ Ký & Nơi Nhận (Khối Chân Trang)

Bắt buộc dùng **Table 2 Cột ẩn viền**, đặt ngay sát sau đoạn văn cuối cùng:

```
+------------------------------------+------------------------------------------+
| CỘT TRÁI: NƠI NHẬN (4400 dxa)      | CỘT PHẢI: CHỮ KÝ (4671 dxa)              |
|                                    |                                          |
| Nơi nhận: (Đậm, nghiêng, cỡ 12)    | TM. ỦY BAN NHÂN DÂN (Đậm, cỡ 13-14)      |
| - Như trên; (Đứng, cỡ 11)          | CHỦ TỊCH (Đậm, cỡ 13-14)                 |
| - Thường trực Tỉnh ủy;             |                                          |
| - Thường trực HĐND tỉnh;           | (4 dòng trống cho chữ ký và đóng dấu)    |
| - Chủ tịch, các PCT UBND tỉnh;     |                                          |
| - Lưu: VT, NC.Châu. (Đứng, cỡ 11)  | Đỗ Hữu Huy (Đậm, cỡ 14, căn giữa)        |
+------------------------------------+------------------------------------------+
```

### Quy cách chi tiết:
- **Cột Nơi nhận (trái)**:
  - Dòng tiêu đề: `Nơi nhận:` — Cỡ **12pt**, **IN ĐẬM**, *IN NGHIÊNG*.
  - Các dòng cơ quan nhận: Cỡ **11pt**, in đứng thường, thụt lề nhẹ, mỗi dòng bắt đầu bằng `- `, kết thúc bằng dấu chấm phẩy **`;`**.
  - Dòng cuối cùng: `- Lưu: VT, [Ký hiệu phòng/chuyên viên].` kết thúc bằng dấu chấm **`.`**. Giãn dòng đơn (`spacing: { before: 0, after: 0, line: 240 }`).
- **Cột Chữ ký (phải)**:
  - Quyền hạn ký: `TM. ỦY BAN NHÂN DÂN`, `TL. CHỦ TỊCH`, `KT. CHỦ TỊCH` — Cỡ **13-14pt**, IN HOA, **IN ĐẬM**, căn giữa.
  - Chức vụ người ký: `CHỦ TỊCH`, `PHÓ CHỦ TỊCH`, `CHÁNH VĂN PHÒNG` — Cỡ **13-14pt**, IN HOA, **IN ĐẬM**, căn giữa.
  - **4 dòng trống**: Dùng đúng 4 Paragraph rỗng với `size: 28` để tạo khoảng trống chuẩn cho chữ ký tươi và con dấu cơ quan.
  - Họ và tên người ký: Cỡ **14pt**, in thường hoa chữ cái đầu (hoặc IN HOA), **IN ĐẬM**, căn giữa thẳng hàng dưới chức vụ.

---

## 9. Quy Chuẩn Bảng Biểu & Phụ Lục Kèm Theo (Word & Excel)

Khi tạo phụ lục bảng số liệu, danh sách đính kèm bằng Word hoặc file Excel độc lập:

1. **Font chữ thống nhất**: Bắt buộc dùng font **Times New Roman** toàn bộ bảng.
2. **Tiêu đề bảng biểu**:
   - Cỡ **13-14pt**, IN HOA, **IN ĐẬM**, căn giữa bảng (trong Excel: Merge & Center).
   - Ví dụ: `DANH MỤC THỦ TỤC HÀNH CHÍNH ÁP DỤNG TRÊN ĐỊA BÀN TỈNH LÂM ĐỒNG`
3. **Dòng căn cứ ban hành**:
   - Nằm ngay dưới tiêu đề bảng. Cỡ **12-13pt**, *in nghiêng*, căn giữa.
   - Ví dụ: `(Kèm theo Quyết định số       /QĐ-UBND ngày    tháng 4 năm 2026 của UBND tỉnh Lâm Đồng)`
4. **Hàng tiêu đề cột (Table Headers)**:
   - Cỡ **12-13pt**, **IN ĐẬM**, căn giữa cả chiều ngang lẫn chiều dọc (Center / Middle).
   - Tự động ngắt dòng (`Wrap Text = true`). Nền tiêu đề: màu xám nhạt (`#F2F2F2`) hoặc màu trắng sạch sẽ.
5. **Hàng đánh số thứ tự cột**:
   - Bắt buộc có dòng đánh số thứ tự: `(1)`, `(2)`, `(3)`, `(4)`...
   - Cỡ **11-12pt**, *in nghiêng*, căn giữa.
6. **Định dạng dữ liệu các cột trong bảng**:
   - Cột STT, Ngày tháng, Số hiệu, Mã số: Căn giữa (`Center`).
   - Cột Tên gọi, Nội dung công việc, Địa chỉ, Ghi chú: Căn trái (`Left`), thụt lề nhẹ 2-3px.
   - Cột Số lượng, Kinh phí, Tỷ lệ %: Căn phải (`Right`), định dạng số có dấu phân cách hàng nghìn (`#,##0`).
7. **Đường viền bảng (Borders)**:
   - Viền toàn bộ bảng bằng nét đơn mỏng (Thin border, màu đen hoặc xám đậm `#000000` / `#595959`).
   - Tuyệt đối không dùng nét đôi hay viền đứt nét lộn xộn.
