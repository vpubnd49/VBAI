# VBAI Agents Master Backup

This document contains the core instructions (prompts) and logic definitions for all agents in the VBAI project.

---

## 1. Văn Bản Hành Chính (NĐ30)
**Path:** `Skill_The_Thuc_VB_ND30/SKILL.md`

```markdown
# Tạo Văn Bản Hành Chính (NĐ30)

Skill sinh file `.docx` VB hành chính chuẩn **Nghị định 30/2020/NĐ-CP**.

### Hỗ trợ tất cả loại VBHC
- Nhóm 1: VB có tên loại (NQ, QĐ, TB, BC, HD, KH...)
- Nhóm 2: Công văn
- Nhóm 3: Biên bản

### Workflow
1. Thu thập thông tin (Loại VB, CQ ban hành, Nội dung, Người ký).
2. Tạo JSON đầu vào.
3. Rà soát thể thức (Bắt buộc).
4. Chạy script engine.
```

---

## 2. Văn Bản Đảng (HD36)
**Path:** `Skill_The_Thuc_VB_Dang_HD36/SKILL.md`

```markdown
# Skill: Sinh Văn Bản Đảng (HD 36-HD/VPTW)

Dùng cho các cơ quan Đảng (Cấp uỷ, Ban tham mưu, Chi bộ...).

### Điểm khác biệt quan trọng
- Lề phải 15mm.
- Dùng dấu sao (*) trong Quốc huy/Cơ quan.
- Quyền hạn dùng dấu gạch chéo (T/M, K/T...).
- Nơi nhận có gạch chân.
```

---

## 3. Xử lý PDF
**Path:** `Skill_PDF/SKILL.md`

```markdown
# PDF Processing Guide

Hỗ trợ:
- Trích xuất văn bản/bảng biểu.
- Gộp/Tách file PDF.
- Xoay trang, đóng dấu watermark.
- OCR cho tài liệu quét.
```

---

## 4. Tạo DOCX
**Path:** `Skill_DOCX/SKILL.md`

```markdown
# DOCX creation, editing, and analysis

Engine cốt lõi sử dụng thư viện `docx-js` để sinh file Word chuyên nghiệp với độ chính xác cao về lề, font chữ (Arial/Times New Roman) và bảng biểu.
```

---

## Environment Configuration
- **Firebase Project:** `vbai-a1729`
- **GCP Project:** `alvb-app-83921`
- **Region:** `asia-southeast1`
