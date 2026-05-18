const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'C:/Users/user/AppData/Local/Temp/vbai-service-account.json';
  if (!fs.existsSync(saPath)) {
    console.error(`Missing service account file at: ${saPath}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const projectId = serviceAccount.project_id || 'gen-lang-client-0462350485';

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
  }

  const credential = admin.app().options?.credential;
  const tokenObj = await credential.getAccessToken();
  const accessToken = tokenObj.access_token;
  if (!accessToken) {
    console.error('Failed to generate Google Access Token.');
    process.exit(1);
  }

  const endpoint = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/global/collections/default_collection/dataStores/vbai-legal-search/servingConfigs/default_search:search`;
  const query = 'nội dung ủy quyền của luật 72/2025/qh15';

  // 1. Search WITH so_hieu filter
  console.log('\n--- 1. Testing Search WITH filter: so_hieu = "72/2025/QH15" ---');
  const bodyWithFilter = {
    query: query,
    pageSize: 3,
    filter: 'so_hieu = "72/2025/QH15"',
  };

  const response1 = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bodyWithFilter),
  });

  const data1 = await response1.json();
  if (!response1.ok) {
    console.log('Search with filter failed with error:', JSON.stringify(data1.error));
  } else {
    console.log(`Search with filter returned: ${data1.results ? data1.results.length : 0} results`);
  }

  // 2. Search WITHOUT filter
  console.log('\n--- 2. Testing Search WITHOUT filter ---');
  const bodyWithoutFilter = {
    query: query,
    pageSize: 5,
  };

  const response2 = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bodyWithoutFilter),
  });

  const data2 = await response2.json();
  if (!response2.ok) {
    console.log('Search without filter failed with error:', JSON.stringify(data2.error));
  } else {
    const results = data2.results || [];
    console.log(`Search without filter returned: ${results.length} results`);
    results.forEach((r, i) => {
      const doc = r.document || {};
      const derived = doc.derivedStructData || {};
      console.log(`  [Result ${i + 1}] Title: ${derived.title}`);
      console.log(`             Link: ${derived.link}`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
});
