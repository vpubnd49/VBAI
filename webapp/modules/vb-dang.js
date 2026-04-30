/**
 * VB Đảng Module — Form soạn VB Đảng chuẩn HD36
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType, UnderlineType, Header, PageNumber } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmdSiD2byxr19cZZ7xc2HUpbsAWDChZzw",
  authDomain: "vbai-a1729.firebaseapp.com",
  projectId: "vbai-a1729",
  storageBucket: "vbai-a1729.firebasestorage.app",
  messagingSenderId: "691819234622",
  appId: "1:691819234622:web:d34caa7684c1949a5c986f",
  measurementId: "G-XLHHMNXRND"
};


const LOAI_VB = {
  nghi_quyet: 'NGHỊ QUYẾT', chi_thi: 'CHỈ THỊ', ket_luan: 'KẾT LUẬN',
  quyet_dinh: 'QUYẾT ĐỊNH', quy_dinh: 'QUY ĐỊNH', quy_che: 'QUY CHẾ',
  bao_cao: 'BÁO CÁO', to_trinh: 'TỜ TRÌNH', thong_bao: 'THÔNG BÁO',
  huong_dan: 'HƯỚNG DẪN', chuong_trinh: 'CHƯƠNG TRÌNH', thong_tri: 'THÔNG TRI',
  cong_van: 'Công văn', bien_ban: 'Biên bản',
};

const LAYOUT = {
  PAGE: { width: 11906, height: 16838 },
  MARGIN: { top: 1134, bottom: 1134, left: 1701, right: 850 },
  FONT: 'Times New Roman',
  CONTENT_WIDTH: 9355,
};
const BORDERS_NONE = { top: {style:BorderStyle.NONE,size:0,color:'auto'}, bottom:{style:BorderStyle.NONE,size:0,color:'auto'}, left:{style:BorderStyle.NONE,size:0,color:'auto'}, right:{style:BorderStyle.NONE,size:0,color:'auto'}, insideHorizontal:{style:BorderStyle.NONE,size:0,color:'auto'}, insideVertical:{style:BorderStyle.NONE,size:0,color:'auto'} };
const BODY_SP = { before:120, after:120, line:360, lineRule:LineRuleType.EXACT };

let formState = { step: 1 };

export function renderVBDang(container) {
  const now = new Date();
  formState = { step: 1, loai_van_ban: 'nghi_quyet', co_quan_cap_tren: '', co_quan_ban_hanh: '', so_ky_hieu: '', dia_danh: 'Lâm Đồng', ngay: String(now.getDate()).padStart(2, '0'), thang: String(now.getMonth() + 1).padStart(2, '0'), nam: String(now.getFullYear()), trich_yeu: '', noi_dung: '', quyen_han_ky: 'Ký trực tiếp', chuc_vu_ky: '', nguoi_ky: '', noi_nhan: '', kinh_gui: '', can_cu: '', dong_chuc_danh_1:'', dong_chuc_danh_2:'', dong_chuc_danh_3:'' };
  renderStep(container);
}

function renderStep(container) {
  const s = formState;
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">📜 Soạn Văn Bản Đảng (HD36)</div>
      <div class="page-subtitle">Chuẩn Hướng dẫn 36-HD/VPTW</div>
    </div>
    <div class="steps-bar">
      ${[1,2,3,4].map(i => `<button class="step-indicator ${s.step===i?'active':s.step>i?'completed':''}" data-step="${i}"><span class="step-num">${s.step>i?'✓':i}</span><span>${['Loại VB','Thông tin','Nội dung','Xem & Tải'][i-1]}</span></button>`).join('')}
    </div>
    <div id="step-content" class="section-card"></div>
  `;
  container.querySelectorAll('.step-indicator').forEach(b => b.addEventListener('click', () => { const st=parseInt(b.dataset.step); if(st<=s.step){s.step=st;renderStep(container);} }));
  const sc = container.querySelector('#step-content');
  if (s.step === 1) renderStep1(sc, container);
  else if (s.step === 2) renderStep2(sc, container);
  else if (s.step === 3) renderStep3(sc, container);
  else renderStep4(sc, container);
}

function renderStep1(sc, container) {
  sc.innerHTML = `
    <div class="section-title">📌 Bước 1: Chọn loại văn bản</div>
    <div class="form-grid">
      <div class="form-group span-2">
        <label class="form-label">Loại văn bản <span class="required">*</span></label>
        <select class="form-select" id="f-loai">${Object.entries(LOAI_VB).map(([k,v])=>`<option value="${k}" ${formState.loai_van_ban===k?'selected':''}>${v}</option>`).join('')}</select>
      </div>
    </div>
    <div class="btn-row"><button class="btn btn-primary" id="btn-next1">Tiếp theo →</button></div>
  `;
  sc.querySelector('#f-loai').addEventListener('change', e => { formState.loai_van_ban = e.target.value; });
  sc.querySelector('#btn-next1').addEventListener('click', () => { formState.step=2; renderStep(container); });
}

function renderStep2(sc, container) {
  const s = formState;
  sc.innerHTML = `
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">🏛️</div>
        Định danh cơ quan
      </div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">Cơ quan cấp trên</label><input class="form-input" id="f-cqct" value="${s.co_quan_cap_tren}" placeholder="VD: ĐẢNG BỘ"></div>
        <div class="form-group"><label class="form-label">Cơ quan ban hành <span class="required">*</span></label><input class="form-input" id="f-cqbh" value="${s.co_quan_ban_hanh}" placeholder="VD: ĐẢNG ỦY"></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">🕒</div>
        Thời gian & Ký hiệu
      </div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">Số ký hiệu</label><input class="form-input" id="f-sokh" value="${s.so_ky_hieu}" placeholder="VD: Số 15-NQ/HU"></div>
        <div class="form-group"><label class="form-label">Địa danh</label><input class="form-input" id="f-dd" value="${s.dia_danh}"></div>
        <div class="form-group"><label class="form-label">Ngày</label><input class="form-input" id="f-ngay" value="${s.ngay}" placeholder="15"></div>
        <div class="form-group"><label class="form-label">Tháng / Năm</label>
          <div style="display:flex;gap:8px"><input class="form-input" id="f-thang" value="${s.thang}" placeholder="03" style="flex:1"><input class="form-input" id="f-nam" value="${s.nam}" placeholder="2026" style="flex:1"></div>
        </div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">📄</div>
        Nội dung cốt lõi
      </div>
      <div class="panel-body form-grid full">
        <div class="form-group"><label class="form-label">Trích yếu nội dung <span class="required">*</span></label><input class="form-input" id="f-ty" value="${s.trich_yeu}" placeholder="VD: về công tác cán bộ năm 2026"></div>
      </div>
    </div>
    
    <div class="btn-row"><button class="btn btn-secondary" id="btn-back2">← Quay lại</button><button class="btn btn-primary" id="btn-next2">Tiếp theo →</button></div>
  `;
  const save = () => { s.co_quan_cap_tren=sc.querySelector('#f-cqct').value; s.co_quan_ban_hanh=sc.querySelector('#f-cqbh').value; s.so_ky_hieu=sc.querySelector('#f-sokh').value; s.dia_danh=sc.querySelector('#f-dd').value; s.ngay=sc.querySelector('#f-ngay').value; s.thang=sc.querySelector('#f-thang').value; s.nam=sc.querySelector('#f-nam').value; s.trich_yeu=sc.querySelector('#f-ty').value; };
  sc.querySelector('#btn-back2').addEventListener('click', () => { save(); s.step=1; renderStep(container); });
  sc.querySelector('#btn-next2').addEventListener('click', () => { save(); if(!s.co_quan_ban_hanh){showToast('Vui lòng nhập cơ quan ban hành','error');return;} s.step=3; renderStep(container); });
}

function renderStep3(sc, container) {
  const s = formState;
  const isCongVan = s.loai_van_ban === 'cong_van';
  sc.innerHTML = `
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">📝</div>
        Nội dung & Thông tin phụ
      </div>
      <div class="panel-body form-grid full">
        ${isCongVan ? `<div class="form-group"><label class="form-label">Kính gửi</label><input class="form-input" id="f-kg" value="${s.kinh_gui}" placeholder="Ban Bí thư Trung ương Đảng (mỗi CQ cách nhau dấu ;)"></div>` : ''}
        <div class="form-group"><label class="form-label">Căn cứ (mỗi dòng 1 căn cứ)</label><textarea class="form-textarea" id="f-cc" rows="3" placeholder="Căn cứ Điều lệ Đảng...">${s.can_cu}</textarea></div>
        <div class="form-group"><label class="form-label">Nội dung văn bản <span class="required">*</span></label><textarea class="form-textarea" id="f-nd" rows="8" placeholder="Nhập nội dung văn bản...">${s.noi_dung}</textarea></div>
        <div class="form-group"><label class="form-label">Nơi nhận (mỗi dòng 1 nơi)</label><textarea class="form-textarea" id="f-nn" rows="3" placeholder="Các chi bộ trực thuộc&#10;Lưu VP">${s.noi_nhan}</textarea></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">✍️</div>
        Thẩm Quyền Ký
      </div>
      <div class="panel-body form-grid">
        <div class="form-group span-2"><label class="form-label">Người ký <span class="required">*</span></label><input class="form-input" id="f-nk" value="${s.nguoi_ky}" placeholder="VD: Nguyễn Văn A"></div>
        <div class="form-group"><label class="form-label">Chức vụ</label><input class="form-input" id="f-cvk" value="${s.chuc_vu_ky}" placeholder="VD: BÍ THƯ"></div>
        <div class="form-group"><label class="form-label">Chế độ ký</label><select class="form-select" id="f-qhk">
          <option ${s.quyen_han_ky==='Ký trực tiếp'?'selected':''}>Ký trực tiếp</option>
          <option ${s.quyen_han_ky==='TM. (Thay mặt)'?'selected':''}>TM. (Thay mặt)</option>
          <option ${s.quyen_han_ky==='KT. (Ký thay)'?'selected':''}>KT. (Ký thay)</option>
          <option ${s.quyen_han_ky==='TL. (Thừa lệnh)'?'selected':''}>TL. (Thừa lệnh)</option>
          <option ${s.quyen_han_ky==='TU. (Thừa ủy quyền)'?'selected':''}>TU. (Thừa ủy quyền)</option>
          <option ${s.quyen_han_ky==='Q. (Quyền)'?'selected':''}>Q. (Quyền)</option>
        </select></div>
        
        <div class="span-2" style="margin-top: 16px; margin-bottom: 8px; font-weight: 700; font-size: 0.8rem; color: var(--daquy-500); text-transform: uppercase;">Dòng chức danh (Tối đa 3 dòng)</div>
        <div class="form-group span-2"><label class="form-label">Dòng 1</label><input class="form-input" id="fdcd1" value="${s.dong_chuc_danh_1}" placeholder="VD: T/M BAN THƯỜNG VỤ"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 2</label><input class="form-input" id="fdcd2" value="${s.dong_chuc_danh_2}" placeholder="VD: K/T BÍ THƯ"></div>
        <div class="form-group span-2"><label class="form-label">Dòng 3</label><input class="form-input" id="fdcd3" value="${s.dong_chuc_danh_3}" placeholder="VD: PHÓ BÍ THƯ"></div>
      </div>
    </div>

  <div class="btn-row"><button class="btn btn-secondary" id="btn-back3">← Quay lại</button><button class="btn btn-primary" id="btn-next3">Xem trước & Tải →</button></div>
  `;
  const save = () => { if(isCongVan) s.kinh_gui=sc.querySelector('#f-kg')?.value||''; s.can_cu=sc.querySelector('#f-cc').value; s.noi_dung=sc.querySelector('#f-nd').value; s.quyen_han_ky=sc.querySelector('#f-qhk').value; s.chuc_vu_ky=sc.querySelector('#f-cvk').value; s.nguoi_ky=sc.querySelector('#f-nk').value; s.noi_nhan=sc.querySelector('#f-nn').value; s.dong_chuc_danh_1=sc.querySelector('#fdcd1').value; s.dong_chuc_danh_2=sc.querySelector('#fdcd2').value; s.dong_chuc_danh_3=sc.querySelector('#fdcd3').value; };
  sc.querySelector('#btn-back3').addEventListener('click', () => { save(); s.step=2; renderStep(container); });
  sc.querySelector('#btn-next3').addEventListener('click', () => { save(); if(!s.noi_dung){showToast('Vui lòng nhập nội dung','error');return;} s.step=4; renderStep(container); });
}

function renderStep4(sc, container) {
  const s = formState;
  const tenLoai = LOAI_VB[s.loai_van_ban] || '';
  sc.innerHTML = `
    <div class="section-title">👁️ Bước 4: Xem trước & Tải file</div>
    <div class="preview-container">
      <table class="preview-header-table"><tr>
        <td style="width:40%;text-align:center">
          ${s.co_quan_cap_tren?`<div style="font-size:13pt">${s.co_quan_cap_tren}</div>`:''}
          <div style="font-size:13pt;font-weight:bold">${s.co_quan_ban_hanh}</div>
          <div style="font-size:13pt">*</div>
          <div style="font-size:13pt">${s.so_ky_hieu || 'Số      -/...'}</div>
          ${s.loai_van_ban.toLowerCase()==='cong_van'&&s.trich_yeu.trim()?`<div style="font-size:11pt;margin-top:4pt">${s.trich_yeu.trim().toLowerCase().startsWith('v/v')?'':'V/v '}${s.trich_yeu.trim()}</div>`:''}
        </td>
        <td style="width:60%;text-align:center">
          <div style="font-size:15pt;font-weight:bold">ĐẢNG CỘNG SẢN VIỆT NAM</div>
          <div style="border-top:1px solid #000;width:60%;margin:4px auto"></div>
          <div style="font-size:13pt;font-style:italic">${s.dia_danh}, ngày ${s.ngay||'...'} tháng ${s.thang||'...'} năm ${s.nam}</div>
        </td>
      </tr></table>
      ${s.loai_van_ban.toLowerCase()!=='cong_van'?`
        <div class="preview-center preview-bold" style="font-size:16pt;margin-top:18pt">${tenLoai}</div>
        <div class="preview-center preview-bold" style="font-size:14pt">${s.trich_yeu}</div>
        <div class="preview-separator">-----</div>
      `:''}
      ${s.can_cu ? s.can_cu.split('\n').filter(l=>l.trim()).map(l=>`<div class="preview-body">- ${l.trim()}</div>`).join('') : ''}
      ${s.noi_dung.split('\n').filter(l=>l.trim()).map(l=>`<div class="preview-body">${l.trim()}</div>`).join('')}
      <table class="preview-header-table" style="margin-top:24pt"><tr>
        <td style="width:48%;vertical-align:top;font-size:12pt">
          <div class="preview-underline">Nơi nhận:</div>
          ${(s.noi_nhan||'').split('\n').filter(l=>l.trim()).map(l=>`<div style="font-size:11pt">- ${l.trim()}</div>`).join('')}
        </td>
        <td style="width:52%;text-align:center;vertical-align:top">
          ${s.dong_chuc_danh_1?`<div class="preview-bold">${s.dong_chuc_danh_1}</div>`:''}
          ${s.dong_chuc_danh_2?`<div class="preview-bold">${s.dong_chuc_danh_2}</div>`:''}
          ${s.dong_chuc_danh_3?`<div class="preview-bold">${s.dong_chuc_danh_3}</div>`:''}
          <br><br><br><br>
          <div class="preview-bold">${s.nguoi_ky}</div>
        </td>
      </tr></table>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:24px">
      <button class="btn btn-secondary" id="btn-back4">← Chỉnh sửa</button>
      <button class="btn btn-success" id="btn-download">⬇ Tải file .DOCX</button>
    </div>
  `;
  sc.querySelector('#btn-back4').addEventListener('click', () => { formState.step=3; renderStep(container); });
  sc.querySelector('#btn-download').addEventListener('click', () => generateDangDocx(formState));
}

async function generateDangDocx(s) {
  try {
    const children = [];
    // Header table
    const leftCells = [];
    if(s.co_quan_cap_tren) leftCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.co_quan_cap_tren,font:LAYOUT.FONT,size:28})]}));
    leftCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.co_quan_ban_hanh,font:LAYOUT.FONT,size:28,bold:true})]}));
    leftCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:40,after:80},children:[new TextRun({text:'*',font:LAYOUT.FONT,size:28})]}));
    leftCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.so_ky_hieu||'Số      -/...',font:LAYOUT.FONT,size:28})]}));
    if(s.loai_van_ban.toLowerCase()==='cong_van' && s.trich_yeu.trim()) {
      const ty = s.trich_yeu.trim();
      leftCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:100},children:[new TextRun({text:(ty.toLowerCase().startsWith('v/v')?'':'V/v ')+ty,font:LAYOUT.FONT,size:24})]}));
    }

    const rightCells = [];
    rightCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:'ĐẢNG CỘNG SẢN VIỆT NAM',font:LAYOUT.FONT,size:30,bold:true})]}));
    rightCells.push(new Paragraph({spacing:{before:20,after:0},border:{top:{style:BorderStyle.SINGLE,size:2,color:'000000',space:1}},indent:{left:928,right:928}}));
    rightCells.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:`${s.dia_danh}, ngày ${s.ngay||'...'} tháng ${s.thang||'...'} năm ${s.nam}`,font:LAYOUT.FONT,size:28,italics:true})]}));

    children.push(new Table({width:{size:LAYOUT.CONTENT_WIDTH,type:WidthType.DXA},borders:BORDERS_NONE,columnWidths:[3500,5855],rows:[new TableRow({children:[new TableCell({borders:BORDERS_NONE,width:{size:3500,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:leftCells}),new TableCell({borders:BORDERS_NONE,width:{size:5855,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:rightCells})]})]}));

    // Ten loai + trich yeu
    if(s.loai_van_ban.toLowerCase()!=='cong_van' && LOAI_VB[s.loai_van_ban]) {
      children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:360,after:0},children:[new TextRun({text:LOAI_VB[s.loai_van_ban],font:LAYOUT.FONT,size:32,bold:true})]}));
      if(s.trich_yeu) { children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.trich_yeu,font:LAYOUT.FONT,size:28,bold:true})]})); children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:120},children:[new TextRun({text:'-----',font:LAYOUT.FONT,size:28})]})); }
    }

    // Can cu
    if(s.can_cu) s.can_cu.split('\n').filter(l=>l.trim()).forEach((cc,i,arr) => { children.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:BODY_SP,indent:{firstLine:567},children:[new TextRun({text:'- '+cc.trim()+(i===arr.length-1?',':';'),font:LAYOUT.FONT,size:28})]})); });

    // Noi dung
    s.noi_dung.split('\n').filter(l=>l.trim()).forEach(line => {
      children.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:BODY_SP,indent:{firstLine:567},children:[new TextRun({text:line.trim(),font:LAYOUT.FONT,size:28})]}));
    });

    // Signature block
    const noiNhanCh = [new Paragraph({spacing:{after:0},children:[new TextRun({text:'Nơi nhận:',font:LAYOUT.FONT,size:28,underline:{type:UnderlineType.SINGLE}})]})];
    (s.noi_nhan||'').split('\n').filter(l=>l.trim()).forEach(n => noiNhanCh.push(new Paragraph({spacing:{after:0},children:[new TextRun({text:'- '+n.trim(),font:LAYOUT.FONT,size:24})]})));

    const sigCh = [];
    if(s.dong_chuc_danh_1) sigCh.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.dong_chuc_danh_1,font:LAYOUT.FONT,size:28,bold:true})]}));
    if(s.dong_chuc_danh_2) sigCh.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.dong_chuc_danh_2,font:LAYOUT.FONT,size:28,bold:true})]}));
    if(s.dong_chuc_danh_3) sigCh.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.dong_chuc_danh_3,font:LAYOUT.FONT,size:28,bold:true})]}));
    for(let i=0;i<4;i++) sigCh.push(new Paragraph({spacing:{after:0},children:[new TextRun({text:'',font:LAYOUT.FONT,size:28})]}));
    sigCh.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:s.nguoi_ky,font:LAYOUT.FONT,size:28,bold:true})]}));

    children.push(new Paragraph({spacing:{before:240,after:0},children:[]}));
    children.push(new Table({width:{size:LAYOUT.CONTENT_WIDTH,type:WidthType.DXA},borders:BORDERS_NONE,columnWidths:[4500,4855],rows:[new TableRow({children:[new TableCell({borders:BORDERS_NONE,width:{size:4500,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:noiNhanCh}),new TableCell({borders:BORDERS_NONE,width:{size:4855,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:sigCh})]})]}));

    const doc = new Document({styles:{default:{document:{run:{font:LAYOUT.FONT,size:28}}}},sections:[{properties:{titlePage:true,page:{size:LAYOUT.PAGE,margin:LAYOUT.MARGIN}},children}]});
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${s.loai_van_ban}_dang_hd36.docx`);
    showToast('✓ Đã tải file DOCX thành công!');
    
    // Log to Firestore
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: `[Tạo VB Đảng HD36] ${LOAI_VB[s.loai_van_ban]} - ${s.trich_yeu}`,
        model: "Local DOCX Generator",
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(e => console.warn(e));
    } catch(e) {}
  } catch(e) { console.error(e); showToast('Lỗi tạo file: '+e.message, 'error'); }
}

export function handleVBDangAction() {}
