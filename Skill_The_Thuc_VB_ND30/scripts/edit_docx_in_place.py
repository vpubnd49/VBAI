#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
edit_docx_template_in_place.py — Bộ công cụ chỉnh sửa file mẫu DOCX tại chỗ
Đảm bảo NGUYÊN TẮC BẢO TOÀN CẤU TRÚC KHUNG (ZERO STRUCTURE MUTATION):
- Giữ nguyên 100% table borders, cell dimensions, nested tables, margins.
- Không bóc tách document thành text trôi rồi generate lại từ đầu.
- Thay thế chính xác nội dung tại các Paragraphs và Table Cells.
"""

import os
import sys
import json
import argparse
import docx

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def replace_text_in_paragraph(paragraph, search_text, replace_text):
    """
    Thay thế chuỗi trong paragraph mà vẫn bảo toàn formatting của các Runs.
    """
    if search_text not in paragraph.text:
        return False

    # Nếu toàn bộ paragraph chỉ chứa chuỗi cần thay thế
    if paragraph.text.strip() == search_text.strip():
        # Giữ style của run đầu tiên nếu có
        font_name = None
        font_size = None
        bold = None
        italic = None
        if paragraph.runs:
            first_run = paragraph.runs[0]
            font_name = first_run.font.name
            font_size = first_run.font.size
            bold = first_run.bold
            italic = first_run.italic

        paragraph.text = ""
        r = paragraph.add_run(replace_text)
        if font_name: r.font.name = font_name
        if font_size: r.font.size = font_size
        if bold is not None: r.bold = bold
        if italic is not None: r.italic = italic
        return True

    # Nếu chuỗi nằm trong một run duy nhất
    for run in paragraph.runs:
        if search_text in run.text:
            run.text = run.text.replace(search_text, replace_text)
            return True

    # Nếu chuỗi bị chia cắt qua nhiều runs: gộp và thay thế
    full_text = "".join(r.text for r in paragraph.runs)
    if search_text in full_text:
        new_full = full_text.replace(search_text, replace_text)
        # Giữ format run đầu
        first = paragraph.runs[0] if paragraph.runs else None
        font_name = first.font.name if first else "Times New Roman"
        font_size = first.font.size if first else None
        bold = first.bold if first else False
        italic = first.italic if first else False

        paragraph.text = ""
        r = paragraph.add_run(new_full)
        r.font.name = font_name
        if font_size: r.font.size = font_size
        r.bold = bold
        r.italic = italic
        return True

    return False

def process_document_replacements(doc, replacements):
    """
    Áp dụng bảng tra thay thế { search: replace } vào toàn bộ docx:
    bao gồm Paragraphs ngoài bảng và toàn bộ Table Cells.
    """
    count = 0

    # 1. Duyệt Paragraphs ngoài bảng
    for p in doc.paragraphs:
        for s_text, r_text in replacements.items():
            if replace_text_in_paragraph(p, s_text, r_text):
                count += 1

    # 2. Duyệt các Table (kể cả nested tables)
    def process_table(table):
        nonlocal count
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for s_text, r_text in replacements.items():
                        if replace_text_in_paragraph(p, s_text, r_text):
                            count += 1
                for nested_table in cell.tables:
                    process_table(nested_table)

    for table in doc.tables:
        process_table(table)

    return count

def edit_docx_in_place(template_path, output_path, replacements):
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Không tìm thấy file mẫu: {template_path}")

    doc = docx.Document(template_path)
    replaced_count = process_document_replacements(doc, replacements)
    doc.save(output_path)
    print(f"✅ Đã cập nhật {replaced_count} vị trí và xuất file thành công: {output_path}")
    return output_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chỉnh sửa file DOCX mẫu tại chỗ bảo toàn khung viền")
    parser.add_argument("--template", required=True, help="Đường dẫn file DOCX mẫu gốc")
    parser.add_argument("--output", required=True, help="Đường dẫn lưu file DOCX kết quả")
    parser.add_argument("--data", required=True, help="Chuỗi JSON hoặc đường dẫn file JSON { search: replace }")

    args = parser.parse_args()

    if os.path.exists(args.data):
        with open(args.data, "r", encoding="utf-8") as f:
            replacements = json.load(f)
    else:
        replacements = json.loads(args.data)

    edit_docx_in_place(args.template, args.output, replacements)
