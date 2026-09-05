/**
 * VB Hành Chính NĐ30 Module
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType, Header, PageNumber } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from './ui-utils.js';


import { sendChatRequest } from './ai-proxy.js';


const LOAI_VB = {
  nghi_quyet:'NGHỊ QUYẾT', quyet_dinh:'QUYẾT ĐỊNH', chi_thi:'CHỈ THỊ',
  quy_che:'QUY CHẾ', quy_dinh:'QUY ĐỊNH', thong_bao:'THÔNG BÁO',
  huong_dan:'HƯỚNG DẪN', chuong_trinh:'CHƯƠNG TRÌNH', ke_hoach:'KẾ HOẠCH',
  bao_cao:'BÁO CÁO', to_trinh:'TỜ TRÌNH', cong_van:'Công văn',
  giay_moi:'GIẤY MỜI', hop_dong:'HỢP ĐỒNG', cong_dien:'CÔNG ĐIỆN',
  bien_ban:'BIÊN BẢN',
};
const L = { PAGE:{width:11906,height:16838}, MARGIN:{top:1134,bottom:1134,left:1701,right:1134}, FONT:'Times New Roman', CW:9071 };
const BN = {top:{style:BorderStyle.NONE,size:0,color:'auto'},bottom:{style:BorderStyle.NONE,size:0,color:'auto'},left:{style:BorderStyle.NONE,size:0,color:'auto'},right:{style:BorderStyle.NONE,size:0,color:'auto'},insideHorizontal:{style:BorderStyle.NONE,size:0,color:'auto'},insideVertical:{style:BorderStyle.NONE,size:0,color:'auto'}};
const BS = {before:120,after:0,line:340,lineRule:LineRuleType.AT_LEAST};

let fs = {};

export function renderVBND30(container) {
  const now = new Date();
  fs = { step:1, loai_van_ban:'thong_bao', co_quan_chu_quan:'', co_quan_ban_hanh:'', so_ky_hieu:'', dia_danh:'Lâm Đồng', ngay:String(now.getDate()).padStart(2, '0'),thang:String(now.getMonth() + 1).padStart(2, '0'),nam:String(now.getFullYear()), trich_yeu:'', noi_dung:'', quyen_han_ky:'Ký trực tiếp', chuc_vu_ky:'', nguoi_ky:'', noi_nhan:'', kinh_gui:'', can_cu:'', dong_chuc_danh_1:'', dong_chuc_danh_2:'', dong_chuc_danh_3:'' };
  doRender(container);
}

function doRender(c) {
  c.innerHTML = `
    <div class="page-header">
      <div class="page-title">📋 Soạn VB Hành Chính (NĐ30)</div>
      <div class="page-subtitle">Chuẩn Nghị định 30/2020/NĐ-CP</div>
    </div>
    <div class="steps-bar" style="display:flex; align-items:center;">
      ${[1,2,3,4].map(i=>`<button class="step-indicator ${fs.step===i?'active':fs.step>i?'completed':''}" data-step="${i}"><span class="step-num">${fs.step>i?'✓':i}</span><span>${['Loại VB','Thông tin','Nội dung','Xem & Tải'][i-1]}</span></button>`).join('')}
      <button class="btn btn-secondary" onclick="window.location.reload();" style="margin-left:auto; display:flex; align-items:center; gap:6px; padding:6px 12px; font-size:12px; border-radius:6px;" title="Làm mới form nhập liệu">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        Làm mới
      </button>
    </div>
    <div id="sc" class="section-card"></div>`;
  c.querySelectorAll('.step-indicator').forEach(b=>b.addEventListener('click',()=>{const st=+b.dataset.step;if(st<=fs.step){fs.step=st;doRender(c);}}));
  const sc=c.querySelector('#sc');
  [renderS1,renderS2,renderS3,renderS4][fs.step-1](sc,c);
}

function renderS1(sc,c) {
  sc.innerHTML=`<div class="section-title">📝 Chọn loại VB hành chính</div><div class="form-grid"><div class="form-group span-2"><label class="form-label">Loại văn bản <span class="required">*</span></label><select class="form-select" id="fl">${Object.entries(LOAI_VB).map(([k,v])=>`<option value="${k}" ${fs.loai_van_ban===k?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="btn-row"><button class="btn btn-primary" id="bn">Tiếp theo →</button></div>`;
  sc.querySelector('#fl').onchange=e=>{fs.loai_van_ban=e.target.value};
  sc.querySelector('#bn').onclick=()=>{fs.step=2;doRender(c)};
}

function renderS2(sc,c) {
  sc.innerHTML=`
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">🏛️</div>
        Định danh cơ quan
      </div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">CQ chủ quản</label><input class="form-input" id="f1" value="${fs.co_quan_chu_quan}" placeholder="UBND"></div>
        <div class="form-group"><label class="form-label">CQ ban hành <span class="required">*</span></label><input class="form-input" id="f2" value="${fs.co_quan_ban_hanh}" placeholder="VĂN PHÒNG"></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">📅</div>
        Thời gian & Ký hiệu
      </div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">Số ký hiệu</label><input class="form-input" id="f3" value="${fs.so_ky_hieu}" placeholder="Số: /TB-TCCB"></div>
        <div class="form-group"><label class="form-label">Địa danh</label><input class="form-input" id="f4" value="${fs.dia_danh}"></div>
        <div class="form-group"><label class="form-label">Ngày</label><input class="form-input" id="f5" value="${fs.ngay}" placeholder="17"></div>
        <div class="form-group"><label class="form-label">Tháng / Năm</label><div style="display:flex;gap:8px"><input class="form-input" id="f6" value="${fs.thang}" placeholder="03" style="flex:1"><input class="form-input" id="f7" value="${fs.nam}" style="flex:1"></div></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">📄</div>
        Nội dung cốt lõi
      </div>
      <div class="panel-body form-grid full">
        <div class="form-group"><label class="form-label">Trích yếu <span class="required">*</span></label><input class="form-input" id="f8" value="${fs.trich_yeu}" placeholder="kết luận của Vụ trưởng tại cuộc họp giao ban"></div>
      </div>
    </div>
    
    <div class="btn-row"><button class="btn btn-secondary" id="bb">← Quay lại</button><button class="btn btn-primary" id="bn">Tiếp theo →</button></div>`;
  const sv=()=>{fs.co_quan_chu_quan=sc.querySelector('#f1').value;fs.co_quan_ban_hanh=sc.querySelector('#f2').value;fs.so_ky_hieu=sc.querySelector('#f3').value;fs.dia_danh=sc.querySelector('#f4').value;fs.ngay=sc.querySelector('#f5').value;fs.thang=sc.querySelector('#f6').value;fs.nam=sc.querySelector('#f7').value;fs.trich_yeu=sc.querySelector('#f8').value};
  sc.querySelector('#bb').onclick=()=>{sv();fs.step=1;doRender(c)};
  sc.querySelector('#bn').onclick=()=>{sv();if(!fs.co_quan_ban_hanh){showToast('Nhập CQ ban hành','error');return}fs.step=3;doRender(c)};
}

function renderS3(sc,c) {
  const isKG=fs.loai_van_ban==='cong_van'||fs.loai_van_ban==='to_trinh'||fs.loai_van_ban==='bao_cao';
  sc.innerHTML=`
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">📝</div>
        Nội dung & Thông tin phụ
      </div>
      <div class="panel-body form-grid full">
        ${isKG?`<div class="form-group"><label class="form-label">Kính gửi</label><input class="form-input" id="fkg" value="${fs.kinh_gui}" placeholder="Các đơn vị/cá nhân nhận (cách nhau dấu ;)"></div>`:''}
        
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Căn cứ</label>
            <button id="btn-ai-draft-basis" class="btn-primary" style="padding: 4px 10px; font-size: 11px; background: #8b5cf6; border-color: #8b5cf6; border-radius: 4px; display: flex; align-items: center; gap: 4px;">✨ AI Tìm căn cứ</button>
          </div>
          <textarea class="form-textarea" id="fcc" rows="3">${fs.can_cu}</textarea>
        </div>
        
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Nội dung <span class="required">*</span></label>
            <button id="btn-ai-draft-content" class="btn-primary" style="padding: 4px 10px; font-size: 11px; background: #8b5cf6; border-color: #8b5cf6; border-radius: 4px; display: flex; align-items: center; gap: 4px;">✨ AI Soạn thảo</button>
          </div>
          <textarea class="form-textarea" id="fnd" rows="8">${fs.noi_dung}</textarea>
        </div>
        
        <div class="form-group"><label class="form-label">Nơi nhận</label><textarea class="form-textarea" id="fnn" rows="3">${fs.noi_nhan}</textarea></div>
      </div>
    </div>
  
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">✍️</div>
        Thẩm Quyền Ký
      </div>
      <div class="panel-body form-grid">
        <div class="form-group span-2"><label class="form-label">Người ký <span class="required">*</span></label><input class="form-input" id="fnk" value="${fs.nguoi_ky}" placeholder="VD: Nguyễn Văn A"></div>
        <div class="form-group"><label class="form-label">Chức vụ</label><input class="form-input" id="fcv" value="${fs.chuc_vu_ky}" placeholder="VD: Chủ tịch"></div>
        <div class="form-group"><label class="form-label">Chế độ ký</label><select class="form-select" id="fqh">
          <option ${fs.quyen_han_ky==='Ký trực tiếp'?'selected':''}>Ký trực tiếp</option>
          <option ${fs.quyen_han_ky==='TM. (Thay mặt)'?'selected':''}>TM. (Thay mặt)</option>
          <option ${fs.quyen_han_ky==='KT. (Ký thay)'?'selected':''}>KT. (Ký thay)</option>
          <option ${fs.quyen_han_ky==='TL. (Thừa lệnh)'?'selected':''}>TL. (Thừa lệnh)</option>
          <option ${fs.quyen_han_ky==='TUQ. (Thừa ủy quyền)'?'selected':''}>TUQ. (Thừa ủy quyền)</option>
          <option ${fs.quyen_han_ky==='Q. (Quyền)'?'selected':''}>Q. (Quyền)</option>
        </select></div>
        
        <div class="span-2" style="margin-top: 16px; margin-bottom: 8px; font-weight: 700; font-size: 0.8rem; color: var(--daquy-500); text-transform: uppercase;">Dòng chức danh (Tối đa 3 dòng)</div>
        <div class="form-group span-2"><label class="form-label">Dòng 1</label><input class="form-input" id="fdcd1" value="${fs.dong_chuc_danh_1}" placeholder="VD: TM. ỦY BAN NHÂN DÂN"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 2</label><input class="form-input" id="fdcd2" value="${fs.dong_chuc_danh_2}" placeholder="VD: KT. CHỦ TỊCH"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 3</label><input class="form-input" id="fdcd3" value="${fs.dong_chuc_danh_3}" placeholder="VD: PHÓ CHỦ TỊCH"></div>
      </div>
    </div>
  
  <div class="btn-row"><button class="btn btn-secondary" id="bb">← Quay lại</button><button class="btn btn-primary" id="bn">Xem trước →</button></div>`;
  const sv=()=>{const el=sc.querySelector('#fkg');if(el)fs.kinh_gui=el.value;fs.can_cu=sc.querySelector('#fcc').value;fs.noi_dung=sc.querySelector('#fnd').value;fs.quyen_han_ky=sc.querySelector('#fqh').value;fs.chuc_vu_ky=sc.querySelector('#fcv').value;fs.nguoi_ky=sc.querySelector('#fnk').value;fs.noi_nhan=sc.querySelector('#fnn').value;fs.dong_chuc_danh_1=sc.querySelector('#fdcd1').value;fs.dong_chuc_danh_2=sc.querySelector('#fdcd2').value;fs.dong_chuc_danh_3=sc.querySelector('#fdcd3').value;};
  sc.querySelector('#bb').onclick=()=>{sv();fs.step=2;doRender(c)};
  sc.querySelector('#bn').onclick=()=>{sv();if(!fs.noi_dung){showToast('Nhập nội dung','error');return}fs.step=4;doRender(c)};

  const btnAiDraft = sc.querySelector('#btn-ai-draft-content');
  if (btnAiDraft) {
    btnAiDraft.onclick = async () => {
      if (!fs.trich_yeu) {
        showToast('Vui lòng quay lại Bước 2 nhập Trích yếu trước khi soạn thảo bằng AI', 'error');
        return;
      }
      btnAiDraft.disabled = true;
      btnAiDraft.textContent = '⏳ Đang soạn...';
      try {
        const typeText = LOAI_VB[fs.loai_van_ban] || 'văn bản';
        const systemPrompt = `Bạn là Trợ lý soạn thảo văn bản hành chính chuyên nghiệp theo chuẩn Việt Nam.
Nhiệm vụ của bạn là soạn thảo PHẦN NỘI DUNG CHÍNH (thân văn bản) cho một văn bản hành chính.
Thông tin văn bản:
- Loại văn bản: ${typeText}
- Cơ quan ban hành: ${fs.co_quan_ban_hanh || 'Cơ quan hành chính'}
- Trích yếu nội dung: ${fs.trich_yeu}

QUY TẮC SOẠN THẢO (BẤT BUỘC):
1. Bạn CHỈ tạo ra phần nội dung chính để điền vào thân văn bản (không viết Tiêu ngữ, Quốc hiệu, Tiêu đề lớn, chữ ký hay nơi nhận).
2. Nội dung phải viết CỰC KỲ CHI TIẾT, ĐẦY ĐỦ, mạch lạc và chuyên nghiệp. Tránh viết chung chung, sơ sài hoặc dùng các ký hiệu giữ chỗ trống kiểu "[nhập vào đây]".
3. Chia nội dung thành các mục rõ ràng (ví dụ: 1., 2., 3. hoặc I, II, III) phù hợp với loại văn bản ${typeText}.
4. Trả về thuần văn bản (text), không bọc trong khối code block (\`\`\`markdown).`;

        const responseText = await sendChatRequest([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Hãy soạn thảo nội dung chi tiết cho văn bản hành chính với trích yếu: ${fs.trich_yeu}` }
        ], null, { timeoutMs: 60000 });

        const cleanedText = responseText.replace(/^```markdown\n/i, '').replace(/```$/i, '').trim();
        sc.querySelector('#fnd').value = cleanedText;
        fs.noi_dung = cleanedText;
        showToast('Đã soạn thảo nội dung thành công!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Lỗi AI: ' + err.message, 'error');
      } finally {
        btnAiDraft.disabled = false;
        btnAiDraft.textContent = '✨ AI Soạn thảo';
      }
    };
  }

  const btnAiBasis = sc.querySelector('#btn-ai-draft-basis');
  if (btnAiBasis) {
    btnAiBasis.onclick = async () => {
      if (!fs.trich_yeu) {
        showToast('Vui lòng quay lại Bước 2 nhập Trích yếu trước khi soạn thảo bằng AI', 'error');
        return;
      }
      btnAiBasis.disabled = true;
      btnAiBasis.textContent = '⏳ Đang tìm...';
      try {
        const typeText = LOAI_VB[fs.loai_van_ban] || 'văn bản';
        const systemPrompt = `Bạn là Trợ lý pháp luật chuyên nghiệp.
Nhiệm vụ của bạn là liệt kê các CĂN CỨ PHÁP LÝ (ví dụ: Luật, Nghị định, Thông tư...) phù hợp để ban hành văn bản hành chính sau:
- Loại văn bản: ${typeText}
- Trích yếu nội dung: ${fs.trich_yeu}
- Năm hiện tại: 2026

QUY TẮC LIỆT KÊ (BẤT BUỘC):
1. Mỗi căn cứ viết trên một dòng riêng biệt, bắt đầu bằng "Căn cứ...".
2. Chỉ sử dụng các văn bản pháp luật thực tế, chính xác và có hiệu lực tại Việt Nam (đặc biệt ưu tiên các luật ban hành năm 2024, 2025, 2026 nếu có). Không bịa đặt số hiệu hay tên luật.
3. Không trả về tiêu đề hay lời dẫn khác. Trả về thuần văn bản (text), không bọc trong khối code block.`;

        const responseText = await sendChatRequest([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Hãy liệt kê các căn cứ pháp lý phù hợp cho văn bản hành chính với trích yếu: ${fs.trich_yeu}` }
        ], null, { timeoutMs: 60000 });

        const cleanedText = responseText.replace(/^```markdown\n/i, '').replace(/```$/i, '').trim();
        sc.querySelector('#fcc').value = cleanedText;
        fs.can_cu = cleanedText;
        showToast('Đã tìm căn cứ thành công!', 'success');
      } catch (err) {
        console.error(err);
        showToast('Lỗi AI: ' + err.message, 'error');
      } finally {
        btnAiBasis.disabled = false;
        btnAiBasis.textContent = '✨ AI Tìm căn cứ';
      }
    };
  }
}

function renderS4(sc,c) {
  sc.innerHTML=`<div class="section-title">👁️ Xem trước & Tải file</div>
    <div class="preview-container">
      <table class="preview-header-table"><tr>
        <td style="width:40%;text-align:center">${fs.co_quan_chu_quan?`<div style="font-size:13pt">${fs.co_quan_chu_quan}</div>`:''}<div style="font-size:13pt;font-weight:bold">${fs.co_quan_ban_hanh}</div><div style="border-top:1px solid #000;width:30%;margin:4px auto"></div><div style="font-size:13pt">${fs.so_ky_hieu||'Số: /...'}</div>${fs.loai_van_ban.toLowerCase()==='cong_van'&&fs.trich_yeu.trim()?`<div style="font-size:11pt;margin-top:4pt">${fs.trich_yeu.trim().toLowerCase().startsWith('v/v')?'':'V/v '}${fs.trich_yeu.trim()}</div>`:''}</td>
        <td style="width:60%;text-align:center"><div style="font-size:13pt;font-weight:bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div style="font-size:14pt;font-weight:bold">Độc lập - Tự do - Hạnh phúc</div><div style="border-top:1px solid #000;width:50%;margin:4px auto"></div><div style="font-style:italic">${fs.dia_danh}, ngày ${fs.ngay||'...'} tháng ${fs.thang||'...'} năm ${fs.nam}</div></td>
      </tr></table>
      ${fs.loai_van_ban.toLowerCase()!=='cong_van'?`<div class="preview-center preview-bold" style="font-size:14pt;margin-top:16pt">${LOAI_VB[fs.loai_van_ban]||''}</div><div class="preview-center preview-bold">${fs.trich_yeu}</div><div class="preview-separator">_______________</div>`:''}
      ${fs.kinh_gui?`<div class="preview-center" style="margin-top:8pt;margin-bottom:8pt">Kính gửi: ${fs.kinh_gui}</div>`:''}
      ${fs.noi_dung.split('\n').filter(l=>l.trim()).map(l=>`<div class="preview-body">${l.trim()}</div>`).join('')}
      <table class="preview-header-table" style="margin-top:24pt"><tr>
        <td style="width:45%;vertical-align:top"><div style="font-weight:bold;font-style:italic;font-size:12pt">Nơi nhận:</div>${(fs.noi_nhan||'').split('\n').filter(l=>l.trim()).map(l=>`<div style="font-size:11pt">- ${l.trim()}</div>`).join('')}</td>
        <td style="width:55%;text-align:center">${fs.dong_chuc_danh_1?`<div class="preview-bold">${fs.dong_chuc_danh_1}</div>`:''}${fs.dong_chuc_danh_2?`<div class="preview-bold">${fs.dong_chuc_danh_2}</div>`:''}${fs.dong_chuc_danh_3?`<div class="preview-bold">${fs.dong_chuc_danh_3}</div>`:''}<br><br><br><br><div class="preview-bold">${fs.nguoi_ky}</div></td>
      </tr></table>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:24px"><button class="btn btn-secondary" id="bb">← Chỉnh sửa</button><button class="btn btn-success" id="bd">⬇ Tải file .DOCX</button></div>`;
  sc.querySelector('#bb').onclick=()=>{fs.step=3;doRender(c)};
  sc.querySelector('#bd').onclick=()=>genND30();
}

async function genND30() {
  try {
    const ch=[];
    // Header
    const lc=[],rc=[];
    if(fs.co_quan_chu_quan) lc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.co_quan_chu_quan,font:L.FONT,size:26})]}));
    lc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.co_quan_ban_hanh,font:L.FONT,size:26,bold:true})]}));
    lc.push(new Paragraph({spacing:{before:20,after:80},border:{top:{style:BorderStyle.SINGLE,size:2,color:'000000',space:1}},indent:{left:1500,right:1500}}));
    lc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.so_ky_hieu||'Số: /...',font:L.FONT,size:26})]}));
    if(fs.loai_van_ban.toLowerCase()==='cong_van' && fs.trich_yeu.trim()) {
      const ty = fs.trich_yeu.trim();
      lc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:100},children:[new TextRun({text:(ty.toLowerCase().startsWith('v/v')?'':'V/v ')+ty,font:L.FONT,size:24})]}));
    }
    rc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',font:L.FONT,size:26,bold:true})]}));
    rc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:'Độc lập - Tự do - Hạnh phúc',font:L.FONT,size:28,bold:true})]}));
    rc.push(new Paragraph({spacing:{before:20,after:0},border:{top:{style:BorderStyle.SINGLE,size:2,color:'000000',space:1}},indent:{left:1100,right:1100}}));
    rc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:`${fs.dia_danh}, ngày ${fs.ngay||'...'} tháng ${fs.thang||'...'} năm ${fs.nam}`,font:L.FONT,size:28,italics:true})]}));
    ch.push(new Table({width:{size:L.CW,type:WidthType.DXA},borders:BN,columnWidths:[3500,5571],rows:[new TableRow({children:[new TableCell({borders:BN,width:{size:3500,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:lc}),new TableCell({borders:BN,width:{size:5571,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:rc})]})]}));
    // Title
    if(fs.loai_van_ban.toLowerCase()!=='cong_van'&&LOAI_VB[fs.loai_van_ban]) {
      ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:360,after:0},children:[new TextRun({text:LOAI_VB[fs.loai_van_ban],font:L.FONT,size:28,bold:true})]}));
      if(fs.trich_yeu) {ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.trich_yeu,font:L.FONT,size:28,bold:true})]}));ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:120},children:[new TextRun({text:'_______________',font:L.FONT,size:28})]}));}
    }
    // Kinh gui
    if(fs.kinh_gui) {
      ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:240,after:240},children:[new TextRun({text:'Kính gửi: '+fs.kinh_gui,font:L.FONT,size:28})]}));
    }
    // Body
    fs.noi_dung.split('\n').filter(l=>l.trim()).forEach(l=>ch.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:BS,indent:{firstLine:567},children:[new TextRun({text:l.trim(),font:L.FONT,size:28})]})));
    // Signature
    const nn=[new Paragraph({spacing:{after:0},children:[new TextRun({text:'Nơi nhận:',font:L.FONT,size:24,bold:true,italics:true})]})];
    (fs.noi_nhan||'').split('\n').filter(l=>l.trim()).forEach(n=>nn.push(new Paragraph({spacing:{after:0},children:[new TextRun({text:'- '+n.trim(),font:L.FONT,size:22})]})));
    const sg=[];
    if (fs.dong_chuc_danh_1) sg.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.dong_chuc_danh_1,font:L.FONT,size:28,bold:true})]}));
    if (fs.dong_chuc_danh_2) sg.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.dong_chuc_danh_2,font:L.FONT,size:28,bold:true})]}));
    if (fs.dong_chuc_danh_3) sg.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.dong_chuc_danh_3,font:L.FONT,size:28,bold:true})]}));
    for(let i=0;i<4;i++)sg.push(new Paragraph({spacing:{after:0},children:[new TextRun({text:'',font:L.FONT,size:28})]}));
    sg.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.nguoi_ky,font:L.FONT,size:28,bold:true})]}));
    ch.push(new Paragraph({spacing:{before:240},children:[]}));
    ch.push(new Table({width:{size:L.CW,type:WidthType.DXA},borders:BN,columnWidths:[4300,4771],rows:[new TableRow({children:[new TableCell({borders:BN,width:{size:4300,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:nn}),new TableCell({borders:BN,width:{size:4771,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:sg})]})]}));
    const doc=new Document({styles:{default:{document:{run:{font:L.FONT,size:28}}}},sections:[{properties:{titlePage:true,page:{size:L.PAGE,margin:L.MARGIN}},children:ch}]});
    const blob=await Packer.toBlob(doc);
    saveAs(blob,`${fs.loai_van_ban}_hc_nd30.docx`);
    showToast('✅ Đã tải file DOCX thành công!');
    
    // Audit logging is centralized in the authenticated proxy; never write app data from the browser.

  } catch(e){console.error(e);showToast('Lỗi: '+e.message,'error');}
}
export function handleVBND30Action(){}

