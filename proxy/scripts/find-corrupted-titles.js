const { MongoClient } = require('mongodb');

async function checkCorrupted() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vbai_db');
  const docs = await db.collection('known_documents').find({}).toArray();

  console.log(`Total documents in known_documents: ${docs.length}`);

  const corrupted = [];
  for (const d of docs) {
    const title = d.title || '';
    const summary = d.tom_tat_chinh_sach || d.summary || '';
    const num = d.document_number || d.documentNumber || '';

    const isBad = (txt) => {
      if (!txt) return false;
      return /dataLayer|function\s*\(|gtag\(|_govaq|@context|schema\.org|document\.getElementById|\$\(document\)|var\s+\w+|let\s+\w+|const\s+\w+|setInterval\(|window\.|<script|<style/i.test(txt);
    };

    if (isBad(title) || isBad(summary) || title.startsWith('{') || title.startsWith('[')) {
      corrupted.push({
        num,
        titleLen: title.length,
        titlePreview: title.slice(0, 100).replace(/\n/g, ' '),
        summaryPreview: summary.slice(0, 100).replace(/\n/g, ' ')
      });
    }
  }

  console.log(`Found ${corrupted.length} corrupted documents:`);
  for (const c of corrupted) {
    console.log(`- ${c.num} | Title: "${c.titlePreview}"...`);
  }

  await client.close();
}

checkCorrupted().catch(console.error);
