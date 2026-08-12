"""
law_updater.py — legalkit-vn
Kiểm tra xem các văn bản pháp luật trong lint-rules.md và contract templates
có được cập nhật/sửa đổi mới không, bằng cách tra thuvienphapluat.vn

Cách dùng:
    python law_updater.py                        # Kiểm tra tất cả
    python law_updater.py --vb "45/2019/QH14"   # Kiểm tra một VB cụ thể
    python law_updater.py --contract hop-dong-lao-dong.json  # Kiểm tra 1 contract
    python law_updater.py --report               # Xuất báo cáo đầy đủ
"""

import json
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime

try:
    import urllib.request
    import urllib.parse
except ImportError:
    pass

SKILL_DIR = Path(__file__).parent.parent
CONTRACTS_DIR = SKILL_DIR / "templates" / "contracts"
LINT_RULES = SKILL_DIR / "resources" / "lint-rules.md"
REPORT_DIR = SKILL_DIR / "output"
REPORT_DIR.mkdir(exist_ok=True)

# Các VB quan trọng cần theo dõi theo domain
WATCHED_DOCUMENTS = {
    "Lao động": [
        {"so_hieu": "45/2019/QH14", "ten": "Bộ luật Lao động 2019", "dieu_lien_quan": "24-26, 35, 107"},
        {"so_hieu": "145/2020/NĐ-CP", "ten": "NĐ 145/2020 hướng dẫn BLLĐ", "dieu_lien_quan": "nhiều"},
    ],
    "Dân sự": [
        {"so_hieu": "91/2015/QH13", "ten": "Bộ luật Dân sự 2015", "dieu_lien_quan": "328, 463-471"},
    ],
    "Thương mại": [
        {"so_hieu": "36/2005/QH11", "ten": "Luật Thương mại 2005", "dieu_lien_quan": "301, 307, 319"},
    ],
    "Nhà ở": [
        {"so_hieu": "27/2023/QH15", "ten": "Luật Nhà ở 2023", "dieu_lien_quan": "31"},
    ],
    "Đất đai": [
        {"so_hieu": "31/2024/QH15", "ten": "Luật Đất đai 2024", "dieu_lien_quan": "nhiều"},
    ],
    "VBQPPL": [
        {"so_hieu": "Ban hành 2025", "ten": "Luật Ban hành VBQPPL 2025 (nếu có)", "dieu_lien_quan": "thứ bậc"},
    ],
}


def extract_vb_from_contracts() -> list:
    """Trích xuất danh sách số hiệu VB từ tất cả contract templates."""
    vb_list = []
    pattern = re.compile(r'\b(\d+/\d{4}/(?:QH\d+|NĐ-CP|TT-\w+|QĐ-TTg|QĐ-UBND))\b')

    for contract_file in CONTRACTS_DIR.glob("*.json"):
        try:
            with open(contract_file, encoding="utf-8") as f:
                data = json.load(f)
            # Tìm trong legalBasis
            for basis in data.get("legalBasis", []):
                matches = pattern.findall(basis)
                for m in matches:
                    vb_list.append({
                        "so_hieu": m,
                        "source": contract_file.name,
                        "context": basis[:80]
                    })
        except Exception as e:
            print(f"Lỗi đọc {contract_file.name}: {e}")

    # Deduplicate
    seen = set()
    unique = []
    for item in vb_list:
        if item["so_hieu"] not in seen:
            seen.add(item["so_hieu"])
            unique.append(item)

    return unique


def build_search_url(so_hieu: str) -> str:
    """Tạo URL tìm kiếm trên thuvienphapluat.vn."""
    query = urllib.parse.quote(so_hieu)
    return f"https://thuvienphapluat.vn/tim-kiem-van-ban.aspx?keyword={query}&area=0&match=False&type=0&lan=1&org=0&sign=0&des=False&topic=0"


def check_document_status(so_hieu: str) -> dict:
    """
    Kiểm tra trạng thái VB trên thuvienphapluat.vn.
    Lưu ý: Do giới hạn web crawling, trả về URL để agent tra cứu thủ công.
    """
    search_url = build_search_url(so_hieu)
    return {
        "so_hieu": so_hieu,
        "search_url": search_url,
        "instruction": f"Truy cập URL trên, kiểm tra banner 'Còn hiệu lực' / 'Hết hiệu lực' / 'Hết hiệu lực một phần'",
        "checked_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }


def generate_report(vb_list: list, output_path: Path = None):
    """Tạo báo cáo kiểm tra VB."""
    lines = [
        f"# Báo cáo Kiểm tra Cập nhật Văn bản Pháp luật",
        f"**Ngày:** {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        f"**Tổng VB cần kiểm tra:** {len(vb_list)}",
        "",
        "---",
        "",
        "## Hướng dẫn sử dụng",
        "",
        "1. Mở từng URL trong bảng dưới đây",
        "2. Kiểm tra banner đầu trang trên thuvienphapluat.vn:",
        "   - 🟢 'Còn hiệu lực' → OK",
        "   - 🟡 'Hết hiệu lực một phần' → Kiểm tra điều/khoản nào hết",
        "   - 🔴 'Hết hiệu lực' → Cần cập nhật lint-rules.md và contract JSON",
        "3. Cập nhật cột 'Trạng thái' trong bảng này",
        "4. Nếu VB thay đổi → cập nhật `resources/lint-rules.md` + `verifyNotes` trong contract JSON",
        "",
        "---",
        "",
        "## Danh sách VB Cần Kiểm Tra",
        "",
        "| Số hiệu | Nguồn | Trạng thái | URL Kiểm tra |",
        "|---|---|---|---|",
    ]

    for item in vb_list:
        url = build_search_url(item.get("so_hieu", ""))
        source = item.get("source", "watched_list")
        so_hieu = item.get("so_hieu", "")
        lines.append(f"| {so_hieu} | {source} | ⬜ Chưa kiểm tra | [Kiểm tra]({url}) |")

    lines.extend([
        "",
        "---",
        "",
        "## VB Theo Dõi Trọng Điểm",
        "",
    ])

    for domain, docs in WATCHED_DOCUMENTS.items():
        lines.append(f"### {domain}")
        for doc in docs:
            url = build_search_url(doc["so_hieu"])
            lines.append(f"- [{doc['ten']}]({url}) — Điều liên quan: {doc['dieu_lien_quan']}")
        lines.append("")

    report_content = "\n".join(lines)

    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d")
        output_path = REPORT_DIR / f"law_update_report_{timestamp}.md"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"\n✅ Báo cáo đã xuất: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="legalkit-vn Law Updater")
    parser.add_argument("--vb", help="Kiểm tra một VB cụ thể theo số hiệu")
    parser.add_argument("--contract", help="Kiểm tra VB trong một contract template")
    parser.add_argument("--report", action="store_true", help="Xuất báo cáo đầy đủ")
    parser.add_argument("--output", "-o", help="Đường dẫn file báo cáo output")
    args = parser.parse_args()

    if args.vb:
        # Kiểm tra một VB cụ thể
        result = check_document_status(args.vb)
        print(f"\nKiểm tra VB: {result['so_hieu']}")
        print(f"URL tìm kiếm: {result['search_url']}")
        print(f"Hướng dẫn: {result['instruction']}")

    elif args.contract:
        # Kiểm tra VB trong một contract template
        contract_path = CONTRACTS_DIR / args.contract
        if not contract_path.exists():
            print(f"Không tìm thấy: {contract_path}")
            sys.exit(1)
        with open(contract_path, encoding="utf-8") as f:
            data = json.load(f)
        print(f"\nVB trong {args.contract}:")
        for basis in data.get("legalBasis", []):
            print(f"  - {basis}")
        print("\nURL tìm kiếm:")
        pattern = re.compile(r'\b(\d+/\d{4}/(?:QH\d+|NĐ-CP|TT-\w+))\b')
        for basis in data.get("legalBasis", []):
            for match in pattern.findall(basis):
                url = build_search_url(match)
                print(f"  [{match}] {url}")

    else:
        # Mặc định: kiểm tra tất cả + xuất báo cáo
        print("Thu thập danh sách VB từ contract templates...")
        vb_from_contracts = extract_vb_from_contracts()
        print(f"  Tìm thấy {len(vb_from_contracts)} VB duy nhất trong contracts")

        # Thêm watched documents
        watched_flat = []
        for domain, docs in WATCHED_DOCUMENTS.items():
            for doc in docs:
                watched_flat.append({
                    "so_hieu": doc["so_hieu"],
                    "source": f"watched:{domain}",
                    "context": doc["ten"]
                })

        all_vb = vb_from_contracts + watched_flat

        output_path = Path(args.output) if args.output else None
        report_path = generate_report(all_vb, output_path)

        print(f"\nMở file báo cáo để kiểm tra từng VB:")
        print(f"  {report_path}")


if __name__ == "__main__":
    main()
