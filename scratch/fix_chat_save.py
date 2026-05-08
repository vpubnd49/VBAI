import sys
import re

path = r'c:\Users\user\OneDrive\HSCV\Antigravity\VBAI\webapp\modules\chat-assistant.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add missing localStorage saves
old_save = """    localStorage.setItem('vbai_proxy_web_search', useProxyWebSearch ? 'true' : 'false');
    localStorage.setItem('vbai_proxy_profile_chat', profileChat);"""

new_save = """    localStorage.setItem('vbai_proxy_web_search', useProxyWebSearch ? 'true' : 'false');
    localStorage.setItem('vbai_google_search_key', googleSearchKey);
    localStorage.setItem('vbai_google_search_cx', googleSearchCx);
    localStorage.setItem('vbai_proxy_profile_chat', profileChat);"""

content = content.replace(old_save, new_save)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
