# Ví dụ gọi Skill

## 1. Tên Sở cũ

**Input:** “Sở Giao thông vận tải Lâm Đồng còn dùng trong văn bản tháng 12/2025 không?”

**Output cốt lõi:** `found`; canonical name = `Sở Xây dựng tỉnh Lâm Đồng`; căn cứ `393/NQ-HĐND`; cơ quan mới hoạt động từ `2025-03-01`. Cảnh báo nếu văn bản vẫn dùng tên cũ mà không ghi ngữ cảnh “trước sắp xếp”.

## 2. Chức năng tôn giáo

**Input:** “Nhiệm vụ quản lý nhà nước về tôn giáo thuộc đâu sau sắp xếp?”

**Output cốt lõi:** `Sở Dân tộc và Tôn giáo tỉnh Lâm Đồng`; căn cứ `395/NQ-HĐND`; nêu đây là chức năng được tiếp nhận từ Sở Nội vụ.

## 3. Địa giới

**Input:** “Bình Thuận sau sắp xếp thuộc tỉnh nào?”

**Output cốt lõi:** tra `references/dia_gioi_34.csv`; trả tỉnh Lâm Đồng theo dòng hợp nhất Lâm Đồng + Đắk Nông + Bình Thuận; kèm nguyên văn nguồn và cảnh báo kiểm tra văn bản pháp lý gốc nếu người dùng cần xác nhận hiệu lực.

## 4. Số liệu CCHC

**Input:** “Tỷ lệ hồ sơ trực tuyến toàn trình của Lâm Đồng là bao nhiêu?”

**Output cốt lõi:** `51,79%`, mốc dữ liệu `2025-11-27`. Nếu người dùng hỏi “hiện nay” mà không có nguồn mới hơn thì `needs_freshness_check`.

## 5. Context cho mô-đun soạn thảo

**Input:** “Trả context để soạn quyết định bàn giao từ Sở GTVT sang Sở Xây dựng.”

**Output cốt lõi:** mapping cũ→mới, NQ 393/NQ-HĐND, mốc hoạt động 01/03/2025, và danh sách trường cần bổ sung: hồ sơ chuyển tiếp, tài sản, nhân sự, đơn vị chịu trách nhiệm, thời điểm tiếp nhận.
