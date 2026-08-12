# Tiêu Chuẩn Trình Bày Văn Bản theo Nghị Định 30/2020/NĐ-CP

> **Căn cứ:** Nghị định 30/2020/NĐ-CP ngày 05/3/2020 về công tác văn thư, Phụ lục I — Thể thức và kỹ thuật trình bày văn bản hành chính.
> **Trạng thái hiệu lực:** Còn hiệu lực tại 21/07/2026.
> **Ứng dụng trong legalkit-vn:** Áp dụng cho toàn bộ output `.docx` từ `contract_builder.py`.

---

## 1. Khổ Giấy & Định Hướng

| Thông số | Giá trị | Ghi chú |
|---|---|---|
| Khổ giấy | A4 (210mm × 297mm) | Bắt buộc |
| Hướng | Chiều dọc (Portrait) | Trừ khi có bảng biểu rộng |

---

## 2. Định Lề Trang (python-docx: Cm)

| Lề | Khoảng cách | python-docx |
|---|---|---|
| Lề trên | 20–25 mm | `Cm(2.0)` đến `Cm(2.5)` |
| Lề dưới | 20–25 mm | `Cm(2.0)` đến `Cm(2.5)` |
| Lề trái | 30–35 mm | `Cm(3.0)` đến `Cm(3.5)` |
| Lề phải | 15–20 mm | `Cm(1.5)` đến `Cm(2.0)` |

**Chuẩn áp dụng trong legalkit-vn:**
```python
section.top_margin    = Cm(2.0)
section.bottom_margin = Cm(2.0)
section.left_margin   = Cm(3.0)
section.right_margin  = Cm(2.0)
```

---

## 3. Phông Chữ & Cỡ Chữ

| Yếu tố | Phông | Cỡ | Kiểu | Căn lề |
|---|---|---|---|---|
| **Quốc hiệu** (CỘNG HÒA...) | Times New Roman | 12–13 | Đứng, **Đậm**, Hoa | Phải |
| **Tiêu ngữ** (Độc lập - Tự do...) | Times New Roman | 13–14 | Đứng, **Đậm**, Thường | Phải (căn giữa dưới QH) |
| **Địa danh, ngày tháng năm** | Times New Roman | 13 | Nghiêng | Phải |
| **Tên loại văn bản** (HỢP ĐỒNG LAO ĐỘNG) | Times New Roman | 14 | Đứng, **Đậm**, Hoa | Giữa |
| **Số, ký hiệu** (Số: .../HĐLĐ) | Times New Roman | 13 | Đứng, thường | Giữa |
| **Nội dung** (thân văn bản) | Times New Roman | 13 | Đứng, thường | Hai bên (Justify) |
| **Tiêu đề điều khoản** (Điều 1. CÔNG VIỆC) | Times New Roman | 13 | Đứng, **Đậm** | Trái |
| **Chức vụ ký** (GIÁM ĐỐC) | Times New Roman | 13 | Đứng, **Đậm**, Hoa | Giữa khối ký |
| **Họ tên ký** | Times New Roman | 13 | Đứng, **Đậm** | Giữa khối ký |
| **Số trang** | Times New Roman | 13–14 | Đứng | Giữa, lề trên |

---

## 4. Cấu Trúc Văn Bản Chuẩn (Layout)

```
┌─────────────────────────────────────────────────┐
│ [Trắng hoặc logo bên trái nếu có]               │
│                                CỘNG HÒA XÃ HỘI  │ ← Phải, 12-13pt, Đậm, Hoa
│                           CHỦ NGHĨA VIỆT NAM    │
│                       Độc lập - Tự do - Hạnh phúc│ ← Phải, 13-14pt, Đậm, gạch dưới
│                       ─────────────────────────  │
│                                                  │
│  Số: .../HĐLĐ                                   │ ← Trái, 13pt
│                   TP. HCM, ngày 21 tháng 07 năm 2026│ ← Phải, nghiêng
│                                                  │
│              HỢP ĐỒNG LAO ĐỘNG                  │ ← Giữa, 14pt, Đậm, Hoa
│                   Số: .../HĐLĐ-TNHMD            │ ← Giữa, 13pt (nếu có)
│                                                  │
│  Căn cứ Bộ luật Lao động 2019...                │ ← Justify, 13pt
│  Căn cứ ...                                     │
│                                                  │
│  Điều 1. CÔNG VIỆC ĐƯỢC GIAO                    │ ← Đậm, 13pt
│  1. Bên A giao cho Bên B...                     │ ← Justify, 13pt
│                                                  │
│  [tiếp tục các điều khoản]                      │
│                                                  │
│  BÊN A                          BÊN B           │ ← 2 cột, Đậm
│  (Người sử dụng lao động)   (Người lao động)    │ ← Nghiêng
│                                                  │
│  GIÁM ĐỐC                                       │ ← Đậm, Hoa
│  [chữ ký]                                       │
│                                                  │
│  Đỗ Tấn Minh                   Võ Hằng          │ ← Đậm
└─────────────────────────────────────────────────┘
```

---

## 5. Giãn Dòng & Khoảng Cách

| Vị trí | Quy định | python-docx |
|---|---|---|
| Thân văn bản | Cách dòng đơn (1.15–1.5) | `line_spacing=Pt(18)` hoặc `1.15` |
| Sau đoạn văn | 6–8 pt | `space_after=Pt(6)` |
| Sau tiêu đề Điều | 3–6 pt | `space_after=Pt(3)` |
| Trước tiêu đề Điều | 6–12 pt | `space_before=Pt(12)` |

---

## 6. Quy Tắc Viết Tiêu Đề Điều Khoản

Theo thông lệ hợp đồng chuẩn (áp dụng cùng NĐ 30):

```
Điều 1. TÊN ĐIỀU KHOẢN
1. Nội dung khoản 1.
2. Nội dung khoản 2.
   a) Tiểu mục a
   b) Tiểu mục b
```

- "Điều X." — đậm, in thường với chữ hoa đầu, phần tên điều khoản viết HOA
- Khoản dùng số Ả Rập, tiểu mục dùng chữ thường kèm dấu ngoặc đơn

---

## 7. Khối Ký (Signature Block)

Dùng bảng 2 cột không viền:

| Bên A (trái) | Bên B (phải) |
|---|---|
| BÊN A (Đậm, Hoa, căn giữa) | BÊN B (Đậm, Hoa, căn giữa) |
| (Người sử dụng lao động) (Nghiêng) | (Người lao động) (Nghiêng) |
| [Ngày ký — nghiêng] | [Ngày ký — nghiêng] |
| GIÁM ĐỐC (Đậm, Hoa) | |
| [3 dòng trống cho chữ ký] | [3 dòng trống] |
| Đỗ Tấn Minh (Đậm) | Võ Hằng (Đậm) |

---

## 8. Số Trang

- Đánh số từ trang 2 trở đi (trang 1 không hiển thị)
- Vị trí: Header, căn giữa
- Font: Times New Roman, 13pt, đứng

---

## Tham khảo SOT

- Nghị định 30/2020/NĐ-CP — Điều 8 (thể thức văn bản), Phụ lục I
- Tọa độ: [NĐ 30/2020/NĐ-CP — Phụ lục I, Mục I (Khổ giấy, định lề), Mục III (Phông chữ), Mục IV (Từng yếu tố thể thức)]
- Trạng thái: Còn hiệu lực 07/2026
