import sys
import re

path = r'c:\Users\user\OneDrive\HSCV\Antigravity\VBAI\webapp\modules\chat-assistant.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix duplicates in save logic
content = re.sub(r'const googleSearchKey = googleKeyInput\?\.value\.trim\(\) \|\| \'\';\s+const googleSearchCx = googleCxInput\?\.value\.trim\(\) \|\| \'\';\s+const googleSearchKey = googleKeyInput\?\.value\.trim\(\) \|\| \'\';\s+const googleSearchCx = googleCxInput\?\.value\.trim\(\) \|\| \'\';', 
                 r"const googleSearchKey = googleKeyInput?.value.trim() || '';\n    const googleSearchCx = googleCxInput?.value.trim() || '';", content)

content = re.sub(r'if \(googleSearchKey\) payload\.google_search_key = googleSearchKey;\s+if \(googleSearchCx\) payload\.google_search_cx = googleSearchCx;\s+if \(googleSearchKey\) payload\.google_search_key = googleSearchKey;\s+if \(googleSearchCx\) payload\.google_search_cx = googleSearchCx;',
                 r"if (googleSearchKey) payload.google_search_key = googleSearchKey;\n      if (googleSearchCx) payload.google_search_cx = googleSearchCx;", content)

# Fix Modal UI
modal_old = """          <div style="padding:12px; background:rgba(230,162,0,0.1); border-radius:10px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2); display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🔍 Web Search qua 9router</p>
              <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Bat de model OpenAI co the tra cuu du lieu moi qua tool web search (neu 9router ho tro).</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-web-search-chk" ${(localStorage.getItem('vbai_proxy_web_search') ?? 'true') !== 'false' ? 'checked' : ''}>
              <span class="slider-round"></span>
            </label>
          </div>"""

modal_new = """          <div style="padding:12px; background:rgba(230,162,0,0.1); border-radius:10px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2); display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">🔍 Web Search (Google/DuckDuckGo)</p>
              <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Tự động tra cứu thông tin mới từ Internet khi cần thiết.</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-web-search-chk" ${(localStorage.getItem('vbai_proxy_web_search') ?? 'true') !== 'false' ? 'checked' : ''}>
              <span class="slider-round"></span>
            </label>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google Search API Key (Ưu tiên)</label>
            <input type="password" id="google-search-key-input" class="form-input" value="${localStorage.getItem('vbai_google_search_key') || ''}" placeholder="AIza...">
            <p style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px">Dùng Google API chính thống. Để trống để dùng DuckDuckGo miễn phí thông qua proxy.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Google Search Engine ID (CX)</label>
            <input type="text" id="google-search-cx-input" class="form-input" value="${localStorage.getItem('vbai_google_search_cx') || ''}" placeholder="Ví dụ: 789...:abc...">
          </div>"""

content = content.replace(modal_old, modal_new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
