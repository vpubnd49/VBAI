---
name: tra-cuu-hanh-chinh-vn
description: Tra cứu và chuẩn hóa dữ liệu hành chính - pháp lý Việt Nam từ nguồn có cấu trúc, đặc biệt cho địa giới 34 tỉnh/thành, cơ cấu 6 Sở mới của tỉnh Lâm Đồng năm 2025, căn cứ NĐ30/NQ60, và các snapshot chỉ số CCHC. Dùng khi người dùng hỏi tên cơ quan cũ/mới, đơn vị hành chính sau sắp xếp, số/ký hiệu căn cứ, mốc áp dụng, thẩm quyền/ngữ cảnh soạn thảo, PAR Index/SIPAS/PAPI/PCI/Bộ chỉ số 766, hoặc yêu cầu kiểm tra một đoạn văn theo dữ liệu nguồn. Phù hợp cho agent/app cần đầu ra có cấu trúc, truy vết nguồn và cảnh báo dữ liệu cũ.
---

# Tra cứu hành chính Việt Nam

## Mục tiêu

Trả dữ liệu có cấu trúc, truy vết được nguồn và tách rõ dữ liệu lịch sử với dữ liệu cần kiểm tra độ mới. Không suy diễn căn cứ pháp lý không có trong nguồn.

## Luồng xử lý

1. Xác định ý định: `lookup_entity`, `lookup_legal_basis`, `lookup_metric`, `validate_text`, `compare_before_after` hoặc `draft_context`.
2. Xác định mốc thời gian người dùng hỏi. Nếu không nêu mốc, giữ `as_of=null`; không tự biến snapshot thành “hiện hành”.
3. Chọn miền dữ liệu:
   - cơ cấu Lâm Đồng → `references/lam_dong_organization.json`;
   - địa giới 34 tỉnh/thành → `references/geography_34.json` (truy vết về `references/dia_gioi_34.csv`);
   - chỉ số CCHC → `references/cchc_snapshot_2025.json`;
   - profile thể thức/ngữ cảnh NĐ30-NQ60 → `references/admin_document_profile.json`;
   - quy tắc dữ liệu và thời gian → `references/data_model.md`;
   - chính sách nguồn/độ mới → `references/source_policy.md`.
4. Với tra cứu exact/fuzzy, ưu tiên chạy `scripts/lookup.py`.
5. Đối chiếu kết quả với mốc thời gian, loại nguồn và phạm vi áp dụng.
6. Trả kết quả theo hợp đồng trong `references/data_model.md`, kèm nguồn và cảnh báo.

## Quy tắc bắt buộc

- Giữ nguyên tên cơ quan/văn bản như nguồn khi trích dẫn.
- Không đồng nhất `resolution_effective_from` với `organization_operational_from`.
- Với 6 Sở Lâm Đồng theo Nghị quyết 390-395/NQ-HĐND: nghị quyết ghi ngày 18/02/2025; các Sở đi vào hoạt động từ 01/03/2025.
- Khi gặp tên Sở cũ trong văn bản có mốc từ 01/03/2025 trở đi, cảnh báo và đề xuất tên mới nếu mapping rõ. Cho phép tên cũ khi ngữ cảnh ghi rõ “trước sắp xếp”, “(cũ)” hoặc nói về sự kiện lịch sử.
- Với chức năng quản lý nhà nước về tôn giáo, dùng mapping của `395/NQ-HĐND`: Sở Dân tộc và Tôn giáo tiếp nhận chức năng, nhiệm vụ và tổ chức bộ máy quản lý nhà nước về tôn giáo từ Sở Nội vụ.
- Với địa giới, trả cả tên mới và nguyên văn dòng nguồn. Nếu người dùng cần xác nhận hiệu lực pháp lý hiện tại, yêu cầu nguồn pháp lý gốc/connector hiện hành thay vì chỉ dựa CSV snapshot.
- Với PAR Index/SIPAS/PAPI/PCI/Bộ chỉ số 766 và các tỷ lệ CCHC, luôn nêu kỳ và ngày chốt dữ liệu.
- Nếu câu hỏi chứa “hiện nay”, “mới nhất”, “đang có hiệu lực”, “đang áp dụng” nhưng nguồn đóng gói không đủ mới, trả `needs_freshness_check` và không khẳng định hiện trạng.
- Không tạo số văn bản, ngày, điều/khoản, chức danh hoặc số liệu không có trong nguồn.
- Nếu nguồn mâu thuẫn, trả `conflict`; mô tả khác biệt trước khi đề xuất kiểm tra nguồn có thẩm quyền hơn.

## Trả context cho mô-đun soạn thảo

Khi `intent=draft_context`, không cần viết toàn bộ văn bản nếu người dùng chỉ cần dữ liệu. Trả tối thiểu:
- tên cơ quan chuẩn;
- mapping cũ → mới;
- căn cứ và mốc thời gian;
- cảnh báo dùng tên cũ;
- trường chuyển tiếp cần có: nhiệm vụ, hồ sơ tồn, tài sản/tài chính, nhân sự, đơn vị tiếp nhận, thời điểm bàn giao.

Nếu yêu cầu tạo văn bản hành chính hoàn chỉnh, chuyển context này cho mô-đun soạn thảo/định dạng NĐ30 của ứng dụng.

## Dùng script tra cứu

```bash
python scripts/lookup.py --query "Sở Giao thông vận tải Lâm Đồng"
python scripts/lookup.py --query "Bình Thuận" --domain geography
python scripts/lookup.py --query "hồ sơ trực tuyến toàn trình" --domain metrics
```

Đọc `references/usage_examples.md` khi cần mẫu đầu vào/đầu ra. Đọc `references/source_index.json` khi cần xác định provenance của dataset. Đọc `references/antigravity_integration.md` khi triển khai skill vào agent/app.

## Hợp đồng tích hợp ứng dụng

Ưu tiên JSON có các trường: `status`, `answer`, `canonical_name`/`metric`, `effective_context`, `sources`, `warnings`. Xem định nghĩa chính xác trong `references/data_model.md`.

Connector không bắt buộc. Nếu ứng dụng có connector tra cứu pháp luật chính thức, dùng connector đó cho mọi yêu cầu cần xác nhận tình trạng hiện hành; sau đó đối chiếu kết quả với snapshot đóng gói.
