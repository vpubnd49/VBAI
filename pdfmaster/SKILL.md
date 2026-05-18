---
name: pdf-pipeline
description: Pipeline tự động trích xuất văn bản pháp luật từ nguồn chính thống, chuyển đổi Markdown sang HTML và xuất PDF chuyên nghiệp.
version: 1.0.2
status: active
zone: B
keywords: [PDF, pipeline, pháp luật, nghị định, thông tư, markdown, html, highlights, customs]
created: 2026-05-18
---

# PDF Pipeline

Pipeline tự động hóa quy trình xuất bản tài liệu nội bộ — từ văn bản pháp luật gốc đến file HTML/PDF chuyên nghiệp, sẵn sàng in ấn và gửi khách hàng.

## When to Use (Khi nào kích hoạt)

Kích hoạt skill này khi người dùng:
- Cung cấp link văn bản pháp luật (Nghị định, Thông tư, Luật) và yêu cầu trình bày thành tài liệu highlights
- Yêu cầu tạo tài liệu nội bộ, bản tin nội bộ, hoặc tài liệu
- Nhắc đến "tạo highlights", "đóng gói nghị định", "xuất PDF pháp luật"
- Cần chuyển đổi nội dung phân tích luật thành file HTML/PDF chuẩn với giao diện chuyên nghiệp

## Procedure (Quy trình thực hiện)

### BƯỚC 0: Xác định nguồn — QUY TẮC BẮT BUỘC

> ⚠️ **CẢNH BÁO QUAN TRỌNG — NGUỒN DỮ LIỆU PHÁP LUẬT**
>
> Nội dung liên quan đến Nghị định, Thông tư, Luật là **thông tin nhạy cảm pháp lý**.
> Agent **TUYỆT ĐỐI KHÔNG ĐƯỢC** tự suy diễn, bịa nội dung, hoặc lấy nguồn không chính thống.

**Nguồn hợp lệ (CHỈ chấp nhận từ các nguồn sau):**

| Ưu tiên | Nguồn | URL gốc |
|---------|-------|---------|
| 1 | Thư Viện Pháp Luật | `thuvienphapluat.vn` |
| 2 | Cổng TTĐT Chính phủ | `chinhphu.vn`, `vanban.chinhphu.vn` |
| 3 | Công báo điện tử | `congbao.chinhphu.vn` |
| 4 | Cổng Bộ Công Thương | `moit.gov.vn` |
| 5 | Cổng Tổng cục Hải quan | `customs.gov.vn` |

**Quy trình xác định nguồn:**
1. **Người dùng cung cấp link** → Kiểm tra link thuộc danh sách nguồn hợp lệ → Tiến hành trích xuất.
2. **Người dùng chỉ nói tên văn bản** (VD: "NĐ 25/2026") → Agent tìm trên `thuvienphapluat.vn` trước, nếu không có thì `chinhphu.vn`. Phải xác nhận lại với người dùng trước khi trích xuất.
3. **Không tìm thấy nguồn** → DỪNG LẠI, báo người dùng: "Không tìm thấy văn bản trên các nguồn chính thống. Vui lòng cung cấp link trực tiếp."

**TUYỆT ĐỐI KHÔNG:**
- Tự bịa số liệu, điều khoản, hoặc nội dung pháp lý
- Lấy nội dung từ blog, báo chí, hoặc nguồn không chính thống
- Suy diễn ý nghĩa điều luật khi chưa đọc nguyên văn
- Thêm bớt nội dung không có trong văn bản gốc

---

### BƯỚC 1: Trích xuất nội dung từ nguồn

1. Mở link văn bản pháp luật bằng `read_url_content` hoặc `browser_subagent`.
2. Trích xuất các phần quan trọng:
   - Tên đầy đủ văn bản
   - Số hiệu (VD: `25/2026/NĐ-CP`)
   - Ngày ban hành, ngày hiệu lực
   - Căn cứ pháp lý chính
   - Các điều khoản trọng tâm cần highlight
3. Ghi chú lại URL nguồn gốc để đặt vào metadata file Markdown.

---

### BƯỚC 2: Soạn nội dung Markdown

Tạo file Markdown theo **cấu trúc chuẩn** dưới đây. Tham khảo file mẫu tại `examples/nd25-2026-highlights-sample.md` trong thư mục skill.

#### Cấu trúc bắt buộc:

```markdown
# [Tên Nghị Định] - Highlights & Lưu Ý

> **Tên đầy đủ:** [Tên chính thức đầy đủ]
>
> **Số hiệu:** [XX/20XX/NĐ-CP]
>
> **Ngày ban hành:** [DD/MM/YYYY]
>
> **Hiệu lực:** [DD/MM/YYYY]
>
> **Căn cứ chính:** [Tên luật gốc]
>
> **Nguồn:** [URL nguồn chính thống]

---

## 1. PHẠM VI ĐIỀU CHỈNH (Điều X)

[Tóm tắt ngắn gọn phạm vi]

---

## 2. CÁC ĐIỂM HIGHLIGHT QUAN TRỌNG

### 🔴 2.1 [Tên điểm nhấn] (Điều XX)

[Nội dung chi tiết — trích dẫn sát nguyên văn]

**💡 Đề xuất lưu ý:**
- [Gợi ý hành động cho doanh nghiệp]

---

## 3. BẢNG HÀNH ĐỘNG ƯU TIÊN CHO DOANH NGHIỆP

| Ưu tiên | Hành động | Deadline |
|---------|----------|----------|
| 🔴 Cao | [Hành động cụ thể] | [Thời hạn] |
| 🟡 TB  | [Hành động cụ thể] | [Thời hạn] |
```

#### Quy tắc viết nội dung:

| Quy tắc | Mô tả |
|---------|-------|
| **KHÔNG YAML Frontmatter** | Không bao giờ đặt block `---` kiểu YAML ở đầu file. Tool export PDF sẽ hiển thị raw text |
| **KHÔNG Disclaimer cuối file** | Footer disclaimer đã được tích hợp cứng trong template HTML. Nếu thêm thủ công sẽ gây rớt Footer |
| **Emoji có chọn lọc** | Dùng 🔴 (quan trọng), ⚠️ (cảnh báo), 📌 (lưu ý), 💡 (đề xuất), 🟡 (trung bình), 🟢 (dài hạn) |
| **Trích dẫn sát nguồn** | Nội dung pháp lý phải bám sát nguyên văn, không paraphrase quá xa |
| **Ghi rõ Điều/Khoản** | Mỗi mục highlight phải ghi rõ số Điều tham chiếu (VD: "Điều 33 - 34") |
| **Bảng hành động** | Luôn kết thúc bằng bảng hành động ưu tiên (🔴/🟡/🟢) để người đọc biết phải làm gì |

#### Lưu file:
- **Vị trí:** `D:\1_MINH DO\1_Projects\_active\dao-tao-ai-xnk-logistics\research\`
- **Tên file:** `[ten-van-ban]-highlights.md` (VD: `nd25-2026-highlights.md`)

---

### BƯỚC 3: Build HTML & PDF

#### 3.1 Chuẩn bị môi trường (chỉ cần làm 1 lần)

Đảm bảo các file sau đã có trong thư mục làm việc (`research/`):
- `build_pdf.py` — Script build (copy từ `scripts/` của skill nếu chưa có)
- `document-template.html` — Template HTML (copy từ `templates/` của skill nếu chưa có)
- `logo.png` — Logo công ty (copy từ `templates/` của skill nếu chưa có)

**Cài dependencies (1 lần):**
```bash
pip install markdown pyhtml2pdf
```

#### 3.2 Chạy build

```bash
cd "D:\1_MINH DO\1_Projects\_active\dao-tao-ai-xnk-logistics\research"
python build_pdf.py [ten_file].md
```

**Script sẽ tự động:**
1. Đọc Markdown → Trích xuất metadata (tên, số hiệu, ngày hiệu lực...)
2. Convert Markdown → HTML với card wrapping (h2 → `.card`, h3 → `.action`)
3. Nhúng Logo VBAI dạng Base64 vào header
4. Inject nội dung vào template HTML chuyên nghiệp
5. Xuất file `.html` (để gửi email, xem trên web)
6. Xuất file `_vX.pdf` với phân trang `Trang X / Y` (để in ấn, gửi khách hàng)

#### 3.3 Kiểm tra kết quả

- Exit code phải = 0
- Mở file PDF kiểm tra:
  - Header VBAI hiển thị đúng logo + số hiệu + ngày hiệu lực
  - Nội dung các card (🔴, 💡) hiển thị đúng màu sắc
  - Footer xanh navy nằm cuối trang có nội dung, KHÔNG bị cô lập ở trang trắng riêng
  - Phân trang "Trang X / Y" hiển thị chính xác

---

## Pitfalls (Lỗi thường gặp & cách xử lý)

### 1. Footer bị rớt sang trang trắng riêng
- **Nguyên nhân:** Có nội dung disclaimer/text thừa cuối file Markdown nằm ngoài vùng bọc `.card`
- **Khắc phục:** Xóa mọi disclaimer cuối file Markdown. Footer đã tích hợp cứng trong template

### 2. Dịch vụ ở Footer bị rớt chữ hoặc mất cân đối
- **Nguyên nhân:** Dùng `display: inline-block` khiến các block bị rớt dòng tự do.
- **Khắc phục:** Template chuẩn đã được cập nhật sử dụng CSS Grid (`grid-template-columns: repeat(3, max-content)`) để ép 6 dịch vụ thành khối 3x2 cân bằng. KHÔNG tự sửa lại thành flex/inline.

### 3. Xuất hiện các đường kẻ ngang màu đen dư thừa trong PDF
- **Nguyên nhân:** Dùng `---` trong Markdown để phân tách đoạn, trình biên dịch tự động convert thành thẻ `<hr>`, thẻ này mặc định có viền đen gạch ngang trang.
- **Khắc phục:** Template HTML chuẩn đã được cấu hình ẩn hoàn toàn (`hr { display: none; }`). Vẫn có thể dùng `---` khi soạn thảo Markdown cho dễ nhìn, nhưng sẽ không hiển thị đường kẻ thừa trên PDF nữa.

### 4. PermissionError khi xuất PDF
- **Nguyên nhân:** File PDF phiên bản cũ đang mở bằng Acrobat/Edge/Chrome
- **Khắc phục:** Mở `build_pdf.py`, tăng version number (VD: `_v8.pdf` → `_v9.pdf`), chạy lại

### 3. Khoảng trắng lớn giữa các mục (Ghost Spacing)
- **Nguyên nhân:** CSS `page-break-inside: avoid` trên `.card` lớn ép toàn bộ card sang trang mới
- **Khắc phục:** Template chuẩn đã gỡ bỏ rule này cho `.card`. KHÔNG tự thêm lại

### 4. YAML Frontmatter hiện raw text trên PDF
- **Nguyên nhân:** Tool export PDF không parse YAML frontmatter
- **Khắc phục:** KHÔNG BAO GIỜ dùng block `---` kiểu YAML ở đầu file Markdown

### 5. Nội dung pháp lý sai lệch
- **Nguyên nhân:** Agent tự suy diễn hoặc lấy nguồn không chính thống
- **Khắc phục:** Luôn cross-check với nguyên văn trên thuvienphapluat.vn. Nếu không chắc chắn → ghi rõ "Cần xác nhận lại với nguyên văn Điều X"

---

## Verification (Kiểm tra chất lượng)

### Checklist trước khi giao:

- [ ] File `.html` mở đúng trên trình duyệt, hiển thị đầy đủ header/footer VBAI
- [ ] File `.pdf` mở đúng, phân trang hợp lý, không có trang trắng thừa
- [ ] Footer nằm liền cuối trang có nội dung (không cô lập)
- [ ] Tất cả số Điều/Khoản được ghi rõ và khớp với nguyên văn
- [ ] URL nguồn chính thống được ghi trong metadata (blockquote đầu file)
- [ ] Bảng hành động ưu tiên có đủ 3 cấp (🔴/🟡/🟢)
- [ ] Không có YAML frontmatter, không có disclaimer cuối file

---

## Skill Files (Các file đi kèm)

```
pdf-pdf-pipeline/
├── SKILL.md                              ← File này
├── scripts/
│   └── build_pdf.py                  ← Script build chính (portable)
├── templates/
│   ├── document-template.html  ← Template HTML chuẩn
│   └── logo.png                      ← Logo VBAI
└── examples/
    └── nd25-2026-highlights-sample.md    ← File Markdown mẫu
```

**Khi triển khai cho người dùng mới:** Copy toàn bộ folder `scripts/`, `templates/` vào thư mục làm việc, cài `pip install markdown pyhtml2pdf`, và bắt đầu soạn Markdown theo cấu trúc mẫu.
