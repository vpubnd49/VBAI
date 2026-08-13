# Mô hình dữ liệu tra cứu

## 1. Ý định đầu vào

Chuẩn hóa yêu cầu người dùng thành một trong các loại:

- `lookup_entity`: tra tên cơ quan, địa danh, đơn vị cũ/mới.
- `lookup_legal_basis`: tra số/ký hiệu, ngày, nội dung căn cứ.
- `lookup_metric`: tra chỉ số CCHC hoặc số liệu theo mốc.
- `validate_text`: kiểm tra tên cơ quan, địa danh, mốc thời gian trong đoạn văn.
- `compare_before_after`: đối chiếu cơ cấu trước/sau sắp xếp.
- `draft_context`: trả dữ liệu nền để một mô-đun khác soạn văn bản.

## 2. Hợp đồng truy vấn

Ứng dụng nên truyền JSON tương đương:

```json
{
  "query": "Sở Giao thông vận tải Lâm Đồng còn dùng không?",
  "intent": "lookup_entity",
  "domain": "lam_dong_organization",
  "as_of": "2025-12-01",
  "need_citations": true
}
```

`intent`, `domain`, `as_of` có thể bỏ trống; agent phải suy ra nếu đủ rõ.

## 3. Hợp đồng kết quả

Luôn trả cấu trúc tương đương:

```json
{
  "status": "found",
  "answer": "Từ 01/03/2025, dùng tên Sở Xây dựng tỉnh Lâm Đồng cho cơ quan mới sau hợp nhất.",
  "canonical_name": "Sở Xây dựng tỉnh Lâm Đồng",
  "effective_context": {
    "resolution_date": "2025-02-18",
    "resolution_effective_from": "2025-02-18",
    "organization_operational_from": "2025-03-01"
  },
  "sources": [
    {"number": "393/NQ-HĐND", "date": "2025-02-18"}
  ],
  "warnings": []
}
```

Giá trị `status`: `found`, `not_found`, `ambiguous`, `needs_freshness_check`, `conflict`.

## 4. Trường bắt buộc theo miền

### Cơ cấu tổ chức
- `canonical_name`
- `old_entities`
- `change_type`
- `resolution_number`
- `resolution_date`
- `resolution_effective_from`
- `organization_operational_from`

### Địa giới
- `canonical_name`
- `former_entities`
- `administrative_center` nếu nguồn có
- `source_text`
- `as_of` hoặc mốc áp dụng nếu biết

### Chỉ số
- `metric`
- `value`
- `unit`
- `period`
- `as_of`
- `rank` nếu có
- `target` nếu có

## 5. Quy tắc thời gian

Không đồng nhất các khái niệm:
1. ngày ban hành/thông qua văn bản;
2. ngày văn bản có hiệu lực;
3. ngày cơ quan bắt đầu hoạt động;
4. ngày chốt dữ liệu báo cáo.

Nếu câu hỏi chứa “hiện nay”, “mới nhất”, “đang áp dụng”, phải kiểm tra độ mới nguồn trước khi kết luận.
