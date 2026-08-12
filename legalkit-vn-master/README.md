# legalkit-vn

> **Nền tảng Pháp Lý AI Tích Hợp cho Pháp Luật Việt Nam**

Bộ skill Antigravity kết hợp 4 năng lực chính:

*   **(A) Research** (Nghiên cứu): Tra cứu VBQPPL thực tế qua PDCA Cascade, xây Source of Truth trích dẫn nguyên văn có tọa độ (VB, Số hiệu, Điều, Khoản, Điểm)
*   **(B) Draft** (Soạn thảo): Soạn thảo 20 loại hợp đồng chuẩn, hệ thống 3 tầng điều khoản, kiểm tra ràng buộc pháp lý realtime (lint)
*   **(C) Integrated** (Tích hợp): Nghiên cứu tình huống rồi tự động nhúng SOT vào hợp đồng soạn thảo
*   **(D) NĐ30 Formatting** (Thể thức hành chính): Tạo và rà soát công văn, quyết định chuẩn Nghị định 30/2020/NĐ-CP (sử dụng công cụ Node.js docx-js)

> **Disclaimer:** Hỗ trợ nghiên cứu và soạn thảo sơ bộ. Không thay thế ý kiến pháp lý chính thức từ luật sư hoặc cơ quan có thẩm quyền.

---

## Cấu trúc Thư mục

```
legalkit-vn/
├── SKILL.md                          ← Core instructions (4 mode)
├── SKILL_ND30.md                     ← Core instructions của bộ thể thức gốc
├── README_ND30.md                    ← Hướng dẫn sử dụng gốc của bộ thể thức
├── package.json                      ← Khai báo thư viện Node.js cho Mode D
├── package-lock.json                 ← Lockfile Node.js
├── resources/
│   ├── legal-system.md               ← Thứ bậc VBQPPL VN
│   ├── cross-reference-guide.md      ← Tra chéo 3 chiều
│   ├── citation-format.md            ← Chuẩn trích dẫn và template SOT
│   ├── search-sources.md             ← Nguồn tra cứu và cú pháp search
│   ├── contract-schema.md            ← Schema JSON chuẩn hóa hợp đồng
│   ├── lint-rules.md                 ← Bộ ràng buộc pháp lý theo domain
│   ├── nd30-format-standard.md       ← Đặc tả tóm tắt lề và font chữ NĐ 30
│   └── domains/
│       ├── 01-dan-su.md              ← Dân sự và Gia đình
│       ├── 02-hinh-su-hanh-chinh.md  ← Hình sự và Hành chính
│       ├── 03-doanh-nghiep-lao-dong.md ← Doanh nghiệp và Lao động
│       ├── 04-dat-dai-xay-dung.md    ← Đất đai và Xây dựng
│       ├── 05-thue-tai-chinh.md      ← Thuế và Tài chính
│       ├── 06-chuyen-nganh-khac.md   ← Chuyên ngành khác (AI, SHTT...)
│        └── 07-hop-dong-catalog.md    ← Catalog 20 loại hợp đồng
├── references/
│   ├── phan_quyen_ky.md              ← Ma trận quyền hạn ký văn bản (TM, KT, TL, TUQ)
│   ├── quy_tac_the_thuc.md           ← Quy tắc dxa chi tiết cho Header, Body, Chữ ký
│   └── case-studies/
│       ├── lao-dong-don-phuong-cham-dut.md ← Case study đơn phương chấm dứt HĐLĐ (Đồng Tháp)
│       └── dat-dai-tranh-chap-dat-coc.md   ← Case study tranh chấp cọc đất đai (Lâm Đồng)
├── scripts/
│   ├── contract_builder.py           ← Render hợp đồng và định dạng NĐ 30 (Python)
│   ├── sot_validator.py              ← Validate format trích dẫn SOT
│   ├── law_updater.py                ← Kiểm tra VB pháp luật cập nhật mới
│   ├── generate_cong_van.js          ← Tạo công văn chuẩn NĐ 30 (Node.js)
│   └── generate_quyet_dinh.js        ← Tạo quyết định chuẩn NĐ 30 (Node.js)
└── templates/
    ├── engine/
    │   └── index.html                ← Engine HTML (từ ezlawclassic)
    └── contracts/
        ├── hop-dong-lao-dong.json
        ├── hop-dong-thue-nha.json
        ├── hop-dong-vay-tien.json
        ├── hop-dong-dich-vu.json
        ├── mua-ban-hh.json
        ├── hop-dong-dat-coc.json
        ├── hop-dong-ctv.json
        ├── nda.json
        ├── hop-dong-nguyen-tac.json
        ├── uy-quyen.json
        ├── hop-dong-hop-tac-kinh-doanh.json
        ├── hop-dong-gop-von.json
        ├── hop-dong-chuyen-nhuong-dat-dai.json
        ├── hop-dong-thue-van-phong.json
        ├── hop-dong-gia-cong.json
        ├── hop-dong-thiet-ke-phan-mem.json
        ├── hop-dong-dai-ly.json
        ├── thoa-thuan-co-dong.json
        ├── hop-dong-bao-lanh.json
        └── hop-dong-tang-cho.json
```

---

## 20 Loại Hợp Đồng Hỗ Trợ

| # | Tên | File |
|---|---|---|
| 1 | Hợp đồng lao động | `hop-dong-lao-dong.json` |
| 2 | Hợp đồng thuê nhà ở | `hop-dong-thue-nha.json` |
| 3 | Hợp đồng vay tài sản (vay tiền) | `hop-dong-vay-tien.json` |
| 4 | Hợp đồng dịch vụ | `hop-dong-dich-vu.json` |
| 5 | Hợp đồng mua bán hàng hóa | `mua-ban-hh.json` |
| 6 | Hợp đồng đặt cọc | `hop-dong-dat-coc.json` |
| 7 | Hợp đồng cộng tác viên (khoán việc) | `hop-dong-ctv.json` |
| 8 | Thỏa thuận bảo mật (NDA) | `nda.json` |
| 9 | Hợp đồng nguyên tắc | `hop-dong-nguyen-tac.json` |
| 10 | Hợp đồng ủy quyền | `uy-quyen.json` |
| 11 | Hợp đồng hợp tác kinh doanh (BCC) | `hop-dong-hop-tac-kinh-doanh.json` |
| 12 | Hợp đồng góp vốn thành lập doanh nghiệp | `hop-dong-gop-von.json` |
| 13 | Hợp đồng chuyển nhượng quyền sử dụng đất | `hop-dong-chuyen-nhuong-dat-dai.json` |
| 14 | Hợp đồng thuê văn phòng (mặt bằng) | `hop-dong-thue-van-phong.json` |
| 15 | Hợp đồng gia công thương mại | `hop-dong-gia-cong.json` |
| 16 | Hợp đồng phát triển (thiết kế) phần mềm | `hop-dong-thiet-ke-phan-mem.json` |
| 17 | Hợp đồng đại lý thương mại | `hop-dong-dai-ly.json` |
| 18 | Thỏa thuận cổ đông sáng lập | `thoa-thuan-co-dong.json` |
| 19 | Hợp đồng bảo lãnh thực hiện nghĩa vụ | `hop-dong-bao-lanh.json` |
| 20 | Hợp đồng tặng cho tài sản (đất đai) | `hop-dong-tang-cho.json` |

---

## Hướng dẫn Sử dụng các Kịch bản (Scripts)

### 1. Contract Builder (Soạn hợp đồng và xuất Docx)
```bash
# Chạy ở chế độ tương tác (nhập tay từng trường)
python scripts/contract_builder.py --template hop-dong-lao-dong.json

# Chạy với file dữ liệu JSON có sẵn
python scripts/contract_builder.py --template hop-dong-vay-tien.json --input data.json --output output.docx
```
*Yêu cầu:* Đã cài đặt thư viện `python-docx`.

### 2. SOT Validator (Rà soát trích dẫn pháp lý)
```bash
# Kiểm tra định dạng một file ghi chép phase cụ thể
python scripts/sot_validator.py legal_phase_1.md

# Kiểm tra hàng loạt trong thư mục nghiên cứu
python scripts/sot_validator.py --dir legal_research_tranh_chap/
```

### 3. Law Updater (Kiểm tra văn bản cập nhật mới)
```bash
# Kiểm tra hiệu lực tất cả văn bản trong hệ thống
python scripts/law_updater.py

# Kiểm tra các văn bản được trích dẫn trong một hợp đồng mẫu
python scripts/law_updater.py --contract hop-dong-lao-dong.json
```

### 4. Node.js NĐ30 Document Generator (Mode D)
*Yêu cầu:* Chạy lệnh `npm install` trước để cài đặt thư viện `docx`.
```bash
# Sinh file công văn hành chính
node scripts/generate_cong_van.js --input input.json --output output.docx

# Sinh file quyết định hành chính
node scripts/generate_quyet_dinh.js --input input.json --output output.docx
```

---

## Nguồn gốc Dự án

Bộ skill này được tích hợp và nâng cấp từ các tài nguyên:
*   **tu-van-phap-luat-v1.0** (Nghiên cứu luật theo PDCA và SOT)
*   **ezlawclassic** (Thư viện 10 loại hợp đồng và bộ linter)
*   **Skill_The_Thuc_VB_ND30** (Bộ engine xuất văn bản hành chính theo Nghị định 30)

---

## Phiên bản

*   **v1.0** (21/07/2026): Phát hành lần đầu.
*   **v2.0** (21/07/2026): Tích hợp hoàn toàn bộ skill thể thức Nghị định 30, bổ sung tài liệu nghiên cứu tình huống thực tế (case-studies).

---

*Bộ skill này được xây dựng bởi Minh Đỗ*
