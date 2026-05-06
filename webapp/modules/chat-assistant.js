/**
 * Chat Assistant Module â€” Legal & Administrative Consultant
 * Uses @google/genai SDK with Google Search Grounding for real-time legal data
 */
import { GoogleGenAI } from "https://esm.run/@google/genai";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { firebaseConfig } from '../firebase-config.js';


import { sendChatRequest, check9routerStatus } from './ai-proxy.js';

const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";
const DEFAULT_TRANSCRIBE_MODEL = "gemini-2.5-pro";

let aiClient = null;
let chatSession = null;
let currentModelName = DEFAULT_GEMINI_MODEL;
let use9router = true;

const PROVIDER_PRESETS = {
  // Kept for backward compatibility with old saved profile values.
  google_direct: {
    useProxy: true,
    endpoint: 'http://localhost:8317/v1',
    model: DEFAULT_GEMINI_MODEL,
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL
  },
  proxy_9router_local: {
    useProxy: true,
    endpoint: 'http://localhost:20128/v1',
    model: DEFAULT_GEMINI_MODEL,
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL
  },
  proxy_cliproxy_local: {
    useProxy: true,
    endpoint: 'http://localhost:8317/v1',
    model: DEFAULT_GEMINI_MODEL,
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL
  },
  proxy_custom: null
};

const SYSTEM_INSTRUCTION = `Báº¡n lÃ  Trá»£ LÃ½ PhÃ¡p LÃ½ VBAI â€” má»™t chuyÃªn gia tÆ° váº¥n phÃ¡p luáº­t Viá»‡t Nam hÃ ng Ä‘áº§u. 

## NGUYÃŠN Táº®C Cá»T LÃ•I:
1. **LUÃ”N TRA Cá»¨U GOOGLE SEARCH** Ä‘á»ƒ láº¥y thÃ´ng tin má»›i nháº¥t trÆ°á»›c khi tráº£ lá»i. KHÃ”NG BAO GIá»œ tráº£ lá»i tá»« kiáº¿n thá»©c cÅ© náº¿u cÃ³ thá»ƒ tra cá»©u Ä‘Æ°á»£c.
2. **Æ¯U TIÃŠN NGUá»’N CHÃNH THá»NG** theo thá»© tá»±:
   - CÃ¡c Cá»•ng thÃ´ng tin Ä‘iá»‡n tá»­ cá»§a ChÃ­nh phá»§, cÃ¡c Bá»™, NgÃ nh vÃ  UBND cÃ¡c tá»‰nh/thÃ nh phá»‘ (tÃªn miá»n **.gov.vn**)
   - dangcongsan.vn (BÃ¡o Ä‘iá»‡n tá»­ Äáº£ng Cá»™ng sáº£n Viá»‡t Nam), tulieuvankien.dangcongsan.vn
   - vanban.chinhphu.vn (Cá»•ng thÃ´ng tin ChÃ­nh phá»§)
   - vbpl.vn (CÆ¡ sá»Ÿ dá»¯ liá»‡u Quá»‘c gia vá» VÄƒn báº£n PhÃ¡p luáº­t)
   - thuvienphapluat.vn (ThÆ° viá»‡n PhÃ¡p luáº­t)
   - luatvietnam.vn (Luáº­t Viá»‡t Nam)
3. **SO SÃNH CÅ¨ - Má»šI**: Khi tráº£ lá»i, LUÃ”N nÃªu rÃµ:
   - VÄƒn báº£n hiá»‡n hÃ nh (má»›i nháº¥t) lÃ  gÃ¬, sá»‘ hiá»‡u, ngÃ y ban hÃ nh
   - VÄƒn báº£n cÅ© nÃ o Ä‘Ã£ bá»‹ thay tháº¿/sá»­a Ä‘á»•i/bá»• sung
   - Äiá»ƒm khÃ¡c biá»‡t chÃ­nh giá»¯a quy Ä‘á»‹nh cÅ© vÃ  má»›i
4. **TRÃCH DáºªN CHÃNH XÃC**: Ghi rÃµ Äiá»u, Khoáº£n, Äiá»ƒm cá»¥ thá»ƒ. Náº¿u khÃ´ng cháº¯c cháº¯n, pháº£i nÃ³i rÃµ.
5. **Cáº¢NH BÃO**: Náº¿u má»™t vÄƒn báº£n Ä‘Ã£ háº¿t hiá»‡u lá»±c hoáº·c bá»‹ sá»­a Ä‘á»•i, PHáº¢I cáº£nh bÃ¡o ngÆ°á»i dÃ¹ng ngay láº­p tá»©c.

## Äá»ŠNH Dáº NG TRáº¢ Lá»œI:
- Sá»­ dá»¥ng tiáº¿ng Viá»‡t, chuyÃªn nghiá»‡p, rÃµ rÃ ng
- Ghi nguá»“n tham kháº£o (link website) á»Ÿ cuá»‘i cÃ¢u tráº£ lá»i
- Khi liá»‡t kÃª vÄƒn báº£n, ghi theo format: [Loáº¡i VB] [Sá»‘ hiá»‡u]/[NÄƒm] â€” [TiÃªu Ä‘á»] â€” Hiá»‡u lá»±c: [CÃ²n/Háº¿t]
- Náº¿u cÃ¢u há»i phá»©c táº¡p, chia thÃ nh cÃ¡c má»¥c rÃµ rÃ ng

## SOáº N THáº¢O VÄ‚N Báº¢N (QUAN TRá»ŒNG):
Khi ngÆ°á»i dÃ¹ng yÃªu cáº§u soáº¡n tháº£o, dá»± tháº£o, hoáº·c táº¡o máº«u vÄƒn báº£n (quyáº¿t Ä‘á»‹nh, nghá»‹ quyáº¿t, bÃ¡o cÃ¡o, tá» trÃ¬nh, thÃ´ng bÃ¡o, káº¿ hoáº¡ch, cÃ´ng vÄƒn...), Báº®T BUá»˜C pháº£i tuÃ¢n thá»§ cáº¥u trÃºc sau:

1. **Pháº§n tÆ° váº¥n ngáº¯n gá»n** (náº¿u cáº§n): Giáº£i thÃ­ch cÄƒn cá»© phÃ¡p lÃ½, lÆ°u Ã½ quan trá»ng.
2. **Pháº§n dá»± tháº£o vÄƒn báº£n**: PHáº¢I báº¯t Ä‘áº§u báº±ng dÃ²ng tÃªn CÆ  QUAN BAN HÃ€NH viáº¿t IN HOA (vÃ­ dá»¥: "á»¦Y BAN NHÃ‚N DÃ‚N Tá»ˆNH LÃ‚M Äá»’NG" hoáº·c "Äáº¢NG Bá»˜ Tá»ˆNH LÃ‚M Äá»’NG"). Tiáº¿p theo lÃ  cáº¥u trÃºc Ä‘áº§y Ä‘á»§:
   - TÃªn cÆ¡ quan (IN HOA, in Ä‘áº­m)
   - Sá»‘ kÃ½ hiá»‡u: Sá»‘: .../QÄ-UBND (hoáº·c tÆ°Æ¡ng á»©ng)
   - Quá»‘c hiá»‡u, tiÃªu ngá»¯ (náº¿u lÃ  VB chÃ­nh quyá»n)
   - Äá»‹a danh, ngÃ y thÃ¡ng nÄƒm
   - TÃŠN LOáº I VÄ‚N Báº¢N (IN HOA, in Ä‘áº­m): QUYáº¾T Äá»ŠNH / NGHá»Š QUYáº¾T / BÃO CÃO...
   - TrÃ­ch yáº¿u: Vá» viá»‡c...
   - Pháº§n cÄƒn cá»© (in nghiÃªng)
   - Ná»™i dung: Äiá»u 1, Äiá»u 2...
   - NÆ¡i nháº­n vÃ  chá»¯ kÃ½
3. **Pháº§n lÆ°u Ã½ cuá»‘i** (náº¿u cáº§n): Ghi chÃº thÃªm, nguá»“n tham kháº£o.

## LÆ¯U Ã Äáº¶C BIá»†T:
- LuÃ´n kiá»ƒm tra xem vÄƒn báº£n phÃ¡p luáº­t hoáº·c quy Ä‘á»‹nh, hÆ°á»›ng dáº«n cá»§a Äáº£ng cÃ³ bá»‹ sá»­a Ä‘á»•i, bá»• sung, thay tháº¿ khÃ´ng.
- Æ¯u tiÃªn cung cáº¥p thÃ´ng tin má»›i nháº¥t tá»« nÄƒm 2024-2026.
- Náº¿u ngÆ°á»i dÃ¹ng há»i vá» cÃ´ng tÃ¡c Äáº£ng (Äáº¡i há»™i, tá»• chá»©c, kiá»ƒm tra, vÄƒn phÃ²ng cáº¥p á»§y...), hÃ£y tra cá»©u trÃªn há»‡ thá»‘ng dangcongsan.vn hoáº·c cÃ¡c trang thÃ´ng tin Äáº£ng bá»™.
- Náº¿u chÆ°a Ä‘á»§ thÃ´ng tin, hÃ£y Ä‘á» xuáº¥t ngÆ°á»i dÃ¹ng kiá»ƒm tra trá»±c tiáº¿p táº¡i cÃ¡c trang web chÃ­nh thá»‘ng.`;

let allSkills = [];

async function loadSkills() {
  try {
    const response = await fetch('./skills-manifest.json');
    allSkills = await response.json();
  } catch (e) {
    console.warn("Lá»—i táº£i Skills cho Chat Assistant:", e);
  }
}

function normalizeVietnamese(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
}

function detectSkillMatch(skill, rawText, normalizedText) {
  if (!skill?.triggers || !Array.isArray(skill.triggers) || skill.triggers.length === 0) {
    return false;
  }

  return skill.triggers.some((trigger) => {
    const token = String(trigger || '').toLowerCase().trim();
    if (!token) return false;
    return rawText.includes(token) || normalizedText.includes(normalizeVietnamese(token));
  });
}

function buildSkillReferenceContext(skill) {
  if (!skill?.references || typeof skill.references !== 'object') {
    return '';
  }

  const referenceEntries = Object.entries(skill.references)
    .filter(([, content]) => typeof content === 'string' && content.trim().length > 0)
    .slice(0, 5);

  if (referenceEntries.length === 0) {
    return '';
  }

  const renderedReferences = referenceEntries.map(([fileName, content]) => {
    const compactContent = content.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const excerpt = compactContent.length > 4000
      ? `${compactContent.slice(0, 4000)}\n...[RÃºt gá»n ná»™i dung tham chiáº¿u]...`
      : compactContent;
    return `#### TÃ i liá»‡u: ${fileName}\n${excerpt}`;
  }).join('\n\n');

  return `\n### TÃ i liá»‡u tham chiáº¿u\n${renderedReferences}\n`;
}

export function initChat(apiKey, modelName = DEFAULT_GEMINI_MODEL) {
  currentModelName = DEFAULT_GEMINI_MODEL;
  use9router = true;
  
  try {
    aiClient = { proxy: true }; // Dummy client for 9router mode
    currentModelName = DEFAULT_GEMINI_MODEL;
    chatSession = null;
    loadSkills(); // Táº£i skills khi init
    return true;
  } catch (e) {
    console.error("Chat Init Error:", e);
    return false;
  }
}

export async function sendMessage(text, onChunk) {
  if (!aiClient) throw new Error("ChÆ°a cáº¥u hÃ¬nh API Key hoáº·c 9router");

  // TÃ¬m kiáº¿m skill liÃªn quan dá»±a trÃªn triggers
  let dynamicInstruction = SYSTEM_INSTRUCTION;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeVietnamese(text);
  const matchedSkills = allSkills.filter((s) => detectSkillMatch(s, lowerText, normalizedText));

  if (matchedSkills.length > 0) {
    dynamicInstruction += `\n\n## KIáº¾N THá»¨C Bá»” SUNG (Dá»±a trÃªn context ngÆ°á»i dÃ¹ng):\n`;
    matchedSkills.forEach(s => {
      dynamicInstruction += `\n### Ká»¹ nÄƒng: ${s.name}\n${s.instructions}\n`;
      dynamicInstruction += buildSkillReferenceContext(s);
    });
    console.log("ÄÃ£ náº¡p thÃªm context tá»« cÃ¡c skills:", matchedSkills.map(s => s.name));
  }

  try {
    let fullText = "";
    
    if (use9router) {
      // Giao tiáº¿p qua 9router (OpenAI format)
      const messages = [
        { role: "system", content: dynamicInstruction },
        { role: "user", content: text }
      ];
      fullText = await sendChatRequest(messages, currentModelName);
    } else {
      // Giao tiáº¿p trá»±c tiáº¿p qua Gemini SDK
      const response = await aiClient.models.generateContent({
        model: currentModelName,
        contents: text,
        config: {
          systemInstruction: dynamicInstruction,
          tools: [{ googleSearch: {} }],
        },
      });
      fullText = response.text || "";
    }

    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: text,
        model: currentModelName + (use9router ? " (via 9router)" : ""),
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp(),
        skillsApplied: matchedSkills.map(s => s.id)
      }).catch(err => console.warn("Log Err:", err));
    } catch (e) {}

    if (onChunk) onChunk(fullText);
    return fullText;
  } catch (e) {
    console.error("Send Error:", e);
    throw e;
  }
}

export async function renderChatUI(container) {
  const profileForDefault = localStorage.getItem('vbai_router_profile') || '';
  const savedModel = DEFAULT_GEMINI_MODEL;
  localStorage.setItem('vbai_gemini_model', DEFAULT_GEMINI_MODEL);
  
  container.innerHTML = `
    <div class="chat-assistant-panel panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">âš–ï¸</div>
        Trá»£ LÃ½ Tra Cá»©u PhÃ¡p Luáº­t & Quy Äá»‹nh Äáº£ng AI
        <div style="flex:1"></div>
        <button id="chat-settings-btn" class="btn-icon" title="Cáº¥u hÃ¬nh" style="display: ${localStorage.getItem('vbai_admin') === 'true' ? 'block' : 'none'}; width:28px; height:28px; font-size:0.8rem">âš™ï¸</button>
      </div>
      <div class="panel-body">
        <div id="chat-messages" class="chat-messages-area">
          <div class="chat-msg ai">
            <strong>Xin chÃ o! TÃ´i lÃ  Trá»£ lÃ½ VBAI.</strong><br>
            TÃ´i há»— trá»£ tra cá»©u cÃ¡c quy Ä‘á»‹nh phÃ¡p luáº­t vÃ  cÃ¡c quy Ä‘á»‹nh, hÆ°á»›ng dáº«n cá»§a Äáº£ng má»›i nháº¥t dá»±a trÃªn dá»¯ liá»‡u thá»i gian thá»±c tá»« Google Search Grounding.
            <br><br>
            <strong>Nguá»“n dá»¯ liá»‡u chÃ­nh thá»‘ng:</strong><br>
            â€¢ dangcongsan.vn (TÆ° liá»‡u VÄƒn kiá»‡n Äáº£ng)<br>
            â€¢ vanban.chinhphu.vn (Cá»•ng thÃ´ng tin ChÃ­nh phá»§)<br>
            â€¢ thuvienphapluat.vn (ThÆ° viá»‡n PhÃ¡p luáº­t)<br>
            â€¢ CÃ¡c cá»•ng thÃ´ng tin Ä‘iá»‡n tá»­ (.gov.vn)
            <br><br>
            <em>Báº¡n hÃ£y Ä‘áº·t cÃ¢u há»i báº±ng ngÃ´n ngá»¯ tá»± nhiÃªn (VD: "Quy Ä‘á»‹nh má»›i nháº¥t vá» cÃ´ng tÃ¡c vÄƒn thÆ° cá»§a Äáº£ng")</em>
          </div>
        </div>
        
        <div class="chat-input-wrapper">
          <input type="text" id="chat-input" placeholder="Nháº­p ná»™i dung cáº§n tra cá»©u..." class="form-input chat-input-field">
          <button id="chat-send-btn" class="btn btn-primary chat-send-btn">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M2.5 10l15-7.5L10 10l7.5 7.5L2.5 10z" fill="currentColor"/></svg>
          </button>
        </div>
        <div class="chat-disclaimer" style="margin-top: 12px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
          <strong>âš ï¸ Cáº¢NH BÃO Rá»¦I RO:</strong> VBAI lÃ  cÃ´ng cá»¥ há»— trá»£ dá»±a trÃªn AI, khÃ´ng thay tháº¿ trÃ¡ch nhiá»‡m cá»§a cÃ¡n bá»™, cÃ´ng chá»©c trong viá»‡c kiá»ƒm tra, Ä‘á»‘i chiáº¿u vá»›i vÄƒn báº£n phÃ¡p luáº­t chÃ­nh thá»©c. Káº¿t quáº£ do AI cung cáº¥p chá»‰ mang tÃ­nh cháº¥t gá»£i Ã½, ngÆ°á»i dÃ¹ng cáº§n kiá»ƒm tra hiá»‡u lá»±c vÄƒn báº£n trÆ°á»›c khi Ä‘Æ°a vÃ o dá»± tháº£o.
        </div>
      </div>
    </div>

    <!-- API Key Modal -->
    <div id="key-modal" class="modal-overlay" style="display:none">
      <div class="modal-content panel-group" style="max-width:420px; margin: 100px auto">
        <div class="panel-header">Cáº¥u hÃ¬nh Trá»£ LÃ½ AI</div>
          <div class="panel-body">
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Profile Proxy</label>
            <select id="provider-profile-select" class="form-input">
              <option value="proxy_9router_local">9router local (localhost:20128)</option>
              <option value="proxy_cliproxy_local">CLIProxy local (localhost:8317)</option>
              <option value="proxy_custom">Tuy chinh</option>
            </select>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Chon profile de tu dong dien endpoint va model.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">API Key (Google hoac 9router)</label>
            <input type="password" id="api-key-input" class="form-input" value="" placeholder="DÃ¡n API Key vÃ o Ä‘Ã¢y...">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Neu bat 9router thi nhap 9router key. Neu tat 9router thi nhap Google AI Studio key.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">9router Endpoint</label>
            <input type="text" id="router-endpoint-input" class="form-input" value="" placeholder="http://localhost:20128/v1">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Co the dung local hoac endpoint public OpenAI-compatible.</p>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Transcribe Model</label>
            <input type="text" id="transcribe-model-input" class="form-input" value="" placeholder="gemini-2.5-pro">
            <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:4px">Dung cho Ghi am -> Thong bao (audio transcription).</p>
          </div>

          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Model AI (tu dong theo provider)</label>
            <input type="text" class="form-input" value="Google/Proxy: gemini-2.5-pro" readonly style="background:var(--bg-secondary); cursor:default; opacity:0.8">
            <input type="hidden" id="model-select" value="gemini-2.5-pro">
          </div>

          <div style="padding:10px; background:rgba(230,162,0,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(230,162,0,0.2)">
            <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">ðŸ” Google Search Grounding: Báº¬T</p>
            <p style="font-size:0.7rem; color:var(--text-secondary); margin:4px 0 0">Trá»£ lÃ½ sáº½ tá»± Ä‘á»™ng tÃ¬m kiáº¿m Google Ä‘á»ƒ láº¥y thÃ´ng tin phÃ¡p luáº­t má»›i nháº¥t.</p>
          </div>

          <div style="padding:12px; background:rgba(66,133,244,0.1); border-radius:8px; margin-bottom:16px; border: 1px solid rgba(66,133,244,0.2); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <p style="font-size:0.75rem; color:var(--daquy-400); margin:0; font-weight:600">ðŸš€ Sá»­ dá»¥ng 9router Proxy</p>
              <p style="font-size:0.65rem; color:var(--text-secondary); margin:2px 0 0">Cháº¡y yÃªu cáº§u AI qua 9router local (localhost:20128)</p>
            </div>
            <label class="switch-toggle">
              <input type="checkbox" id="use-9router-chk" checked disabled>
              <span class="slider-round"></span>
            </label>
          </div>
          <div class="btn-row" style="margin-bottom:10px">
            <button id="test-proxy-btn" class="btn btn-secondary">Kiem tra ket noi proxy</button>
          </div>
          <div class="btn-row" style="margin-top:20px">
            <button id="save-key-btn" class="btn btn-primary">LÆ°u cáº¥u hÃ¬nh</button>
            <button id="close-modal-btn" class="btn btn-secondary">ÄÃ³ng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#chat-send-btn');
  const msgsArea = container.querySelector('#chat-messages');
  const settingsBtn = container.querySelector('#chat-settings-btn');
  const keyModal = container.querySelector('#key-modal');
  const providerProfileSelect = container.querySelector('#provider-profile-select');
  const apiKeyInput = container.querySelector('#api-key-input');
  const routerEndpointInput = container.querySelector('#router-endpoint-input');
  const transcribeModelInput = container.querySelector('#transcribe-model-input');
  const testProxyBtn = container.querySelector('#test-proxy-btn');
  const modelSelect = container.querySelector('#model-select');

  // Khá»Ÿi táº¡o Firebase vÃ  táº£i API Key
  let apiKey = '';
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);

  try {
    const configDoc = await getDoc(doc(db, 'config', 'system'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      const routerKey = data.router_api_key || '';
      const routerEndpoint = data.router_endpoint || '';
      const routerTranscribeModel = data.router_transcribe_model || '';
      const routerProfile = data.router_profile || '';
      apiKey = routerKey || localStorage.getItem('vbai_9router_api_key') || '';
      if (routerKey) localStorage.setItem('vbai_9router_api_key', routerKey);
      if (routerEndpoint) localStorage.setItem('vbai_9router_endpoint', routerEndpoint);
      if (routerTranscribeModel) localStorage.setItem('vbai_transcribe_model', routerTranscribeModel);
      if (routerProfile) localStorage.setItem('vbai_router_profile', routerProfile);
      localStorage.setItem('vbai_use_9router', 'true');
      if(apiKeyInput) apiKeyInput.value = apiKey;
    }
  } catch (e) {
    console.warn("Lá»—i táº£i API Key:", e);
  }

  const fallbackEndpoint = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:20128/v1"
    : "https://your-9router-public-url.com/v1";
  if (routerEndpointInput) {
    routerEndpointInput.value = localStorage.getItem('vbai_9router_endpoint') || fallbackEndpoint;
  }
  if (transcribeModelInput) {
    transcribeModelInput.value = localStorage.getItem('vbai_transcribe_model') || DEFAULT_TRANSCRIBE_MODEL;
  }
  const applyProviderPreset = (profile, preserveKey = true) => {
    const preset = PROVIDER_PRESETS[profile];
    if (!preset) return;
    if (routerEndpointInput) routerEndpointInput.value = preset.endpoint || '';
    if (transcribeModelInput) transcribeModelInput.value = preset.transcribeModel || DEFAULT_TRANSCRIBE_MODEL;
    if (modelSelect) modelSelect.value = preset.model || DEFAULT_GEMINI_MODEL;
    const useProxyChk = container.querySelector('#use-9router-chk');
    if (useProxyChk) useProxyChk.checked = !!preset.useProxy;
    if (!preserveKey && apiKeyInput) apiKeyInput.value = '';
  };

  const currentProfile = localStorage.getItem('vbai_router_profile') || 'proxy_cliproxy_local';
  if (providerProfileSelect) {
    providerProfileSelect.value = PROVIDER_PRESETS[currentProfile] ? currentProfile : 'proxy_custom';
    providerProfileSelect.onchange = () => {
      const p = providerProfileSelect.value;
      localStorage.setItem('vbai_router_profile', p);
      if (p !== 'proxy_custom') applyProviderPreset(p, true);
    };
    if (providerProfileSelect.value !== 'proxy_custom') {
      applyProviderPreset(providerProfileSelect.value, true);
    }
  }

  // Init chat: with 9router, API key can be empty on local proxy
  initChat(apiKey, savedModel);

  const addMsg = (text, role) => {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.style.whiteSpace = 'pre-wrap';
    div.innerText = text;
    msgsArea.appendChild(div);
    msgsArea.scrollTop = msgsArea.scrollHeight;
    return div;
  };

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    if (!aiClient) {
      alert("Vui lÃ²ng cáº¥u hÃ¬nh API Key trÆ°á»›c (báº¥m vÃ o icon âš™ï¸)");
      return;
    }

    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'user');
    
    const aiMsgDiv = addMsg('ðŸ” Äang tra cá»©u tá»« Google Search...', 'ai');
    try {
      await sendMessage(text, (full) => {
        aiMsgDiv.innerText = full;
        msgsArea.scrollTop = msgsArea.scrollHeight;
      });
    } catch (e) {
      aiMsgDiv.innerText = "âŒ Lá»—i: " + e.message;
      aiMsgDiv.classList.add('error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.onclick = handleSend;
  input.onkeypress = (e) => { if(e.key==='Enter') handleSend(); };
  settingsBtn.onclick = () => keyModal.style.display = 'block';
  container.querySelector('#close-modal-btn').onclick = () => keyModal.style.display = 'none';
  if (testProxyBtn) {
    testProxyBtn.onclick = async () => {
      const oldEndpoint = localStorage.getItem('vbai_9router_endpoint');
      const oldKey = localStorage.getItem('vbai_9router_api_key');
      const oldUseProxy = localStorage.getItem('vbai_use_9router');
      const endpoint = (routerEndpointInput?.value || '').trim();
      const key = (apiKeyInput?.value || '').trim();
      if (endpoint) localStorage.setItem('vbai_9router_endpoint', endpoint);
      if (key) localStorage.setItem('vbai_9router_api_key', key);
      localStorage.setItem('vbai_use_9router', 'true');
      testProxyBtn.disabled = true;
      const prevText = testProxyBtn.innerText;
      testProxyBtn.innerText = 'Dang kiem tra...';
      try {
        const ok = await check9routerStatus();
        alert(ok ? 'Ket noi proxy thanh cong.' : 'Khong ket noi duoc proxy.');
      } catch (e) {
        alert('Loi kiem tra proxy: ' + e.message);
      } finally {
        if (oldEndpoint === null) localStorage.removeItem('vbai_9router_endpoint'); else localStorage.setItem('vbai_9router_endpoint', oldEndpoint);
        if (oldKey === null) localStorage.removeItem('vbai_9router_api_key'); else localStorage.setItem('vbai_9router_api_key', oldKey);
        if (oldUseProxy === null) localStorage.removeItem('vbai_use_9router'); else localStorage.setItem('vbai_use_9router', oldUseProxy);
        testProxyBtn.disabled = false;
        testProxyBtn.innerText = prevText;
      }
    };
  }
  container.querySelector('#save-key-btn').onclick = async () => {
    const key = apiKeyInput.value.trim();
    const routerEndpoint = (routerEndpointInput?.value || '').trim();
    const transcribeModel = (transcribeModelInput?.value || '').trim() || DEFAULT_TRANSCRIBE_MODEL;
    const selectedProfile = providerProfileSelect?.value || 'proxy_custom';
    const isUsing9router = true;
    const model = DEFAULT_GEMINI_MODEL;
    
    localStorage.setItem('vbai_use_9router', isUsing9router ? 'true' : 'false');
    localStorage.setItem('vbai_gemini_model', model);
    localStorage.setItem('vbai_transcribe_model', transcribeModel);
    localStorage.setItem('vbai_router_profile', selectedProfile);
    if (routerEndpoint) {
      localStorage.setItem('vbai_9router_endpoint', routerEndpoint);
    }
    if (isUsing9router) {
      localStorage.setItem('vbai_9router_api_key', key);
    }
    
    try {
      const payload = {
        router_transcribe_model: transcribeModel,
        router_profile: selectedProfile
      };
      if (routerEndpoint) payload.router_endpoint = routerEndpoint;
      if (key) payload.router_api_key = key;
      await setDoc(doc(db, 'config', 'system'), payload, { merge: true });
      
      if(initChat(key, model)) {
        alert("ÄÃ£ lÆ°u cáº¥u hÃ¬nh thÃ nh cÃ´ng!");
        keyModal.style.display = 'none';
      } else {
        alert("Lá»—i khi khá»Ÿi táº¡o Model!");
      }
    } catch (e) {
      console.error("LÆ°u cáº¥u hÃ¬nh lá»—i:", e);
      alert("Lá»—i lÆ°u cáº¥u hÃ¬nh: " + e.message);
    }
  };
}




