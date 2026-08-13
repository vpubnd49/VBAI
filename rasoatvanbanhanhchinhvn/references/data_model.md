# Mô hình dữ liệu rà soát văn bản

## 1. Ý định đầu vào

- `quick_review`
- `full_review`
- `cross_document_review`
- `nd30_review`
- `edit_docx`
- `pre_signing_check`

## 2. Hợp đồng truy vấn

Ứng dụng có thể truyền JSON:

```json
{
  "intent": "cross_document_review",
  "files": [
    {"path": "source.pdf", "role": "source_superior"},
    {"path": "comment.docx", "role": "comment"},
    {"path": "response.docx", "role": "response_matrix"},
    {"path": "draft.docx", "role": "draft"}
  ],
  "as_of": "2026-08-13",
  "need_nd30": true,
  "need_edit": false
}
```

`role` có thể để trống nếu agent tự xác định được.

## 3. Hợp đồng kết quả

```json
{
  "status": "needs_revision",
  "signing_readiness": "not_ready",
  "summary": "Có 2 lỗi bắt buộc sửa và 1 nội dung cần xác minh.",
  "issues": [
    {
      "severity": "must_fix",
      "category": "reporting_logic",
      "location": "Mục 3, gạch đầu dòng 3",
      "current_text": "...",
      "problem": "Giao tổng hợp báo cáo nhưng không xác định nguồn dữ liệu.",
      "proposed_text": "...",
      "source_basis": ["Công văn ..."]
    }
  ],
  "task_flow": {
    "lead": "Sở Tư pháp",
    "coordination": [],
    "product": "Báo cáo",
    "deadline": null,
    "recipient": "UBND tỉnh",
    "data_source": "Chế độ báo cáo hiện hành + cung cấp bổ sung",
    "warnings": []
  },
  "format_review": {
    "status": "reviewed",
    "visual_check": true,
    "issues": []
  },
  "sources": [],
  "warnings": []
}
```

## 4. Giá trị chuẩn

### `status`
- `clean`
- `needs_revision`
- `needs_verification`
- `insufficient_source`

### `signing_readiness`
- `ready`
- `ready_after_minor_edit`
- `not_ready`

### `severity`
- `must_fix`
- `verify`
- `should_fix`
- `editorial`

### `category`
- `citation`
- `chronology`
- `spelling`
- `grammar`
- `punctuation`
- `terminology`
- `task_assignment`
- `reporting_logic`
- `authority`
- `cross_document`
- `nd30_format`
- `layout`

## 5. Quy tắc

- `must_fix` phải có căn cứ chắc chắn.
- `verify` dùng khi có nghi vấn nhưng thiếu nguồn.
- Không chuyển `verify` thành `must_fix` chỉ bằng suy luận.
- Nếu chưa xem trang thực tế, `format_review.visual_check=false`.
