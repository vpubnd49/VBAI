const { MongoClient } = require('mongodb');

function detectIssuer(text, docNum = '') {
  const combined = `${text || ''} ${docNum || ''}`.toUpperCase();
  if (/BGDĐT|BGDDT|BỘ GIÁO DỤC/i.test(combined)) return 'Bộ Giáo dục và Đào tạo';
  if (/BTC|BỘ TÀI CHÍNH/i.test(combined)) return 'Bộ Tài chính';
  if (/BCA|BỘ CÔNG AN/i.test(combined)) return 'Bộ Công an';
  if (/BQP|BỘ QUỐC PHÒNG/i.test(combined)) return 'Bộ Quốc phòng';
  if (/BTP|BỘ TƯ PHÁP/i.test(combined)) return 'Bộ Tư pháp';
  if (/BYT|BỘ Y TẾ/i.test(combined)) return 'Bộ Y tế';
  if (/BXD|BỘ XÂY DỰNG/i.test(combined)) return 'Bộ Xây dựng';
  if (/BKHCN|BỘ KHOA HỌC/i.test(combined)) return 'Bộ Khoa học và Công nghệ';
  if (/BCT|BỘ CÔNG THƯƠNG/i.test(combined)) return 'Bộ Công Thương';
  if (/BNV|BỘ NỘI VỤ/i.test(combined)) return 'Bộ Nội vụ';
  if (/BGTVT|BỘ GIAO THÔNG/i.test(combined)) return 'Bộ Giao thông vận tải';
  if (/BNN|BỘ NÔNG NGHIỆP/i.test(combined)) return 'Bộ Nông nghiệp và Phát triển nông thôn';
  if (/NHNN|NGÂN HÀNG NHÀ NƯỚC/i.test(combined)) return 'Ngân hàng Nhà nước Việt Nam';
  if (/UBND TỈNH|ỦY BAN NHÂN DÂN TỈNH|QĐ-UBND/i.test(combined)) return 'UBND tỉnh Lâm Đồng';
  if (/HĐND TỈNH|HỘI ĐỒNG NHÂN DÂN TỈNH|NQ-HĐND/i.test(combined)) return 'HĐND tỉnh Lâm Đồng';
  if (/NĐ-CP|NQ-CP|CHÍNH PHỦ/i.test(combined)) return 'Chính phủ';
  if (/QH\d+|NQ-QH|QUỐC HỘI/i.test(combined)) return 'Quốc hội';
  if (/UBTVQH/i.test(combined)) return 'Ủy ban Thường vụ Quốc hội';
  if (/QĐ-TTG|CĐ-TTG|THỦ TƯỚNG/i.test(combined)) return 'Thủ tướng Chính phủ';
  return 'Cơ quan nhà nước';
}

async function updateIssuers() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vbai_db');
  const docs = await db.collection('known_documents').find({}).toArray();

  let count = 0;
  for (const d of docs) {
    const num = d.document_number || d.documentNumber || '';
    const title = d.title || '';
    const resolvedIssuer = detectIssuer(title, num);
    if (resolvedIssuer !== d.issuer && resolvedIssuer !== 'Cơ quan nhà nước') {
      await db.collection('known_documents').updateOne(
        { _id: d._id },
        { $set: { issuer: resolvedIssuer } }
      );
      count++;
      console.log(`Updated [${num}]: "${d.issuer}" -> "${resolvedIssuer}"`);
    }
  }

  console.log(`Total issuers updated: ${count}`);
  await client.close();
}

updateIssuers().catch(console.error);
