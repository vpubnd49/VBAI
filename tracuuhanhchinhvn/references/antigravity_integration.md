# Tích hợp vào Antigravity / agent application

Skill được thiết kế theo cấu trúc thư mục chuẩn với `SKILL.md` làm entrypoint. Phần tích hợp không phụ thuộc framework cụ thể.

## Cách dùng tối thiểu

1. Cho agent quyền đọc toàn bộ thư mục skill.
2. Nạp `SKILL.md` làm instruction của capability tra cứu hành chính.
3. Khi có truy vấn dữ liệu, cho agent chạy:
   `python scripts/lookup.py --query "<text>" [--domain <domain>]`.
4. Parse JSON stdout và trả về API/app theo `references/data_model.md`.
5. Với câu hỏi về “hiện hành/mới nhất”, nối thêm connector pháp luật chính thức nếu ứng dụng có.

## Domain hỗ trợ

- `lam_dong_organization`
- `geography`
- `metrics`
- `legal_sources`
- `admin_profile`
- `all`

## Ví dụ wrapper HTTP

App có thể ánh xạ request:

```json
{
  "query": "Sở Giao thông vận tải Lâm Đồng còn dùng không?",
  "domain": "lam_dong_organization",
  "as_of": "2025-12-01"
}
```

sang lệnh:

```bash
python scripts/lookup.py --query "Sở Giao thông vận tải Lâm Đồng còn dùng không?" --domain lam_dong_organization
```

Sau đó app bổ sung `as_of`, gọi logic freshness trong `SKILL.md`, và trả JSON kết quả.

## Quy tắc production

- Không cache vô thời hạn dữ liệu biến động.
- Gắn version/hash cho các file trong `references/`.
- Log `source_id` cùng câu trả lời để audit.
- Không cho LLM tự sinh số văn bản khi script không tìm thấy.
- Nếu kết quả `not_found` hoặc `needs_freshness_check`, chuyển sang nguồn chính thức/connector thay vì đoán.
