# Schema Hợp Đồng — `legalkit-vn`

> **Mục đích:** Định nghĩa chuẩn dữ liệu (schema) cho mỗi loại hợp đồng trong `templates/contracts/*.json`. Engine đọc đúng schema này mới render được form và hợp đồng.

---

## Cấu trúc tổng thể

```jsonc
{
  // --- METADATA ---
  "id": "vay_tien",                    // slug không dấu, duy nhất trong hệ thống
  "name": "Hợp đồng vay tiền",         // tên hiển thị trong danh sách
  "title": "HỢP ĐỒNG VAY TÀI SẢN",    // tiêu đề in hoa trong văn bản HĐ
  "group": "Cá nhân ↔ Cá nhân",       // nhóm quan hệ (gom nhóm trên trang chủ)
  "icon": "💵",                         // emoji đại diện (không dùng file ảnh)
  "summary": "Mô tả ngắn khi nào dùng loại HĐ này",

  // --- CĂN CỨ PHÁP LÝ ---
  "legalBasis": [
    "Bộ luật Dân sự 2015 - Điều 463 (mô tả ngắn nội dung điều)"
  ],

  // --- CÁC BÊN ---
  "parties": {
    "a": "Bên cho vay",    // tên gọi Bên A trong HĐ
    "b": "Bên vay"         // tên gọi Bên B trong HĐ
  },

  // --- LỜI MỞ ĐẦU ---
  "preamble": "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\n...\n{{dia_diem_lap}}, ngày {{ngay_lap}}",

  // --- BỘ CÂU HỎI (FIELDS) ---
  "fields": [ /* xem chi tiết bên dưới */ ],

  // --- RÀNG BUỘC LUẬT (LINT) ---
  "lint": [ /* xem chi tiết bên dưới */ ],

  // --- THÂN HỢP ĐỒNG (BODY) ---
  "body": [ /* xem chi tiết bên dưới */ ],

  // --- LỜI KẾT ---
  "closing": "Hợp đồng gồm 02 bản có giá trị như nhau...",

  // --- NHẬT KÝ KIỂM ĐỊNH (chỉ dành cho AI/developer, engine bỏ qua) ---
  "verifyNotes": ["Nguồn đã tra, lỗi đã sửa, cảnh báo còn lại"]
}
```

---

## Chi tiết: `fields` — Bộ câu hỏi

Mỗi phần tử trong `fields` là một câu hỏi thu thập thông tin từ người dùng.

```jsonc
{
  "key": "so_tien",          // khớp với {{so_tien}} trong preamble/body/closing
  "label": "Số tiền vay?",   // nhãn hiển thị trong form
  "section": "Nội dung vay", // nhóm câu hỏi (gom nhóm trong form)

  // TIER — Phân tầng điều khoản (xem bảng bên dưới)
  "tier": "required",        // required | default | optional

  // TYPE — Kiểu dữ liệu
  "type": "money",           // text | textarea | number | money | date | select | tel | email

  "help": "Giải thích ngắn dễ hiểu cho người dùng",
  "placeholder": "VD: 100,000,000",

  // Tùy chọn
  "legalRef": "Điều 463 BLDS",            // điều luật tham chiếu cho field này
  "defaultText": "nội dung mặc định...",   // BẮT BUỘC nếu tier = "default"
  "options": ["Có", "Không"],              // chỉ dùng khi type = "select"
  "condition": {                           // chỉ hiện field này khi field khác = giá trị
    "key": "co_lai",
    "equals": "Có"
  }
}
```

### Bảng phân tầng điều khoản

| Tier | Ý nghĩa | Hành vi khi để trống | Ví dụ |
|---|---|---|---|
| `required` | Bắt buộc — thiếu là hỏng HĐ | Block form, không cho in/lưu | Số tiền vay, tên các bên |
| `default` | Có mặc định của luật | In nội dung `defaultText` vào HĐ, kèm điều luật | Lãi suất (mặc định 0% nếu không thỏa thuận) |
| `optional` | Tùy chọn | Bỏ qua điều khoản/field đó | Điều khoản phạt vi phạm |

---

## Chi tiết: `lint` — Ràng buộc pháp lý

```jsonc
{
  "field": "lai_suat",                         // field cần kiểm tra
  "op": "max",                                 // max | min | note
  "value": 20,                                 // ngưỡng so sánh (với max/min)
  "message": "Vượt trần lãi suất 20%/năm",    // thông báo cảnh báo
  "legalRef": "Điều 468 BLDS 2015",           // căn cứ pháp lý
  "severity": "error"                          // error | warning
}
```

**Các operator:**
- `max`: cảnh báo khi giá trị > value
- `min`: cảnh báo khi giá trị < value
- `note`: luôn hiển thị nhắc nhở (cho ràng buộc phức tạp/chéo trường)

**Severity:**
- `error`: Ngăn xuất HĐ
- `warning`: Cảnh báo nhưng vẫn cho xuất

---

## Chi tiết: `body` — Thân hợp đồng

```jsonc
[
  {
    "heading": "ĐIỀU 1: SỐ TIỀN VAY",
    "text": "Bên A đồng ý cho Bên B vay số tiền là {{so_tien}} (bằng chữ: {{so_tien_bang_chu}}).",
    // "condition": optional — điều khoản có điều kiện
    "condition": {
      "key": "co_lai",
      "equals": "Có"
    }
  }
]
```

**Quy tắc bắt buộc:** Mọi `{{key}}` trong `preamble`/`body`/`closing` phải có `field.key` tương ứng trong `fields[]`.

---

## Danh mục 10 hợp đồng hiện có

| File | ID | Tên | Nhóm |
|---|---|---|---|
| `hop-dong-lao-dong.json` | `lao_dong` | Hợp đồng lao động | NSDLĐ ↔ NLĐ |
| `hop-dong-thue-nha.json` | `thue_nha` | Hợp đồng thuê nhà ở | Cá nhân ↔ Cá nhân |
| `hop-dong-vay-tien.json` | `vay_tien` | Hợp đồng vay tài sản | Cá nhân ↔ Cá nhân |
| `hop-dong-dich-vu.json` | `dich_vu` | Hợp đồng dịch vụ | Tổ chức ↔ Cá nhân |
| `mua-ban-hh.json` | `mua_ban_hh` | Hợp đồng mua bán hàng hóa | Tổ chức ↔ Tổ chức |
| `hop-dong-dat-coc.json` | `dat_coc` | Hợp đồng đặt cọc | Cá nhân ↔ Cá nhân |
| `hop-dong-ctv.json` | `ctv` | Hợp đồng cộng tác viên/khoán việc | Tổ chức ↔ Cá nhân |
| `nda.json` | `nda` | Thỏa thuận bảo mật (NDA) | Mọi quan hệ |
| `hop-dong-nguyen-tac.json` | `nguyen_tac` | Hợp đồng nguyên tắc | Tổ chức ↔ Tổ chức |
| `uy-quyen.json` | `uy_quyen` | Hợp đồng ủy quyền | Mọi quan hệ |

---

## Hướng dẫn thêm hợp đồng mới

1. Tạo file `templates/contracts/[ten-hop-dong].json`
2. Tuân thủ schema trên (bắt buộc: id, name, title, group, legalBasis, parties, fields, body)
3. Chạy `scripts/sot_validator.py` để kiểm tra format
4. Cập nhật mục "Danh mục" trong file này
5. Thêm entry vào `resources/domains/07-hop-dong-catalog.md`
