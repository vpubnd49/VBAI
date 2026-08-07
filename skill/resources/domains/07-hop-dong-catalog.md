# Catalog Hợp Đồng — Module 07

> **Mục đích:** Danh mục nhận diện keyword để Agent chọn đúng template hợp đồng trong Draft Mode. Load file này khi user yêu cầu soạn thảo hợp đồng.

---

## Bảng Nhận Diện Keyword

| Template File | Tên HĐ | Keyword nhận diện |
|---|---|---|
| `hop-dong-lao-dong.json` | Hợp đồng lao động | lao động, tuyển dụng, nhân viên, thử việc, sa thải, ký hợp đồng làm việc, HĐLĐ, NLĐ, NSDLĐ |
| `hop-dong-thue-nha.json` | Hợp đồng thuê nhà ở | thuê nhà, thuê phòng, cho thuê, tiền thuê, hợp đồng thuê, landlord, tenant |
| `hop-dong-vay-tien.json` | Hợp đồng vay tài sản | vay tiền, cho vay, vay mượn, lãi suất, nợ, khế ước |
| `hop-dong-dich-vu.json` | Hợp đồng dịch vụ | dịch vụ, outsource, thuê ngoài, cung cấp dịch vụ, hợp đồng dịch vụ, tư vấn, freelance |
| `mua-ban-hh.json` | Hợp đồng mua bán hàng hóa | mua bán, hàng hóa, giao hàng, thanh toán, đơn hàng, purchase order |
| `hop-dong-dat-coc.json` | Hợp đồng đặt cọc | đặt cọc, cọc, deposit, giữ chỗ, phạt cọc |
| `hop-dong-ctv.json` | Hợp đồng cộng tác viên | cộng tác viên, CTV, khoán việc, freelancer, theo dự án, công việc cụ thể |
| `nda.json` | Thỏa thuận bảo mật (NDA) | bảo mật, NDA, không tiết lộ, confidential, bí mật kinh doanh |
| `hop-dong-nguyen-tac.json` | Hợp đồng nguyên tắc | hợp tác nguyên tắc, khung hợp tác, master agreement, hợp đồng khung |
| `uy-quyen.json` | Hợp đồng ủy quyền | ủy quyền, thay mặt, đại diện, giấy ủy quyền, power of attorney |
| `hop-dong-hop-tac-kinh-doanh.json` | Hợp đồng hợp tác kinh doanh (BCC) | hợp tác kinh doanh, BCC, liên doanh liên kết, liên danh, hợp tác đầu tư không thành lập pháp nhân |
| `hop-dong-gop-von.json` | Hợp đồng góp vốn thành lập doanh nghiệp | góp vốn, thành lập công ty, thành lập doanh nghiệp, vốn điều lệ, tài sản góp vốn |
| `hop-dong-chuyen-nhuong-dat-dai.json` | Hợp đồng chuyển nhượng quyền sử dụng đất | bán đất, chuyển nhượng đất, sổ đỏ, sổ hồng, sang tên nhà đất, chuyển nhượng quyền sử dụng đất |
| `hop-dong-thue-van-phong.json` | Hợp đồng thuê văn phòng / mặt bằng | thuê văn phòng, thuê mặt bằng, thuê cửa hàng, thuê kiot, thương mại |
| `hop-dong-gia-cong.json` | Hợp đồng gia công thương mại | gia công, nhận gia công, đặt gia công, nguyên vật liệu gia công, gia công may mặc |
| `hop-dong-thiet-ke-phan-mem.json` | Hợp đồng phát triển / thiết kế phần mềm | thiết kế phần mềm, viết ứng dụng, code app, lập trình, outsource IT, thiết kế website, chuyển giao mã nguồn |
| `hop-dong-dai-ly.json` | Hợp đồng đại lý thương mại | đại lý, bên giao đại lý, thù lao đại lý, hoa hồng đại lý, phân phối độc quyền |
| `thoa-thuan-co-dong.json` | Thỏa thuận cổ đông sáng lập | cổ đông sáng lập, thoái vốn, hạn chế chuyển nhượng, bế tắc biểu quyết, sở hữu cổ phần |
| `hop-dong-bao-lanh.json` | Hợp đồng bảo lãnh thực hiện nghĩa vụ | bảo lãnh, bên bảo lãnh, thực hiện nghĩa vụ thay, bảo lãnh thanh toán |
| `hop-dong-tang-cho.json` | Hợp đồng tặng cho tài sản / đất đai | tặng cho, tặng đất, cho đất, tặng tài sản, tặng cho có điều kiện, cho không |

---

## Nhóm quan hệ

| Nhóm | Các HĐ thuộc nhóm |
|---|---|
| **Cá nhân ↔ Cá nhân** | Vay tiền, Thuê nhà, Đặt cọc, Tặng cho |
| **Tổ chức ↔ Cá nhân** | Lao động, Dịch vụ, Cộng tác viên, Góp vốn, Thiết kế phần mềm, Bảo lãnh |
| **Tổ chức ↔ Tổ chức** | Mua bán hàng hóa, Nguyên tắc, Hợp tác kinh doanh (BCC), Thuê văn phòng, Gia công, Đại lý, Thỏa thuận cổ đông |
| **Mọi quan hệ** | NDA, Ủy quyền, Chuyển nhượng đất đai |
