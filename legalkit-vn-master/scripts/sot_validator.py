"""
sot_validator.py — legalkit-vn
Validate format trích dẫn SOT (Source of Truth) trong file legal_phase_X.md

Kiểm tra:
  1. Tọa độ pháp lý đúng format: [Cấp VB] [Số hiệu] – Điều X, Khoản Y, Điểm Z
  2. Không có placeholder [THIẾU: ...] còn sót
  3. Có ít nhất 3 trích dẫn nguyên văn trong file
  4. Trạng thái hiệu lực được ghi nhận

Cách dùng:
    python sot_validator.py legal_phase_1.md
    python sot_validator.py --dir legal_research_[chủ_đề]/
"""

import re
import sys
import os
import argparse
from pathlib import Path


# Pattern tọa độ pháp lý hợp lệ
# VD: "Luật 45/2019/QH14 – Điều 35, Khoản 1, Điểm b"
# VD: "NĐ 145/2020/NĐ-CP – Điều 3, Khoản 2"
# VD: "TT 10/2021/TT-BXD – Điều 12"
# VD: "Án lệ 04/2016/AL" hoặc "AL-04/2016/AL"
SOT_COORDINATE_PATTERN = re.compile(
    r'(?:(?:Luật|Bộ luật|Nghị định|NĐ|Thông tư|TT|Pháp lệnh|Quyết định|QĐ|Hiến pháp)\s+[\w/\-]+\s*[–\-]\s*Điều\s+\d+|'
    r'(?:Án lệ\s+(?:số\s+)?\d+/\d+/AL|AL\s*[–\-]\s*\d+/\d+/AL|\bAL-\d+/\d+/AL\b))',
    re.IGNORECASE
)

# Pattern phát hiện placeholder chưa điền
MISSING_PLACEHOLDER = re.compile(r'\[THIẾU:\s*[\w_]+\]')

# Pattern phát hiện tọa độ dạng shorthand trong ngoặc
INLINE_COORDINATE = re.compile(
    r'\[(?:Luật|NĐ|TT|BLDS|BLLĐ|Bộ luật|Án lệ|AL)[^\]]{5,80}\]'
)


def validate_file(filepath: Path) -> dict:
    """Validate một file phase và trả về report."""
    result = {
        "file": str(filepath),
        "passed": True,
        "errors": [],
        "warnings": [],
        "stats": {},
    }

    if not filepath.exists():
        result["passed"] = False
        result["errors"].append(f"File không tồn tại: {filepath}")
        return result

    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    # 1. Đếm trích dẫn tọa độ pháp lý
    coords_found = SOT_COORDINATE_PATTERN.findall(content)
    inline_coords = INLINE_COORDINATE.findall(content)
    total_citations = len(coords_found) + len(inline_coords)
    result["stats"]["citations"] = total_citations

    if total_citations < 3:
        result["passed"] = False
        result["errors"].append(
            f"Không đủ trích dẫn: tìm thấy {total_citations}, cần ≥ 3 (QG #4)"
        )
    else:
        result["warnings"].append(f"✅ Trích dẫn: {total_citations} tọa độ pháp lý")

    # 2. Kiểm tra placeholder còn sót
    missing = MISSING_PLACEHOLDER.findall(content)
    result["stats"]["missing_placeholders"] = len(missing)
    if missing:
        result["passed"] = False
        for m in missing:
            result["errors"].append(f"Placeholder chưa điền: {m}")

    # 3. Kiểm tra có section Truth/Actionable/Gap
    required_sections = ["Truth", "Sự thật", "Actionable", "Hành động", "Next Gap", "Khoảng trống"]
    found_sections = [s for s in required_sections if s.lower() in content.lower()]
    result["stats"]["sections_found"] = found_sections

    if len(found_sections) < 2:
        result["warnings"].append(
            f"⚠️  Chưa có đủ section tổng kết (Truth/Actionable/Gap) — QG #9"
        )

    # 4. Kiểm tra có mốc thời điểm
    date_pattern = re.compile(r'\b\d{1,2}/\d{1,2}/\d{4}\b|\b\d{4}\b')
    dates_found = date_pattern.findall(content)
    result["stats"]["dates_found"] = len(dates_found)

    if not dates_found:
        result["warnings"].append("⚠️  Không tìm thấy mốc thời gian trong file — QG #6")

    # 5. Kiểm tra có trạng thái hiệu lực
    validity_keywords = ["còn hiệu lực", "hết hiệu lực", "đang hiệu lực", "hiệu lực từ"]
    validity_found = any(kw in content.lower() for kw in validity_keywords)
    if not validity_found:
        result["warnings"].append("⚠️  Không thấy ghi nhận trạng thái hiệu lực VB — QG #6")

    # 6. Kiểm tra có lưu vết IPO
    ipo_keywords = ["Input:", "Process:", "Output:", "IPO", "[I]", "[D]", "[C]", "[A]"]
    ipo_found = any(kw in content for kw in ipo_keywords)
    if not ipo_found:
        result["warnings"].append("⚠️  Không thấy lưu vết IPO PDCA — QG #8")

    return result


def print_report(report: dict):
    """In kết quả validate."""
    status = "✅ PASS" if report["passed"] else "❌ FAIL"
    print(f"\n{status}  {report['file']}")
    print(f"  Stats: {report['stats']}")

    if report["errors"]:
        print("  Errors:")
        for e in report["errors"]:
            print(f"    ❌ {e}")

    if report["warnings"]:
        print("  Notes:")
        for w in report["warnings"]:
            print(f"    {w}")


def main():
    parser = argparse.ArgumentParser(description="legalkit-vn SOT Validator")
    parser.add_argument("target", nargs="?", help="File .md hoặc thư mục cần validate")
    parser.add_argument("--dir", "-d", help="Validate tất cả file phase trong thư mục")
    args = parser.parse_args()

    targets = []

    if args.dir:
        d = Path(args.dir)
        targets = sorted(d.glob("legal_phase_*.md"))
        if not targets:
            print(f"Không tìm thấy file legal_phase_*.md trong {d}")
            sys.exit(1)
    elif args.target:
        target = Path(args.target)
        if target.is_dir():
            targets = sorted(target.glob("legal_phase_*.md"))
        else:
            targets = [target]
    else:
        # Tìm trong thư mục hiện tại
        targets = sorted(Path(".").glob("legal_phase_*.md"))
        if not targets:
            print("Không tìm thấy file. Dùng: python sot_validator.py <file.md>")
            sys.exit(1)

    print(f"Validating {len(targets)} file(s)...")
    all_passed = True

    for t in targets:
        report = validate_file(t)
        print_report(report)
        if not report["passed"]:
            all_passed = False

    print(f"\n{'✅ Tất cả file đạt yêu cầu.' if all_passed else '❌ Có file chưa đạt — xem chi tiết ở trên.'}")
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
