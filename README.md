# 📦 Skill Pack — Bộ Công Cụ Soạn Văn Bản

Folder này chứa 4 skill dùng với AI Agent (Gemini/Antigravity) để soạn văn bản hành chính và văn bản Đảng.

## Danh Sách Skill

| # | Folder | Mô tả | Ngôn ngữ |
|:---:|:---|:---|:---:|
| 1 | `Skill_The_Thuc_VB_Dang_HD05/` | Sinh VB Đảng chuẩn HD 05-HD/VPTW (thay thế HD36) | 🇻🇳 |
| 2 | `Skill_The_Thuc_VB_ND30/` | Sinh VB hành chính chuẩn NĐ 30/2020 | 🇻🇳 |
| 3 | `Skill_PDF/` | Đọc, trích xuất, OCR, xử lý PDF | 🇬🇧 |
| 4 | `Skill_DOCX/` | Tạo, sửa, phân tích file Word (.docx) | 🇬🇧 |

## Cách Sử Dụng

### Bước 1: Copy vào workspace
Copy toàn bộ folder skill vào thư mục `.agents/skills/` hoặc `toolkits/` trong workspace của bạn.

### Bước 2: Cài dependencies (nếu cần)
```bash
# Cho Skill VB Đảng HD05
cd Skill_The_Thuc_VB_Dang_HD05 && npm install

# Cho Skill VB NĐ30
cd Skill_The_Thuc_VB_ND30 && npm install
```

### Bước 3: Yêu cầu AI Agent
Chỉ cần yêu cầu bằng ngôn ngữ tự nhiên, AI sẽ tự nhận diện skill phù hợp:
- *"Soạn nghị quyết của Tỉnh ủy..."* → Skill HD05
- *"Làm quyết định bổ nhiệm..."* → Skill NĐ30
- *"Đọc file PDF này..."* → Skill PDF
- *"Xuất ra file Word..."* → Skill DOCX

## Cập Nhật Gần Nhất (18/03/2026)
- ✅ Thêm bước **rà soát thể thức bắt buộc** vào cả 2 skill VB
- ✅ Sửa khoản trong VB Đảng: dùng **1. 2. 3.** (in đậm) thay vì a), b), c)
- ✅ Sửa logic chức vụ ký NĐ30: đậm khi ký trực tiếp
- ✅ Cập nhật toàn bộ thể thức VB Đảng sang **HD05** mới nhất (thay thế HD36)
