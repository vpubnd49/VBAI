"""
VBAI PDF Pipeline - Build Script
==========================================
Chuyển đổi file Markdown highlights văn bản pháp luật thành HTML + PDF chuyên nghiệp.

Usage:
    python build_pdf.py <file.md>

Output:
    - <file>.html  (để gửi email, xem trên web)
    - <file>_v1.pdf (để in ấn, gửi khách hàng)

Dependencies:
    pip install markdown pyhtml2pdf

Notes:
    - File logo.png và document-template.html phải nằm cùng thư mục
    - Nếu gặp PermissionError: tăng VERSION_NUMBER hoặc đóng file PDF đang mở
"""

import sys
import os
import re
import base64
import markdown
from datetime import datetime
from pyhtml2pdf import converter

# ============================================================
# CẤU HÌNH — Chỉnh sửa tại đây khi cần
# ============================================================
VERSION_NUMBER = 1  # Tăng số này nếu gặp PermissionError (file PDF đang mở)

# ============================================================
# KIỂM TRA INPUT
# ============================================================
if len(sys.argv) < 2:
    print("Usage: python build_pdf.py <file.md>")
    print("Example: python build_pdf.py nd25-2026-highlights.md")
    sys.exit(1)

md_file = sys.argv[1]

if not os.path.exists(md_file):
    print(f"ERROR: File '{md_file}' không tồn tại.")
    sys.exit(1)

base_name = os.path.splitext(md_file)[0]
html_file = base_name + ".html"
pdf_file = f"{base_name}_v{VERSION_NUMBER}.pdf"

# ============================================================
# ĐỌC MARKDOWN
# ============================================================
with open(md_file, 'r', encoding='utf-8') as f:
    md_content = f.read()

# ============================================================
# TRÍCH XUẤT METADATA TỪ BLOCKQUOTE
# ============================================================
def extract_meta(key, text):
    """Trích xuất giá trị metadata từ blockquote đầu file Markdown."""
    m = re.search(r'\*\*' + key + r':\*\* (.*?)(?:\n|$)', text)
    return m.group(1).strip() if m else ""

ten_day_du = extract_meta("Tên đầy đủ", md_content)
so_hieu = extract_meta("Số hiệu", md_content)
ngay_ban_hanh = extract_meta("Ngày ban hành", md_content)
hieu_luc = extract_meta("Hiệu lực", md_content)
can_cu = extract_meta("Căn cứ chính", md_content)

# Tiêu đề chính = heading h1 đầu tiên
m_title = re.search(r'^# (.*?)(?:\n|$)', md_content)
tieu_de_chinh = m_title.group(1).strip() if m_title else so_hieu

# Số hiệu văn bản (hiển thị trên header)
so_hieu_van_ban = f"NGHỊ ĐỊNH {so_hieu}" if "NĐ-CP" in so_hieu else so_hieu

# Tên ngắn gọn (cắt nếu quá dài)
ten_ngan_gon = ten_day_du
if len(ten_ngan_gon) > 60:
    ten_ngan_gon = ten_ngan_gon[:57] + "..."

# ============================================================
# CONVERT MARKDOWN → HTML
# ============================================================
# Loại bỏ metadata block ở đầu file để không render trùng
md_body = re.sub(r'^# .*?\n\n(?:> .*?\n)+\n---\n', '', md_content, count=1, flags=re.DOTALL)
html_content = markdown.markdown(md_body, extensions=['tables', 'nl2br', 'sane_lists'])

# Bọc h3 → .action card, h2 → .card (để CSS styling)
html_content = re.sub(
    r'(<h3>.*?</h3>)(.*?)(?=(<h3>|<h2>|<h1|$))',
    r'<div class="action">\1\2</div>',
    html_content, flags=re.DOTALL
)
html_content = re.sub(
    r'(<h2>.*?</h2>)(.*?)(?=(<h2>|<h1|$))',
    r'<div class="card">\1\2</div>',
    html_content, flags=re.DOTALL
)

# ============================================================
# NHÚNG LOGO BASE64
# ============================================================
logo_path = 'logo.png'
if not os.path.exists(logo_path):
    # Thử tìm trong thư mục cha
    logo_path = os.path.join('..', 'logo.png')
if not os.path.exists(logo_path):
    print("WARNING: Không tìm thấy logo.png. Header sẽ không có logo.")
    b64 = ""
else:
    with open(logo_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')

# ============================================================
# NẠP TEMPLATE HTML
# ============================================================
template_path = 'document-template.html'
if not os.path.exists(template_path):
    template_path = os.path.join('..', 'document-template.html')
if not os.path.exists(template_path):
    print("ERROR: Không tìm thấy document-template.html")
    sys.exit(1)

with open(template_path, 'r', encoding='utf-8') as f:
    template = f.read()

# ============================================================
# INJECT DỮ LIỆU VÀO TEMPLATE
# ============================================================
# Logo
template = template.replace('{{LOGO_BASE64}}', b64)

# Header / Footer placeholders
template = template.replace('{{DOC_TITLE}}', tieu_de_chinh)
template = template.replace('{{DOC_SUBTITLE}}', ten_ngan_gon)
template = template.replace('{{SO_HIEU_VAN_BAN}}', so_hieu_van_ban)
template = template.replace('{{TEN_NGAN_GON}}', ten_ngan_gon)
template = template.replace('{{NGAY_HIEU_LUC}}', hieu_luc)
template = template.replace('{{NGAY_CAP_NHAT}}', datetime.now().strftime('%d/%m/%Y'))

# Container placeholders
template = template.replace('{{TIEU_DE_CHINH}}', tieu_de_chinh)
template = template.replace('{{TEN_DAY_DU}}', ten_day_du)
template = template.replace('{{SO_HIEU}}', so_hieu)
template = template.replace('{{NGAY_BAN_HANH}}', ngay_ban_hanh)
template = template.replace('{{CAN_CU}}', can_cu)

# Nội dung chính
template = template.replace('<!-- NỘI DUNG CHÍNH Ở ĐÂY -->', html_content)

# ============================================================
# XUẤT HTML
# ============================================================
with open(html_file, 'w', encoding='utf-8') as f:
    f.write(template)

print(f"✅ Generated {html_file}")

# ============================================================
# XUẤT PDF
# ============================================================
pdf_path = os.path.abspath(pdf_file)
html_path = "file:///" + os.path.abspath(html_file).replace("\\", "/")

print(f"📄 Converting to {pdf_path}...")

print_options = {
    'displayHeaderFooter': True,
    'footerTemplate': '<div style="font-size: 11px; width: 100%; text-align: center; color: #718096; padding-bottom: 5px; font-family: Arial, sans-serif;">Trang <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    'headerTemplate': '<div></div>'
}

try:
    converter.convert(html_path, pdf_path, print_options=print_options)
    print(f"🎉 Success! PDF saved as {pdf_file}")
except PermissionError:
    print(f"\n❌ PermissionError: File '{pdf_file}' đang được mở bởi chương trình khác.")
    print(f"   → Đóng file PDF hoặc tăng VERSION_NUMBER trong script (hiện tại: {VERSION_NUMBER})")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)
