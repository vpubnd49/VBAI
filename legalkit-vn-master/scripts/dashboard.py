"""
dashboard.py: legalkit-vn
Generate a premium HTML dashboard for monitoring legal document validity status.
Usage:
    python scripts/dashboard.py
"""

import json
import os
import sys
from pathlib import Path


def generate_dashboard():
    # Cấu hình encoding utf-8 để hiển thị đúng tiếng Việt trên Windows
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except AttributeError:
            pass

    print("🚀 Đang khởi chạy hệ thống tạo lập Dashboard giám sát văn bản...")

    # Thiết lập đường dẫn tệp tin
    base_dir = Path(__file__).resolve().parent.parent
    monitored_laws_path = base_dir / "resources" / "monitored-laws.json"
    output_dir = base_dir / "output"
    output_html_path = output_dir / "dashboard.html"

    # Tạo thư mục output nếu chưa tồn tại
    os.makedirs(output_dir, exist_ok=True)

    # Đọc cơ sở dữ liệu văn bản
    if not monitored_laws_path.exists():
        print(f"❌ Không tìm thấy tệp tin cơ sở dữ liệu: {monitored_laws_path}")
        sys.exit(1)

    with open(monitored_laws_path, "r", encoding="utf-8") as f:
        laws = json.load(f)

    # Tính toán số liệu thống kê
    total_laws = len(laws)
    active_count = sum(1 for l in laws if l["status"] == "active")
    expired_count = sum(1 for l in laws if l["status"] == "expired")
    partial_count = sum(1 for l in laws if l["status"] == "partially_expired")

    # Xây dựng bảng mã màu và văn bản trạng thái
    status_map = {
      "active": {"text": "Còn hiệu lực", "class": "status-active"},
      "expired": {"text": "Hết hiệu lực", "class": "status-expired"},
      "partially_expired": {"text": "Hết hiệu lực một phần", "class": "status-partial"}
    }

    # Bắt đầu sinh cấu trúc mã HTML với thẩm mỹ tối giản Dark Mode
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ thống Giám sát Hiệu lực Văn bản: legalkit-vn</title>
    <!-- Nhúng phông chữ Inter và Outfit từ Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">

    <style>
        :root {{
            --bg-main: #0B0F19;
            --bg-card: rgba(17, 24, 39, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-main: #F3F4F6;
            --text-muted: #9CA3AF;
            --primary: #10B981; /* Emerald */
            --warning: #F59E0B; /* Amber */
            --danger: #EF4444;  /* Red */
            --accent: #3B82F6;  /* Blue Glow */
            --glow-active: rgba(16, 185, 129, 0.15);
            --glow-expired: rgba(239, 68, 68, 0.15);
            --glow-partial: rgba(245, 158, 11, 0.15);
            --font-display: 'Outfit', system-ui, -apple-system, sans-serif;
            --font-body: 'Inter', system-ui, -apple-system, sans-serif;
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            background-color: var(--bg-main);
            color: var(--text-main);
            font-family: var(--font-body);
            line-height: 1.45;
            padding: 40px 20px;
            overflow-x: hidden;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}

        /* Header Style */
        header {{
            margin-bottom: 40px;
            text-align: center;
        }}

        h1 {{
            font-family: var(--font-display);
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #10B981, #3B82F6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
            letter-spacing: -0.02em;
        }}

        .subtitle {{
            color: var(--text-muted);
            font-size: 1.1rem;
            font-weight: 300;
        }}

        /* Stats Grid */
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 45px;
        }}

        .stat-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: transform 0.2s ease, border-color 0.2s ease;
        }}

        .stat-card:hover {{
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.15);
        }}

        .stat-value {{
            font-family: var(--font-display);
            font-size: 2.8rem;
            font-weight: 700;
            margin-bottom: 6px;
        }}

        .stat-label {{
            color: var(--text-muted);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .stat-total {{ color: var(--text-main); }}
        .stat-active {{ color: var(--primary); }}
        .stat-expired {{ color: var(--danger); }}
        .stat-partial {{ color: var(--warning); }}

        /* Filter Controls */
        .controls-bar {{
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
            background: rgba(17, 24, 39, 0.4);
            padding: 16px 24px;
            border-radius: 16px;
            border: 1px solid var(--border-color);
        }}

        .search-wrapper {{
            position: relative;
            flex: 1;
            min-width: 280px;
        }}

        .search-input {{
            width: 100%;
            background: rgba(10, 15, 25, 0.8);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 12px 16px;
            color: var(--text-main);
            font-family: var(--font-body);
            font-size: 0.95rem;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }}

        .search-input:focus {{
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }}

        .filter-buttons {{
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }}

        .btn {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            padding: 10px 18px;
            border-radius: 10px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .btn:hover {{
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-main);
        }}

        .btn.active {{
            background: var(--accent);
            color: white;
            border-color: var(--accent);
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }}

        /* Cards List Grid */
        .laws-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
            gap: 25px;
        }}

        .law-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            backdrop-filter: blur(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}

        /* Glow effects for cards based on state */
        .law-card.active-state:hover {{
            border-color: var(--primary);
            box-shadow: 0 10px 25px -5px var(--glow-active);
            transform: translateY(-4px);
        }}

        .law-card.expired-state:hover {{
            border-color: var(--danger);
            box-shadow: 0 10px 25px -5px var(--glow-expired);
            transform: translateY(-4px);
        }}

        .law-card.partial-state:hover {{
            border-color: var(--warning);
            box-shadow: 0 10px 25px -5px var(--glow-partial);
            transform: translateY(-4px);
        }}

        .law-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }}

        .law-id {{
            font-family: var(--font-display);
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--accent);
            background: rgba(59, 130, 246, 0.1);
            padding: 4px 8px;
            border-radius: 6px;
        }}

        .badge {{
            font-size: 0.8rem;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 20px;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }}

        .badge-active {{
            background: rgba(16, 185, 129, 0.1);
            color: var(--primary);
        }}

        .badge-expired {{
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
        }}

        .badge-partial {{
            background: rgba(245, 158, 11, 0.1);
            color: var(--warning);
        }}

        .law-title {{
            font-family: var(--font-display);
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-main);
            margin-bottom: 12px;
            min-height: 48px;
        }}

        .law-meta {{
            border-top: 1px solid var(--border-color);
            padding-top: 12px;
            margin-top: 16px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 0.85rem;
        }}

        .meta-item span {{
            display: block;
            color: var(--text-muted);
            margin-bottom: 2px;
        }}

        .meta-item strong {{
            color: var(--text-main);
            font-weight: 500;
        }}

        .law-notes {{
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-top: 8px;
            flex-grow: 1;
        }}

        .replacement-info {{
            margin-top: 12px;
            font-size: 0.85rem;
            color: var(--warning);
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(245, 158, 11, 0.05);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(245, 158, 11, 0.1);
        }}

        /* Responsive Layout */
        @media (max-width: 768px) {{
            body {{
                padding: 20px 10px;
            }}
            h1 {{
                font-size: 2rem;
            }}
            .controls-bar {{
                flex-direction: column;
                align-items: stretch;
            }}
            .laws-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Hệ thống Giám sát Hiệu lực Văn bản Pháp luật</h1>
            <div class="subtitle">legalkit-vn: Theo dõi cập nhật, thời điểm hiệu lực và thay thế của các văn bản quy phạm pháp luật cốt lõi</div>
        </header>

        <!-- Stats Section -->
        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-value stat-total">{total_laws}</div>
                <div class="stat-label">Tổng số văn bản</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-active">{active_count}</div>
                <div class="stat-label">Còn hiệu lực</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-expired">{expired_count}</div>
                <div class="stat-label">Đã hết hiệu lực</div>
            </div>
            <div class="stat-card">
                <div class="stat-value stat-partial">{partial_count}</div>
                <div class="stat-label">Hết hiệu lực một phần</div>
            </div>
        </section>

        <!-- Filter and Search Controls -->
        <section class="controls-bar">
            <div class="search-wrapper">
                <input type="text" id="searchInput" class="search-input" placeholder="Tìm kiếm theo số hiệu, tên luật hoặc nội dung...">
            </div>
            <div class="filter-buttons">
                <button class="btn active" onclick="filterLaws('all')">Tất cả</button>
                <button class="btn" onclick="filterLaws('active')">Còn hiệu lực</button>
                <button class="btn" onclick="filterLaws('expired')">Hết hiệu lực</button>
                <button class="btn" onclick="filterLaws('partially_expired')">Hết hiệu lực một phần</button>
            </div>
        </section>

        <!-- Cards List Grid -->
        <main class="laws-grid" id="lawsGrid">
        """

    # Vòng lặp sinh các thẻ card đại diện cho từng văn bản
    for law in laws:
        status_info = status_map.get(law["status"], {"text": "Không xác định", "class": ""})

        # Đặt class trạng thái để kích hoạt glow màu tương ứng lúc hover
        state_class = ""
        badge_class = ""
        if law["status"] == "active":
            state_class = "active-state"
            badge_class = "badge-active"
        elif law["status"] == "expired":
            state_class = "expired-state"
            badge_class = "badge-expired"
        elif law["status"] == "partially_expired":
            state_class = "partial-state"
            badge_class = "badge-partial"

        # Hiển thị thông tin thay thế nếu có
        replacement_tag = ""
        if law["replaced_by"]:
            replacement_tag = f"""
            <div class="replacement-info">
                <span>🔄 Được thay thế bởi văn bản: <strong>{law["replaced_by"]}</strong></span>
            </div>
            """

        html_content += f"""
            <div class="law-card {state_class}" data-status="{law["status"]}">
                <div>
                    <div class="law-header">
                        <span class="law-id">{law["id"]}</span>
                        <span class="badge {badge_class}">{status_info["text"]}</span>
                    </div>
                    <div class="law-title">{law["name"]}</div>
                    <div class="law-notes">{law["notes"]}</div>
                    {replacement_tag}
                </div>
                <div class="law-meta">
                    <div class="meta-item">
                        <span>Ngày hiệu lực:</span>
                        <strong>{law["effective_date"]}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Ngày hết hạn:</span>
                        <strong>{law["expiry_date"] if law["expiry_date"] else "Chưa xác định"}</strong>
                    </div>
                </div>
            </div>
        """

    # Thêm phần kịch bản Javascript bổ sung khả năng lọc và tìm kiếm động ngay tại phía máy khách
    html_content += """
        </main>
    </div>

    <script>
        let currentFilter = 'all';

        function filterLaws(status) {
            currentFilter = status;

            // Cập nhật trạng thái active cho nút bấm lọc
            const buttons = document.querySelectorAll('.btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            applyFilters();
        }

        function applyFilters() {
            const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('.law-card');

            cards.forEach(card => {
                const status = card.getAttribute('data-status');
                const textContent = card.innerText.toLowerCase();

                const matchesStatus = (currentFilter === 'all' || status === currentFilter);
                const matchesSearch = (searchQuery === '' || textContent.includes(searchQuery));

                if (matchesStatus && matchesSearch) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        // Lắng nghe sự kiện gõ phím của thanh tìm kiếm
        document.getElementById('searchInput').addEventListener('input', applyFilters);
    </script>
</body>
</html>
"""

    # Ghi nội dung HTML ra tệp tin
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"✅ Đã tạo thành công Dashboard tại: {output_html_path}")
    print(f"📊 Thống kê: Tổng số {total_laws} văn bản ({active_count} còn hiệu lực, {expired_count} hết hiệu lực, {partial_count} hết hiệu lực một phần).")


if __name__ == "__main__":
    generate_dashboard()
