# 🏛️ VBAI PDF Pipeline

Pipeline tự động hóa quy trình xuất bản tài liệu nội bộ và tư vấn khách hàng cho Hệ thống Trợ lý Hành chính — từ văn bản pháp luật gốc đến file HTML/PDF chuyên nghiệp, sẵn sàng in ấn và gửi khách hàng.

## 🌟 Chức năng chính

- Trích xuất và tóm tắt thông tin từ các nguồn pháp luật chính thống (Thư Viện Pháp Luật, Cổng TTĐT Chính phủ...).
- Chuyển đổi Markdown thành HTML với giao diện `.card` chuẩn doanh nghiệp.
- Nhúng trực tiếp Logo VBAI (Base64) và Header/Footer nhận diện thương hiệu.
- Tự động xuất file **PDF chất lượng cao**, phân trang hoàn hảo, tích hợp CSS Grid cho phần Footer và triệt tiêu các khoảng trắng/lỗi dàn trang thừa (Artifact-free).

## 📂 Cấu trúc Repository

```text
pdf-pdf-pipeline/
├── SKILL.md                              ← Agent Instruction (Hướng dẫn thực thi cho AI Agent)
├── README.md                             ← Thông tin tổng quan repository
├── scripts/
│   └── build_pdf.py                  ← Script Python biên dịch PDF/HTML
├── templates/
│   ├── document-template.html  ← Template HTML gốc (CSS Grid, Print Media)
│   └── logo.png                      ← Logo định dạng chuẩn của VBAI
└── examples/
    └── nd25-2026-highlights-sample.md    ← File Markdown quy chuẩn mẫu
```

## 🚀 Cài đặt & Sử dụng

### 1. Yêu cầu hệ thống
- Python 3.8+
- Cài đặt các thư viện phụ thuộc:
  ```bash
  pip install markdown pyhtml2pdf
  ```

### 2. Hướng dẫn sử dụng
1. Soạn thảo file Markdown tuân thủ theo cấu trúc quy định (Xem mẫu tại thư mục `examples/`).
2. Chạy script để tự động xuất file HTML và PDF:
   ```bash
   python scripts/build_pdf.py [ten_file_markdown].md
   ```
3. Script sẽ tự động đọc Markdown, trích xuất metadata (Tên văn bản, Số hiệu, Ngày hiệu lực), thay thế các biến trong Template HTML và kết xuất ra file PDF cuối cùng.

## ⚠️ Cảnh báo (Pitfalls & Troubleshooting)
- **Không dùng YAML Frontmatter (`---`)** ở đầu file Markdown. Tool xuất PDF không xử lý cấu trúc này và sẽ in ra text raw.
- Thẻ phân tách đoạn `<hr>` (tạo ra từ `---` trong Markdown) đã được CSS trong Template ẩn đi để không hiển thị đường kẻ đen thừa trên PDF.
- Bố cục danh sách Dịch vụ ở Footer đã được tối ưu bằng **CSS Grid 3x2** để đảm bảo đối xứng, không được chuyển về dạng Flex hay Inline-block.
- Nếu gặp lỗi `PermissionError` khi xuất PDF, tức là file PDF hiện tại đang được mở bởi trình đọc (Acrobat/Edge). Hãy đóng file hoặc tăng version (vd: `_v8.pdf` → `_v9.pdf`) trong file `build_pdf.py`.

## 📌 Về dự án này
Đây là một **AI Agent Skill** thuộc hệ sinh thái **Google Antigravity Framework**, đảm bảo tự động hóa quy trình Content Pipeline cho Hệ thống Trợ lý Hành chính với độ ổn định cao nhất (Zone B).
