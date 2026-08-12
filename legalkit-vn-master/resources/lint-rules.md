# Thư Viện Ràng Buộc Pháp Lý (Lint Rules)

> **Mục đích:** Tổng hợp các ràng buộc pháp lý (giới hạn luật định) theo lĩnh vực, dùng để validate trong Draft Mode và tham chiếu khi xây dựng contract template mới.

---

## 1. Dân sự — Hợp đồng vay tiền

| Ràng buộc | Giá trị | Căn cứ pháp lý | Severity |
|---|---|---|---|
| Lãi suất cho vay tối đa | 20%/năm | BLDS 2015, Điều 468, Khoản 1 | error |
| Lãi suất mặc định khi không thỏa thuận rõ | 0% | BLDS 2015, Điều 463 | note |
| Lãi suất khi thỏa thuận "có lãi" nhưng không ghi rõ mức | 10%/năm | BLDS 2015, Điều 468, Khoản 2 | note |
| Lãi chậm trả = lãi suất thỏa thuận x 150% | tối đa 30%/năm | BLDS 2015, Điều 466, Khoản 5 | warning |

---

## 2. Lao động

| Ràng buộc | Giá trị | Căn cứ pháp lý | Severity |
|---|---|---|---|
| Thời gian thử việc tối đa — Quản lý | 180 ngày (6 tháng) | BLLĐ 2019, Điều 25, Khoản 1, Điểm a | error |
| Thời gian thử việc tối đa — Chuyên môn kỹ thuật cao | 60 ngày | BLLĐ 2019, Điều 25, Khoản 1, Điểm b | error |
| Thời gian thử việc tối đa — Trung cấp/công nhân kỹ thuật | 30 ngày | BLLĐ 2019, Điều 25, Khoản 1, Điểm c | error |
| Thời gian thử việc tối đa — Lao động khác | 6 ngày | BLLĐ 2019, Điều 25, Khoản 1, Điểm d | error |
| Lương thử việc tối thiểu | 85% lương chính thức | BLLĐ 2019, Điều 26, Khoản 3 | error |
| Thời gian báo trước nghỉ việc — HĐ xác định thời hạn ≥ 12 tháng | 30 ngày | BLLĐ 2019, Điều 35, Khoản 2, Điểm b | warning |
| Thời gian báo trước — HĐ xác định thời hạn < 12 tháng | 3 ngày | BLLĐ 2019, Điều 35, Khoản 2, Điểm c | warning |
| Thời gian báo trước — HĐ không xác định thời hạn | 45 ngày | BLLĐ 2019, Điều 35, Khoản 2, Điểm a | warning |
| Giờ làm thêm tối đa/ngày | 4 tiếng | BLLĐ 2019, Điều 107, Khoản 2 | error |
| Giờ làm thêm tối đa/tháng | 40 tiếng | BLLĐ 2019, Điều 107, Khoản 2 | error |
| Giờ làm thêm tối đa/năm | 300 tiếng (trường hợp đặc biệt) | BLLĐ 2019, Điều 107, Khoản 3 | warning |
| Mức phạt vi phạm kỷ luật tối đa | không được dùng phạt tiền | BLLĐ 2019, Điều 127 | note |

---

## 3. Dân sự — Hợp đồng thuê nhà

| Ràng buộc | Giá trị | Căn cứ pháp lý | Severity |
|---|---|---|---|
| Tiền đặt cọc tối đa | Không có giới hạn luật (thị trường tự thỏa thuận) | BLDS 2015, Điều 328 | note |
| Thời hạn báo trước khi chấm dứt HĐ (nếu không có thỏa thuận) | 3 tháng | Luật Nhà ở 2023, Điều 31 | warning |
| Tăng giá thuê phải báo trước | 3 tháng | Luật Nhà ở 2023, Điều 31 | warning |

---

## 4. Dân sự — Hợp đồng dịch vụ / Mua bán

| Ràng buộc | Giá trị | Căn cứ pháp lý | Severity |
|---|---|---|---|
| Phạt vi phạm hợp đồng dịch vụ tối đa | 8% phần nghĩa vụ vi phạm | Luật Thương mại 2005, Điều 301 | error |
| Bồi thường thiệt hại + phạt ≤ | Không được vượt phần nghĩa vụ vi phạm x 1 | Luật Thương mại 2005, Điều 307 | warning |
| Thời hiệu khởi kiện hợp đồng thương mại | 2 năm kể từ thời điểm quyền khởi kiện phát sinh | Luật Thương mại 2005, Điều 319 | note |
| Thời hiệu khởi kiện hợp đồng dân sự | 3 năm | BLDS 2015, Điều 429 | note |

---

## 5. Đặt cọc

| Ràng buộc | Giá trị | Căn cứ pháp lý | Severity |
|---|---|---|---|
| Phạt cọc khi bên đặt cọc vi phạm | Mất tiền cọc | BLDS 2015, Điều 328, Khoản 2 | note |
| Phạt cọc khi bên nhận cọc vi phạm | Trả lại cọc + thêm một khoản tương đương | BLDS 2015, Điều 328, Khoản 2 | note |

---

## 6. Bảo mật thông tin (NDA)

| Ràng buộc | Giá trị | Căn cứ pháp lý | Severity |
|---|---|---|---|
| Thời hạn bảo mật vô thời hạn — khuyến nghị có thời hạn cụ thể | Không giới hạn pháp lý, nhưng tòa có thể xem xét hợp lý | BLDS 2015, Điều 3 (nguyên tắc tự do hợp đồng) | note |
| Phạt vi phạm NDA — tự thỏa thuận | Không giới hạn (HĐ dân sự) | BLDS 2015, Điều 328-329 | note |

---

## Cách dùng trong Draft Mode

Khi render hợp đồng, agent PHẢI:
1. Load lint rules của loại HĐ tương ứng
2. So sánh giá trị user nhập với các ràng buộc
3. Cảnh báo `error`: block xuất HĐ cho đến khi user sửa
4. Cảnh báo `warning`: hiển thị nhưng vẫn cho xuất
5. `note`: hiển thị trong phần Lưu ý của Report

---

## Cập nhật lint rules

Khi phát hiện VB mới sửa đổi giới hạn, phải:
1. Chạy `scripts/law_updater.py` để kiểm tra cập nhật
2. Sửa bảng tương ứng trong file này
3. Cập nhật `legalRef` với số hiệu VB mới
4. Ghi nhận vào `verifyNotes` của contract JSON liên quan
