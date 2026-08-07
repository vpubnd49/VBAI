# Ma Tran Phan Quyen Ky Van Ban (QD 1528/QD-BTC)

## 1. Cac hinh thuc ky

| Viet tat | Day du | Y nghia | Nguoi ky |
|:---:|:---|:---|:---|
| **TM.** | Thay mat | Nguoi dung dau ky truc tiep | Bo truong |
| **KT.** | Ky thay | Cap pho ky thay nguoi dung dau | Thu truong |
| **TL.** | Thua lenh | Cap duoi ky theo uy quyen | Vu truong |
| **TUQ.** | Thua uy quyen | Ky theo uy quyen chuyen tiep | Pho Vu truong |
| **Q.** | Quyen | Nguoi giu quyen chuc vu | (tuy truong hop) |

## 2. Cach trinh bay khoi chu ky trong DOCX

### Bo truong ky truc tiep
```
                                    BO TRUONG
                                (Ky, ghi ro ho ten)
                                  Nguyen Van Thang
```

### Thu truong ky thay
```
                                  KT. BO TRUONG
                                   THU TRUONG
                                (Ky, ghi ro ho ten)
                                  Do Thanh Trung
```

### Vu truong ky thua lenh
```
                                  TL. BO TRUONG
                              VU TRUONG VU TO CHUC CAN BO
                                (Ky, ghi ro ho ten)
                                  Nguyen Van A
```

### Pho Vu truong ky thua uy quyen
```
                                  TL. BO TRUONG
                            KT. VU TRUONG VU TO CHUC CAN BO
                                 PHO VU TRUONG
                                (Ky, ghi ro ho ten)
                                  Tran Van B
```

## 3. Bang mapping Loai cong viec -> Cap ky

| Loai cong viec | Cap ky | Quyen han | Chuc vu trinh bay |
|:---|:---:|:---:|:---|
| Cu dai dien tham gia to cong tac (Thu truong) | TM. | Bo truong ky | BO TRUONG |
| Cu dai dien tham gia to cong tac (cap Vu) | KT. | Thu truong ky | KT. BO TRUONG / THU TRUONG |
| Van ban hanh chinh thong thuong | TL. | Vu truong ky | TL. BO TRUONG / VU TRUONG VU... |
| Quyet dinh bo nhiem, dieu dong | TM. | Bo truong ky | BO TRUONG |
| Quyet dinh cu doan di nuoc ngoai | TM. hoac KT. | Bo truong hoac Thu truong | (tuy phan cong) |

## 4. Thong so trinh bay chu ky trong DOCX

- **Quyen han (TM./KT./TL.)**: IN HOA, **Dam**, co chu `13`, can phai (right-aligned)
- **Chuc vu (BO TRUONG / THU TRUONG)**: IN HOA, **Dam**, co chu `13` hoac `14`, can giua khoi chu ky
- **"(Ky, ghi ro ho ten)"**: Co chu `14`, *nghieng*, can giua (chi dung khi chua ky)
- **Ho ten nguoi ky**: In thuong, **Dam**, co chu `14`, can giua duoi chuc vu
- **Khoang cach**: Tu dong cuoi noi dung den dong chu ky: khoang 2-3 dong trong

## 5. Noi nhan (Phan cuoi van ban)

Noi nhan nam o goc TRAI, ngang hang voi dong chuc vu ky ben PHAI:

```
Noi nhan:                           KT. BO TRUONG
- Nhu tren;                          THU TRUONG
- Thu truong Do Thanh Trung;
- Vu PTHT; VPB;                    Do Thanh Trung
- Luu: VT, TCCB (6b).
```

| Yeu to | Co chu | Style |
|:---|:---:|:---|
| "Noi nhan:" | 12 | **Dam**, *Nghieng* |
| Cac muc liet ke | 11 | Thuong, dung |
| Dau gach dau dong | `-` | |
| Muc cuoi | `Luu: VT, <don vi>` | |
