# Tích hợp vào Antigravity / agent application

Skill này theo cấu trúc thư mục tương thích với Antigravity-style agent workspace.

## Cài đặt

Copy thư mục:

```text
ra-soat-van-ban-hanh-chinh-vn/
```

vào:

```text
<workspace>/.agents/skills/
```

Kết quả:

```text
<workspace>/.agents/skills/ra-soat-van-ban-hanh-chinh-vn/SKILL.md
```

## Cấu trúc

```text
ra-soat-van-ban-hanh-chinh-vn/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── review.py
└── references/
    ├── antigravity_integration.md
    ├── data_model.md
    ├── review_workflow.md
    ├── source_policy.md
    ├── nd30_checklist.md
    ├── common_error_patterns.md
    ├── review_profile.json
    └── usage_examples.md
```

## Luồng tích hợp khuyến nghị

1. Agent nhận file/text.
2. Xác định vai trò hồ sơ.
3. Chạy `scripts/review.py` để phát hiện tín hiệu cơ học.
4. LLM đọc `SKILL.md` + các reference cần thiết.
5. Nếu cần xác minh căn cứ hiện hành, gọi connector pháp luật chính thức/web.
6. Nếu sửa DOCX, chuyển sang mô-đun DOCX/NĐ30 của app.
7. Trả JSON theo `references/data_model.md`.

## Ví dụ command

```bash
python scripts/review.py --file "du-thao.docx"
python scripts/review.py --file "gop-y.docx" --file "tiep-thu.docx" --file "du-thao.docx"
python scripts/review.py --text "Giao Sở Tư pháp định kỳ tổng hợp..."
```

## Production notes

- Không dùng kết quả script như kết luận cuối; script chỉ là preflight.
- Log tên file, hash, ngày rà soát và nguồn được dùng.
- Không cache vô thời hạn thông tin pháp lý biến động.
- Nếu thiếu văn bản gốc, trả `verify`, không tự thay số hiệu.
- Khi sửa DOCX/PDF, nên có bước render để QA bố cục.
