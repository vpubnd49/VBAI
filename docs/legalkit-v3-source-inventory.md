# LegalKit V3 Source Inventory

**Nguồn tham chiếu gốc:** `legalkit-vn-master/`
**Ngày kiểm kê:** 07/08/2026
**Mục đích:** Thống kê 100% tài nguyên gốc thuộc bộ LegalKit v3 để làm căn cứ tích hợp vào dự án VBAI mà không làm ảnh hưởng đến các module hiện có.

---

## 1. Danh mục Tệp tin Root

| STT | Đường dẫn gốc | Mô tả / Chức năng | Trạng thái tích hợp |
|:---:|:---|:---|:---:|
| 1 | `legalkit-vn-master/SKILL.md` | Master Skill instructions LegalKit v3 (Modes A, B, C, D) | Đã hợp nhất vào `skill/SKILL.md` |
| 2 | `legalkit-vn-master/manifest.json` | Manifest tri thức LegalKit v3 | Đã nâng cấp vào `skill/manifest.json` |
| 3 | `legalkit-vn-master/README.md` | Tài liệu tổng quan bộ công cụ | Đã lưu vết kiểm kê |
| 4 | `legalkit-vn-master/LICENSE` | Giấy phép phần mềm | Đã lưu vết kiểm kê |
| 5 | `legalkit-vn-master/AGENTS.md` | Quy tắc vận hành Agent | Đã tham chiếu |
| 6 | `legalkit-vn-master/.gitignore` | Cấu hình git ignore | Đã kiểm tra |
| 7 | `legalkit-vn-master/skills.json` | Khai báo skill phụ | Đã tích hợp |

---

## 2. Tài nguyên Core (`resources/`)

| STT | Đường dẫn | Chức năng | Trạng thái |
|:---:|:---|:---|:---:|
| 1 | `resources/contract-schema.md` | Schema JSON chuẩn 3-tier hợp đồng | `skill/resources/contract-schema.md` |
| 2 | `resources/lint-rules.md` | Ràng buộc pháp lý realtime (lint rules) | `skill/resources/lint-rules.md` |
| 3 | `resources/monitored-laws.json` | Danh mục văn bản theo dõi hiệu lực | `skill/resources/monitored-laws.json` |
| 4 | `resources/nd30-format-standard.md` | Chuẩn thể thức NĐ 30/2020/NĐ-CP | `skill/resources/nd30-format-standard.md` |
| 5 | `resources/precedents-catalog.json` | Catalog án lệ TANDTC áp dụng | `skill/resources/precedents-catalog.json` |
| 6 | `resources/legal-system.md` | Khung thứ bậc & xử lý xung đột lex | `skill/resources/legal-system.md` |
| 7 | `resources/cross-reference-guide.md` | Hướng dẫn tra chéo 3 chiều | `skill/resources/cross-reference-guide.md` |
| 8 | `resources/citation-format.md` | Chuẩn trích dẫn & SOT baseline | `skill/resources/citation-format.md` |
| 9 | `resources/search-sources.md` | Cú pháp tra cứu web & nguồn chuẩn | `skill/resources/search-sources.md` |

---

## 3. Danh mục Domain Modules (`resources/domains/`)

| STT | Đường dẫn | Lĩnh vực pháp lý | Trạng thái |
|:---:|:---|:---|:---:|
| 1 | `domains/01-dan-su.md` | Dân sự - Hôn nhân & Gia đình | `skill/resources/domains/01-dan-su.md` |
| 2 | `domains/02-hinh-su-hanh-chinh.md` | Hình sự - Xử phạt hành chính | `skill/resources/domains/02-hinh-su-hanh-chinh.md` |
| 3 | `domains/03-doanh-nghiep-lao-dong.md` | Doanh nghiệp - Đầu tư - Lao động | `skill/resources/domains/03-doanh-nghiep-lao-dong.md` |
| 4 | `domains/04-dat-dai-xay-dung.md` | Đất đai - BĐS - Xây dựng | `skill/resources/domains/04-dat-dai-xay-dung.md` |
| 5 | `domains/05-thue-tai-chinh.md` | Thuế - Tài chính - Hóa đơn | `skill/resources/domains/05-thue-tai-chinh.md` |
| 6 | `domains/06-chuyen-nganh-khac.md` | An ninh mạng, AI, Chữ ký số | `skill/resources/domains/06-chuyen-nganh-khac.md` |
| 7 | `domains/07-hop-dong-catalog.md` | Catalog nhận diện 20 mẫu hợp đồng | `skill/resources/domains/07-hop-dong-catalog.md` |

---

## 4. Tài liệu Thể thức & Thẩm quyền (`references/`)

| STT | Đường dẫn | Nội dung | Trạng thái |
|:---:|:---|:---|:---:|
| 1 | `references/quy_tac_the_thuc.md` | Thông số pixel-perfect NĐ 30 | `skill/references/quy_tac_the_thuc.md` |
| 2 | `references/phan_quyen_ky.md` | Ma trận quyền hạn ký TM, KT, TL, TUQ | `skill/references/phan_quyen_ky.md` |

---

## 5. Danh mục 20 Mẫu Hợp Đồng (`templates/contracts/`)

| STT | ID Hợp đồng | Tên hợp đồng | Trạng thái trong `skill/templates/contracts/` |
|:---:|:---|:---|:---:|
| 1 | `lao_dong` | Hợp đồng lao động | ✅ Đã chuyển giao |
| 2 | `thue_nha` | Hợp đồng thuê nhà / căn hộ | ✅ Đã chuyển giao |
| 3 | `vay_tien` | Hợp đồng vay tiền / tín dụng | ✅ Đã chuyển giao |
| 4 | `dich_vu` | Hợp đồng dịch vụ thương mại | ✅ Đã chuyển giao |
| 5 | `mua_ban_hh` | Hợp đồng mua bán hàng hóa | ✅ Đã chuyển giao |
| 6 | `dat_coc` | Hợp đồng đặt cọc mua bán / thuê | ✅ Đã chuyển giao |
| 7 | `nda` | Thỏa thuận bảo mật thông tin (NDA) | ✅ Đã chuyển giao |
| 8 | `uy_quyen` | Hợp đồng / Giấy ủy quyền | ✅ Đã chuyển giao |
| 9 | `ctv` | Hợp đồng cộng tác viên / khoán việc | ✅ Đã chuyển giao |
| 10 | `nguyen_tac` | Hợp đồng nguyên tắc | ✅ Đã chuyển giao |
| 11 | `chuyen_nhuong_dat_dai` | Hợp đồng chuyển nhượng QSDĐ | ✅ Đã chuyển giao |
| 12 | `thiet_ke_phan_mem` | Hợp đồng phát triển phần mềm | ✅ Đã chuyển giao |
| 13 | `thue_van_phong` | Hợp đồng thuê văn phòng | ✅ Đã chuyển giao |
| 14 | `thoa_thuan_co_dong` | Thỏa thuận cổ đông sáng lập | ✅ Đã chuyển giao |
| 15 | `bao_lanh` | Hợp đồng bảo lãnh nghĩa vụ | ✅ Đã chuyển giao |
| 16 | `dai_ly` | Hợp đồng đại lý thương mại | ✅ Đã chuyển giao |
| 17 | `gia_cong` | Hợp đồng gia công thương mại | ✅ Đã chuyển giao |
| 18 | `gop_von` | Hợp đồng góp vốn thành lập doanh nghiệp | ✅ Đã chuyển giao |
| 19 | `hop_tac_kinh_doanh` | Hợp đồng hợp tác kinh doanh (BCC) | ✅ Đã chuyển giao |
| 20 | `tang_cho` | Hợp đồng tặng cho tài sản | ✅ Đã chuyển giao |
