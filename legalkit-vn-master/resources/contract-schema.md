# Schema Hợp Đồng — `legalkit-vn` V3

> **Mục đích:** Định nghĩa chuẩn dữ liệu (schema) cho mỗi loại hợp đồng trong `templates/contracts/*.json`. Engine đọc đúng schema này mới render được form và hợp đồng.

---

## Cấu trúc tổng thể

```jsonc
{
  "id": "lao_dong",
  "name": "Hợp đồng lao động",
  "title": "HỢP ĐỒNG LAO ĐỘNG",
  "group": "Công ty ↔ Cá nhân",
  "icon": "💼",
  "summary": "Mô tả ngắn...",
  "legalBasis": [ "Bộ luật Lao động 2019..." ],
  "parties": { "a": "Người sử dụng lao động", "b": "Người lao động" },
  "preamble": "...",
  "fields": [],
  "lint": [],
  "body": [],
  "closing": "..."
}
```

---

## Danh mục 20 hợp đồng V3 Master

| # | File | ID | Tên Hợp Đồng | Nhóm Quan Hệ |
|---|---|---|---|---|
| 1 | `hop-dong-bao-lanh.json` | `bao_lanh` | Hợp đồng bảo lãnh | Cá nhân ↔ Tổ chức |
| 2 | `hop-dong-chuyen-nhuong-dat-dai.json` | `chuyen_nhuong_dat_dai` | HĐ chuyển nhượng QSD đất | Cá nhân ↔ Cá nhân |
| 3 | `hop-dong-ctv.json` | `ctv` | HĐ cộng tác viên / khoán việc | Tổ chức ↔ Cá nhân |
| 4 | `hop-dong-dai-ly.json` | `dai_ly` | Hợp đồng đại lý | Doanh nghiệp ↔ Đại lý |
| 5 | `hop-dong-dat-coc.json` | `dat_coc` | Hợp đồng đặt cọc | Cá nhân ↔ Cá nhân |
| 6 | `hop-dong-dich-vu.json` | `dich_vu` | Hợp đồng dịch vụ | Tổ chức ↔ Cá nhân |
| 7 | `hop-dong-gia-cong.json` | `gia_cong` | Hợp đồng gia công hàng hóa | Doanh nghiệp ↔ Doanh nghiệp |
| 8 | `hop-dong-gop-von.json` | `gop_von` | Hợp đồng góp vốn | Cá nhân ↔ Doanh nghiệp |
| 9 | `hop-dong-hop-tac-kinh-doanh.json` | `hop_tac_kinh_doanh` | HĐ hợp tác kinh doanh (BCC) | Tổ chức ↔ Tổ chức |
| 10 | `hop-dong-lao-dong.json` | `lao_dong` | Hợp đồng lao động | NSDLĐ ↔ NLĐ |
| 11 | `hop-dong-nguyen-tac.json` | `nguyen_tac` | Hợp đồng nguyên tắc | Tổ chức ↔ Tổ chức |
| 20 | `uy-quyen.json` | `uy_quyen` | Hợp đồng ủy quyền | Mọi quan hệ |
| 12 | `hop-dong-tang-cho.json` | `tang_cho` | Hợp đồng tặng cho tài sản | Cá nhân ↔ Cá nhân |
| 13 | `hop-dong-thiet-ke-phan-mem.json` | `thiet_ke_phan_mem` | HĐ thiết kế phần mềm / IT | Tổ chức ↔ Doanh nghiệp |
| 14 | `hop-dong-thue-nha.json` | `thue_nha` | Hợp đồng thuê nhà ở | Cá nhân ↔ Cá nhân |
| 15 | `hop-dong-thue-van-phong.json` | `thue_van_phong` | Hợp đồng thuê văn phòng | Doanh nghiệp ↔ Doanh nghiệp |
| 16 | `hop-dong-vay-tien.json` | `vay_tien` | Hợp đồng vay tài sản | Cá nhân ↔ Cá nhân |
| 17 | `mua-ban-hh.json` | `mua_ban_hh` | Hợp đồng mua bán hàng hóa | Tổ chức ↔ Tổ chức |
| 18 | `nda.json` | `nda` | Thỏa thuận bảo mật thông tin | Mọi quan hệ |
| 19 | `thoa-thuan-co-dong.json` | `co_dong` | Thỏa thuận cổ đông | Cổ đông ↔ Cổ đông |
