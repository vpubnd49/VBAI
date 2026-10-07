#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
edit_phieu_trinh_template.py — Điền nội dung vào Phiếu trình mẫu chuẩn
Bảo tồn 100% khung viền, bảng biểu, cột, lề, font chữ của file mẫu gốc:
  bosung/Phiếu trình.docx
"""

import os
import sys
import json
import docx
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "..", "bosung", "Phiếu trình.docx")
FONT_NAME = "Times New Roman"

def replace_paragraph_text_keep_formatting(p, new_prefix, new_content, bold_prefix=True, italic_prefix=True):
    """
    Giữ formatting của paragraph gốc, thay thế phần prefix và content.
    """
    # Xóa text cũ trong runs nhưng giữ style của run đầu tiên nếu có
    p.text = ""
    run_prefix = p.add_run(new_prefix)
    run_prefix.font.name = FONT_NAME
    run_prefix.font.size = Pt(12)
    run_prefix.bold = bold_prefix
    run_prefix.italic = italic_prefix

    run_content = p.add_run(new_content)
    run_content.font.name = FONT_NAME
    run_content.font.size = Pt(12)
    run_content.bold = False
    run_content.italic = False

def fill_phieu_trinh(data, output_path, template_path=None):
    if template_path is None:
        template_path = TEMPLATE_PATH

    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Không tìm thấy template mẫu: {template_path}")

    doc = docx.Document(template_path)

    # 1. CẬP NHẬT TABLE 0 (HEADER - SỐ HIỆU)
    t0 = doc.tables[0]
    so_ky_hieu = data.get("so_ky_hieu", "25-9/26/PT-NC")
    for p in t0.rows[0].cells[0].paragraphs:
        if "Số:" in p.text:
            p.text = f"Số: {so_ky_hieu}"
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(12)

    # 2. CẬP NHẬT TABLE 2 (NỘI DUNG CHÍNH TRONG KHUNG)
    t2 = doc.tables[2]
    cell_main = t2.rows[0].cells[0]
    paragraphs = cell_main.paragraphs

    # P1: 1. Văn bản/cơ quan, đơn vị
    vb_trinh = data.get("van_ban_trinh", "Công văn số 4329/VPCP-CĐS ngày 14/9/2026 của Văn phòng Chính phủ.")
    replace_paragraph_text_keep_formatting(
        paragraphs[1],
        "1. Văn bản/cơ quan, đơn vị: ",
        vb_trinh,
        bold_prefix=True,
        italic_prefix=True,
    )

    # P2: 2. Trích yếu
    trich_yeu = data.get("trich_yeu", "Về việc báo cáo tình hình an ninh chính trị nội bộ...")
    replace_paragraph_text_keep_formatting(
        paragraphs[2],
        "2. Trích yếu: ",
        trich_yeu,
        bold_prefix=True,
        italic_prefix=True,
    )

    # P9: 2. Các sở, ban, ngành trình (kết quả đề nghị)
    co_quan_trinh = data.get("cac_co_quan_trinh", "Văn phòng UBND tỉnh thừa lệnh tham mưu.")
    replace_paragraph_text_keep_formatting(
        paragraphs[9],
        "2. Các sở, ban, ngành, đơn vị, địa phương trình (kết quả đề nghị): ",
        co_quan_trinh,
        bold_prefix=True,
        italic_prefix=True,
    )

    # P10: 3. Thẩm quyền
    tham_quyen = data.get("tham_quyen", "Chủ tịch Ủy ban nhân dân tỉnh.")
    replace_paragraph_text_keep_formatting(
        paragraphs[10],
        "3. Thẩm quyền (Chọn ghi thẩm quyền tương ứng): ",
        tham_quyen,
        bold_prefix=True,
        italic_prefix=True,
    )

    # P11: Tiêu đề mục 4
    paragraphs[11].text = "4. Phòng chuyên môn của Văn phòng UBND tỉnh đề xuất phương án: "
    paragraphs[11].runs[0].font.name = FONT_NAME
    paragraphs[11].runs[0].font.size = Pt(12)
    paragraphs[11].runs[0].bold = True
    paragraphs[11].runs[0].italic = True

    # P12 - P16: Nội dung đề xuất chi tiết
    de_xuat_text = data.get("de_xuat_phuong_an", "")
    if de_xuat_text:
        # Gộp hoặc tách theo các đoạn
        paragraphs[12].text = de_xuat_text
        paragraphs[12].runs[0].font.name = FONT_NAME
        paragraphs[12].runs[0].font.size = Pt(12)
        # Xóa các đoạn thừa từ P13 đến P16 nếu có
        for i in range(13, 17):
            paragraphs[i].text = ""

    # P20: 5. Độ mật
    do_mat = data.get("do_mat", "Không")
    replace_paragraph_text_keep_formatting(
        paragraphs[20],
        "5. Độ mật: ",
        do_mat,
        bold_prefix=True,
        italic_prefix=True,
    )

    # 3. CẬP NHẬT KHỐI CHỮ KÝ (TABLE 2 ROW 1 & 2)
    chuyen_vien = data.get("chuyen_vien", "Trương Hải Châu")
    lanh_dao_phong = data.get("lanh_dao_phong", "Lương Thị Nguyệt Thanh")
    lanh_dao_vp = data.get("lanh_dao_vp", "Trần Thanh Toàn")
    lanh_dao_tinh = data.get("lanh_dao_tinh", "Đinh Văn Tuấn")
    ngay_thang = data.get("ngay_thang", "Ngày 25  tháng 9 năm 2026")

    # Row 2 Cell 0: Chuyên viên
    cell_cv = t2.rows[2].cells[0]
    for p in cell_cv.paragraphs:
        if "Ngày" in p.text:
            p.text = ngay_thang
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(11)
            p.runs[0].italic = True
        elif len(p.text.strip()) > 3 and "Chuyên viên" not in p.text:
            p.text = chuyen_vien
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(12)
            p.runs[0].bold = True

    # Row 2 Cell 1: Lãnh đạo phòng
    cell_ldp = t2.rows[2].cells[1]
    for p in cell_ldp.paragraphs:
        if "Ngày" in p.text:
            p.text = ngay_thang
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(11)
            p.runs[0].italic = True
        elif len(p.text.strip()) > 3 and "Lãnh đạo" not in p.text and "Lãnh đạo" not in p.text:
            p.text = lanh_dao_phong
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(12)
            p.runs[0].bold = True

    # Row 1/2 Cell 2: Lãnh đạo Văn phòng
    cell_ldvp = t2.rows[1].cells[2]
    for p in cell_ldvp.paragraphs:
        if len(p.text.strip()) > 3 and "LÃNH ĐẠO" not in p.text and "Ngày" not in p.text and "..." not in p.text:
            p.text = lanh_dao_vp
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(12)
            p.runs[0].bold = True

    # Row 3 Cell 0: Lãnh đạo UBND tỉnh
    cell_ldt = t2.rows[3].cells[0]
    for p in cell_ldt.paragraphs:
        if len(p.text.strip()) > 3 and "LÃNH ĐẠO" not in p.text and "KÍNH TRÌNH" not in p.text and "Ngày" not in p.text and "..." not in p.text:
            p.text = lanh_dao_tinh
            p.runs[0].font.name = FONT_NAME
            p.runs[0].font.size = Pt(12)
            p.runs[0].bold = True

    # Lưu file
    doc.save(output_path)
    print(f"✅ Đã điền và xuất Phiếu trình bảo toàn 100% khung viền: {output_path}")
    return output_path

if __name__ == "__main__":
    test_data = {
        "so_ky_hieu": "25-9/26/PT-NC",
        "van_ban_trinh": "Công văn số 4329/VPCP-CĐS ngày 14/9/2026 của Văn phòng Chính phủ.",
        "trich_yeu": "Về báo cáo tình hình an ninh chính trị nội bộ, bảo đảm an ninh mạng, an ninh dữ liệu phục vụ yêu cầu ứng dụng khoa học công nghệ, chuyển đổi số.",
        "cac_co_quan_trinh": "Văn phòng UBND tỉnh thừa lệnh tham mưu.",
        "tham_quyen": "Chủ tịch Ủy ban nhân dân tỉnh.",
        "de_xuat_phuong_an": "Chuyên viên đề xuất Chánh Văn phòng UBND tỉnh ký thừa lệnh Chủ tịch UBND tỉnh Công văn giao Công an tỉnh chủ trì, phối hợp với Sở Khoa học và Công nghệ và các sở, ngành có liên quan triển khai thực hiện Công văn số 4329/VPCP-CĐS ngày 14/9/2026 của Văn phòng Chính phủ nêu trên. Trường hợp vượt thẩm quyền báo cáo, đề xuất Ủy ban nhân dân tỉnh.",
        "chuyen_vien": "Trương Hải Châu",
        "lanh_dao_phong": "Lương Thị Nguyệt Thanh",
        "lanh_dao_vp": "Trần Thanh Toàn",
        "lanh_dao_tinh": "Đinh Văn Tuấn",
        "ngay_thang": "Ngày 25 tháng 9 năm 2026",
        "do_mat": "Mật.",
    }

    out_file = os.path.join(os.path.dirname(__file__), "phieu_trinh_bao_toan_khung_test.docx")
    fill_phieu_trinh(test_data, out_file)
