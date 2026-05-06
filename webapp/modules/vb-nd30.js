/**
 * VB H�nh Ch�nh N�30 Module
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, VerticalAlign, LineRuleType, Header, PageNumber } from 'docx';
import { saveAs } from 'file-saver';
import { showToast } from '../main.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { firebaseConfig } from '../firebase-config.js';


const LOAI_VB = {
  nghi_quyet:'NGH? QUY?T', quyet_dinh:'QUY?T �?NH', chi_thi:'CH? TH?',
  quy_che:'QUY CH?', quy_dinh:'QUY �?NH', thong_bao:'TH�NG B�O',
  huong_dan:'HU?NG D?N', chuong_trinh:'CHUONG TR�NH', ke_hoach:'K? HO?CH',
  bao_cao:'B�O C�O', to_trinh:'T? TR�NH', cong_van:'C�ng van',
  giay_moi:'GI?Y M?I', hop_dong:'H?P �?NG', cong_dien:'C�NG �I?N',
  bien_ban:'BI�N B?N',
};
const L = { PAGE:{width:11906,height:16838}, MARGIN:{top:1134,bottom:1134,left:1701,right:1134}, FONT:'Times New Roman', CW:9071 };
const BN = {top:{style:BorderStyle.NONE,size:0,color:'auto'},bottom:{style:BorderStyle.NONE,size:0,color:'auto'},left:{style:BorderStyle.NONE,size:0,color:'auto'},right:{style:BorderStyle.NONE,size:0,color:'auto'},insideHorizontal:{style:BorderStyle.NONE,size:0,color:'auto'},insideVertical:{style:BorderStyle.NONE,size:0,color:'auto'}};
const BS = {before:120,after:0,line:340,lineRule:LineRuleType.AT_LEAST};

let fs = {};

export function renderVBND30(container) {
  const now = new Date();
  fs = { step:1, loai_van_ban:'thong_bao', co_quan_chu_quan:'', co_quan_ban_hanh:'', so_ky_hieu:'', dia_danh:'L�m �?ng', ngay:String(now.getDate()).padStart(2, '0'),thang:String(now.getMonth() + 1).padStart(2, '0'),nam:String(now.getFullYear()), trich_yeu:'', noi_dung:'', quyen_han_ky:'K� tr?c ti?p', chuc_vu_ky:'', nguoi_ky:'', noi_nhan:'', kinh_gui:'', can_cu:'', dong_chuc_danh_1:'', dong_chuc_danh_2:'', dong_chuc_danh_3:'' };
  doRender(container);
}

function doRender(c) {
  c.innerHTML = `
    <div class="page-header"><div class="page-title">?? So?n VB H�nh Ch�nh (N�30)</div><div class="page-subtitle">Chu?n Ngh? d?nh 30/2020/N�-CP</div></div>
    <div class="steps-bar">${[1,2,3,4].map(i=>`<button class="step-indicator ${fs.step===i?'active':fs.step>i?'completed':''}" data-step="${i}"><span class="step-num">${fs.step>i?'?':i}</span><span>${['Lo?i VB','Th�ng tin','N?i dung','Xem & T?i'][i-1]}</span></button>`).join('')}</div>
    <div id="sc" class="section-card"></div>`;
  c.querySelectorAll('.step-indicator').forEach(b=>b.addEventListener('click',()=>{const st=+b.dataset.step;if(st<=fs.step){fs.step=st;doRender(c);}}));
  const sc=c.querySelector('#sc');
  [renderS1,renderS2,renderS3,renderS4][fs.step-1](sc,c);
}

function renderS1(sc,c) {
  sc.innerHTML=`<div class="section-title">?? Ch?n lo?i VB h�nh ch�nh</div><div class="form-grid"><div class="form-group span-2"><label class="form-label">Lo?i van b?n <span class="required">*</span></label><select class="form-select" id="fl">${Object.entries(LOAI_VB).map(([k,v])=>`<option value="${k}" ${fs.loai_van_ban===k?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="btn-row"><button class="btn btn-primary" id="bn">Ti?p theo ?</button></div>`;
  sc.querySelector('#fl').onchange=e=>{fs.loai_van_ban=e.target.value};
  sc.querySelector('#bn').onclick=()=>{fs.step=2;doRender(c)};
}

function renderS2(sc,c) {
  sc.innerHTML=`
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">???</div>
        �?nh danh co quan
      </div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">CQ ch? qu?n</label><input class="form-input" id="f1" value="${fs.co_quan_chu_quan}" placeholder="UBND"></div>
        <div class="form-group"><label class="form-label">CQ ban h�nh <span class="required">*</span></label><input class="form-input" id="f2" value="${fs.co_quan_ban_hanh}" placeholder="VAN PH�NG"></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">??</div>
        Th?i gian & K� hi?u
      </div>
      <div class="panel-body form-grid">
        <div class="form-group"><label class="form-label">S? k� hi?u</label><input class="form-input" id="f3" value="${fs.so_ky_hieu}" placeholder="S?: /TB-TCCB"></div>
        <div class="form-group"><label class="form-label">�?a danh</label><input class="form-input" id="f4" value="${fs.dia_danh}"></div>
        <div class="form-group"><label class="form-label">Ng�y</label><input class="form-input" id="f5" value="${fs.ngay}" placeholder="17"></div>
        <div class="form-group"><label class="form-label">Th�ng / Nam</label><div style="display:flex;gap:8px"><input class="form-input" id="f6" value="${fs.thang}" placeholder="03" style="flex:1"><input class="form-input" id="f7" value="${fs.nam}" style="flex:1"></div></div>
      </div>
    </div>

    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">??</div>
        N?i dung c?t l�i
      </div>
      <div class="panel-body form-grid full">
        <div class="form-group"><label class="form-label">Tr�ch y?u <span class="required">*</span></label><input class="form-input" id="f8" value="${fs.trich_yeu}" placeholder="k?t lu?n c?a V? tru?ng t?i cu?c h?p giao ban"></div>
      </div>
    </div>
    
    <div class="btn-row"><button class="btn btn-secondary" id="bb">? Quay l?i</button><button class="btn btn-primary" id="bn">Ti?p theo ?</button></div>`;
  const sv=()=>{fs.co_quan_chu_quan=sc.querySelector('#f1').value;fs.co_quan_ban_hanh=sc.querySelector('#f2').value;fs.so_ky_hieu=sc.querySelector('#f3').value;fs.dia_danh=sc.querySelector('#f4').value;fs.ngay=sc.querySelector('#f5').value;fs.thang=sc.querySelector('#f6').value;fs.nam=sc.querySelector('#f7').value;fs.trich_yeu=sc.querySelector('#f8').value};
  sc.querySelector('#bb').onclick=()=>{sv();fs.step=1;doRender(c)};
  sc.querySelector('#bn').onclick=()=>{sv();if(!fs.co_quan_ban_hanh){showToast('Nh?p CQ ban h�nh','error');return}fs.step=3;doRender(c)};
}

function renderS3(sc,c) {
  const isKG=fs.loai_van_ban==='cong_van'||fs.loai_van_ban==='to_trinh'||fs.loai_van_ban==='bao_cao';
  sc.innerHTML=`
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">??</div>
        N?i dung & Th�ng tin ph?
      </div>
      <div class="panel-body form-grid full">
        ${isKG?`<div class="form-group"><label class="form-label">K�nh g?i</label><input class="form-input" id="fkg" value="${fs.kinh_gui}" placeholder="C�c don v?/c� nh�n nh?n (c�ch nhau d?u ;)"></div>`:''}
        <div class="form-group"><label class="form-label">Can c?</label><textarea class="form-textarea" id="fcc" rows="3">${fs.can_cu}</textarea></div>
        <div class="form-group"><label class="form-label">N?i dung <span class="required">*</span></label><textarea class="form-textarea" id="fnd" rows="8">${fs.noi_dung}</textarea></div>
        <div class="form-group"><label class="form-label">Noi nh?n</label><textarea class="form-textarea" id="fnn" rows="3">${fs.noi_nhan}</textarea></div>
      </div>
    </div>
  
    <div class="panel-group">
      <div class="panel-header">
        <div class="panel-header-icon">??</div>
        Th?m Quy?n K�
      </div>
      <div class="panel-body form-grid">
        <div class="form-group span-2"><label class="form-label">Ngu?i k� <span class="required">*</span></label><input class="form-input" id="fnk" value="${fs.nguoi_ky}" placeholder="VD: Nguy?n Van A"></div>
        <div class="form-group"><label class="form-label">Ch?c v?</label><input class="form-input" id="fcv" value="${fs.chuc_vu_ky}" placeholder="VD: Ch? t?ch"></div>
        <div class="form-group"><label class="form-label">Ch? d? k�</label><select class="form-select" id="fqh">
          <option ${fs.quyen_han_ky==='K� tr?c ti?p'?'selected':''}>K� tr?c ti?p</option>
          <option ${fs.quyen_han_ky==='TM. (Thay m?t)'?'selected':''}>TM. (Thay m?t)</option>
          <option ${fs.quyen_han_ky==='KT. (K� thay)'?'selected':''}>KT. (K� thay)</option>
          <option ${fs.quyen_han_ky==='TL. (Th?a l?nh)'?'selected':''}>TL. (Th?a l?nh)</option>
          <option ${fs.quyen_han_ky==='TU. (Th?a ?y quy?n)'?'selected':''}>TU. (Th?a ?y quy?n)</option>
          <option ${fs.quyen_han_ky==='Q. (Quy?n)'?'selected':''}>Q. (Quy?n)</option>
        </select></div>
        
        <div class="span-2" style="margin-top: 16px; margin-bottom: 8px; font-weight: 700; font-size: 0.8rem; color: var(--daquy-500); text-transform: uppercase;">D�ng ch?c danh (T?i da 3 d�ng)</div>
        <div class="form-group span-2"><label class="form-label">D�ng 1</label><input class="form-input" id="fdcd1" value="${fs.dong_chuc_danh_1}" placeholder="VD: TM. ?Y BAN NH�N D�N"></div>
        <div class="form-group span-2"><label class="form-label">D�ng 2</label><input class="form-input" id="fdcd2" value="${fs.dong_chuc_danh_2}" placeholder="VD: KT. CH? T?CH"></div>
        <div class="form-group span-2"><label class="form-label">D�ng 3</label><input class="form-input" id="fdcd3" value="${fs.dong_chuc_danh_3}" placeholder="VD: PH� CH? T?CH"></div>
      </div>
    </div>
  
  <div class="btn-row"><button class="btn btn-secondary" id="bb">? Quay l?i</button><button class="btn btn-primary" id="bn">Xem tru?c ?</button></div>`;
  const sv=()=>{const el=sc.querySelector('#fkg');if(el)fs.kinh_gui=el.value;fs.can_cu=sc.querySelector('#fcc').value;fs.noi_dung=sc.querySelector('#fnd').value;fs.quyen_han_ky=sc.querySelector('#fqh').value;fs.chuc_vu_ky=sc.querySelector('#fcv').value;fs.nguoi_ky=sc.querySelector('#fnk').value;fs.noi_nhan=sc.querySelector('#fnn').value;fs.dong_chuc_danh_1=sc.querySelector('#fdcd1').value;fs.dong_chuc_danh_2=sc.querySelector('#fdcd2').value;fs.dong_chuc_danh_3=sc.querySelector('#fdcd3').value;};
  sc.querySelector('#bb').onclick=()=>{sv();fs.step=2;doRender(c)};
  sc.querySelector('#bn').onclick=()=>{sv();if(!fs.noi_dung){showToast('Nh?p n?i dung','error');return}fs.step=4;doRender(c)};
}

function renderS4(sc,c) {
  sc.innerHTML=`<div class="section-title">??? Xem tru?c & T?i file</div>
    <div class="preview-container">
      <table class="preview-header-table"><tr>
        <td style="width:40%;text-align:center">${fs.co_quan_chu_quan?`<div style="font-size:13pt">${fs.co_quan_chu_quan}</div>`:''}<div style="font-size:13pt;font-weight:bold">${fs.co_quan_ban_hanh}</div><div style="border-top:1px solid #000;width:30%;margin:4px auto"></div><div style="font-size:13pt">${fs.so_ky_hieu||'S?: /...'}</div>${fs.loai_van_ban.toLowerCase()==='cong_van'&&fs.trich_yeu.trim()?`<div style="font-size:11pt;margin-top:4pt">${fs.trich_yeu.trim().toLowerCase().startsWith('v/v')?'':'V/v '}${fs.trich_yeu.trim()}</div>`:''}</td>
        <td style="width:60%;text-align:center"><div style="font-size:13pt;font-weight:bold">C?NG H�A X� H?I CH? NGHIA VI?T NAM</div><div style="font-size:14pt;font-weight:bold">�?c l?p - T? do - H?nh ph�c</div><div style="border-top:1px solid #000;width:50%;margin:4px auto"></div><div style="font-style:italic">${fs.dia_danh}, ng�y ${fs.ngay||'...'} th�ng ${fs.thang||'...'} nam ${fs.nam}</div></td>
      </tr></table>
      ${fs.loai_van_ban.toLowerCase()!=='cong_van'?`<div class="preview-center preview-bold" style="font-size:14pt;margin-top:16pt">${LOAI_VB[fs.loai_van_ban]||''}</div><div class="preview-center preview-bold">${fs.trich_yeu}</div><div class="preview-separator">_______________</div>`:''}
      ${fs.kinh_gui?`<div class="preview-center" style="margin-top:8pt;margin-bottom:8pt">K�nh g?i: ${fs.kinh_gui}</div>`:''}
      ${fs.noi_dung.split('\n').filter(l=>l.trim()).map(l=>`<div class="preview-body">${l.trim()}</div>`).join('')}
      <table class="preview-header-table" style="margin-top:24pt"><tr>
        <td style="width:45%;vertical-align:top"><div style="font-weight:bold;font-style:italic;font-size:12pt">Noi nh?n:</div>${(fs.noi_nhan||'').split('\n').filter(l=>l.trim()).map(l=>`<div style="font-size:11pt">- ${l.trim()}</div>`).join('')}</td>
        <td style="width:55%;text-align:center">${fs.dong_chuc_danh_1?`<div class="preview-bold">${fs.dong_chuc_danh_1}</div>`:''}${fs.dong_chuc_danh_2?`<div class="preview-bold">${fs.dong_chuc_danh_2}</div>`:''}${fs.dong_chuc_danh_3?`<div class="preview-bold">${fs.dong_chuc_danh_3}</div>`:''}<br><br><br><br><div class="preview-bold">${fs.nguoi_ky}</div></td>
      </tr></table>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:24px"><button class="btn btn-secondary" id="bb">? Ch?nh s?a</button><button class="btn btn-success" id="bd">? T?i file .DOCX</button></div>`;
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
    lc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.so_ky_hieu||'S?: /...',font:L.FONT,size:26})]}));
    if(fs.loai_van_ban.toLowerCase()==='cong_van' && fs.trich_yeu.trim()) {
      const ty = fs.trich_yeu.trim();
      lc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:100},children:[new TextRun({text:(ty.toLowerCase().startsWith('v/v')?'':'V/v ')+ty,font:L.FONT,size:24})]}));
    }
    rc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:'C?NG H�A X� H?I CH? NGHIA VI?T NAM',font:L.FONT,size:26,bold:true})]}));
    rc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:'�?c l?p - T? do - H?nh ph�c',font:L.FONT,size:28,bold:true})]}));
    rc.push(new Paragraph({spacing:{before:20,after:0},border:{top:{style:BorderStyle.SINGLE,size:2,color:'000000',space:1}},indent:{left:1100,right:1100}}));
    rc.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:`${fs.dia_danh}, ng�y ${fs.ngay||'...'} th�ng ${fs.thang||'...'} nam ${fs.nam}`,font:L.FONT,size:28,italics:true})]}));
    ch.push(new Table({width:{size:L.CW,type:WidthType.DXA},borders:BN,columnWidths:[3500,5571],rows:[new TableRow({children:[new TableCell({borders:BN,width:{size:3500,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:lc}),new TableCell({borders:BN,width:{size:5571,type:WidthType.DXA},verticalAlign:VerticalAlign.TOP,children:rc})]})]}));
    // Title
    if(fs.loai_van_ban.toLowerCase()!=='cong_van'&&LOAI_VB[fs.loai_van_ban]) {
      ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:360,after:0},children:[new TextRun({text:LOAI_VB[fs.loai_van_ban],font:L.FONT,size:28,bold:true})]}));
      if(fs.trich_yeu) {ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:0},children:[new TextRun({text:fs.trich_yeu,font:L.FONT,size:28,bold:true})]}));ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:120},children:[new TextRun({text:'_______________',font:L.FONT,size:28})]}));}
    }
    // Kinh gui
    if(fs.kinh_gui) {
      ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:240,after:240},children:[new TextRun({text:'K�nh g?i: '+fs.kinh_gui,font:L.FONT,size:28})]}));
    }
    // Body
    fs.noi_dung.split('\n').filter(l=>l.trim()).forEach(l=>ch.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:BS,indent:{firstLine:567},children:[new TextRun({text:l.trim(),font:L.FONT,size:28})]})));
    // Signature
    const nn=[new Paragraph({spacing:{after:0},children:[new TextRun({text:'Noi nh?n:',font:L.FONT,size:24,bold:true,italics:true})]})];
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
    showToast('? �� t?i file DOCX th�nh c�ng!');
    
    // Log to Firestore
    try {
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);
      addDoc(collection(db, 'search_logs'), {
        query: `[T?o VB H�nh Ch�nh N�30] ${LOAI_VB[fs.loai_van_ban]} - ${fs.trich_yeu}`,
        model: "Local DOCX Generator",
        userEmail: window.currentUser?.email || 'Unknown',
        timestamp: serverTimestamp()
      }).catch(e => console.warn(e));
    } catch(e) {}
  } catch(e){console.error(e);showToast('L?i: '+e.message,'error');}
}
export function handleVBND30Action(){}
