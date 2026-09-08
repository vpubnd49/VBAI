const { MongoClient } = require('mongodb');

async function verify() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vbai_db');

  const nums = ['71/2026/TT-BGDĐT', '98/2023/QH15', '136/2024/QH15'];
  for (const n of nums) {
    const d = await db.collection('known_documents').findOne({
      $or: [{ document_number: n }, { documentNumber: n }]
    });
    console.log(`=== Doc: ${n} ===`);
    if (d) {
      console.log('Title:', d.title);
      console.log('Issuer:', d.issuer);
      console.log('Issue Date:', d.issue_date);
      console.log('Summary:', d.tom_tat_chinh_sach);
      console.log('Detail:', d.noi_dung_chi_tiet);
      console.log('URLs:', d.official_source_urls);
    } else {
      console.log('NOT FOUND!');
    }
  }
  await client.close();
}

verify().catch(console.error);
