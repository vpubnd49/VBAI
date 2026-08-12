# 📐 Skill: Tạo Văn Bản Hành Chính Chuẩn NĐ30

> **Mục đích**: Dạy AI Agent (Antigravity) cách sinh file `.docx` văn bản hành chính đúng thể thức **Nghị định 30/2020/NĐ-CP**.
> **Phiên bản**: 1.0 | Tháng 3/2026

---

## 🗂️ Cấu trúc thư mục

```
Skill_The_Thuc_VB_ND30/
├── README.md                  ← BẠN ĐANG ĐỌC FILE NÀY
├── SKILL.md                   ← File hướng dẫn chính cho AI Agent
└── references/
    ├── quy_tac_the_thuc.md    ← ⭐ Thông số pixel-perfect (Header, Body, Chữ ký)
    └── phan_quyen_ky.md       ← Ma trận phân quyền ký TM/KT/TL
```

---

## 🚀 Cách sử dụng

### Cách 1: Dùng với Antigravity (AG)

1. Copy **toàn bộ thư mục này** vào workspace của bạn theo đường dẫn:
   ```
   <workspace>/.agents/skills/tao-van-ban-hanh-chinh/
   ```
   *(hoặc `_agents/skills/` tuỳ cấu hình)*

2. Khi cần tạo văn bản, chỉ cần nói với AG:
   ```
   "Soạn công văn gửi [cơ quan] về việc..."
   "Tạo quyết định về việc..."
   ```

3. AG sẽ **tự động** áp dụng đúng thể thức NĐ30:
   - Header: Table 2 cột × 2 dòng ẩn viền
   - Font Times New Roman, cỡ chữ theo quy định
   - Đường kẻ bằng Border Top (không dùng Underline)
   - Body spacing: 6pt before/after, exact 17pt line spacing
   - Khối chữ ký đúng phân quyền TM/KT/TL

### Cách 2: Tham khảo thủ công

Đọc các file trong `references/` để biết thông số kỹ thuật chính xác khi soạn văn bản bằng Word hoặc lập trình tạo file `.docx`.

---

## 📐 Tóm tắt thể thức NĐ30

| Yếu tố | Thông số |
|---------|----------|
| Khổ giấy | A4 (210 × 297 mm) |
| Lề | Trái 3cm, Phải 2cm, Trên 2cm, Dưới 2cm |
| Font | Times New Roman |
| Cỡ chữ body | 13-14pt |
| Giãn dòng | Exact 17pt |
| Spacing | Before/After 6pt |

---

## ⚠️ Lưu ý

1. Skill này cần **Node.js ≥ 18** và thư viện `docx` (`npm install -g docx`) để sinh file `.docx`
2. **Luôn kiểm tra** file `.docx` bằng Microsoft Word trước khi in — AI chỉ là công cụ hỗ trợ
3. Bạn có thể bổ sung thêm file reference riêng (ví dụ: bảng viết tắt đơn vị, quy chế ký nội bộ) vào thư mục `references/` để tuỳ chỉnh cho cơ quan mình
