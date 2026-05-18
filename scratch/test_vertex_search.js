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

  const query = 'Luật Cán bộ công chức mới nhất 80/2025/QH15';
  console.log(`Executing Vertex Search for query: "${query}" in data store: vbai-legal-search...`);
  
  const endpoint = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/global/collections/default_collection/dataStores/vbai-legal-search/servingConfigs/default_search:search`;
  
  const body = {
    query: query,
    pageSize: 5,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Error executing search:', JSON.stringify(err, null, 2));
    process.exit(1);
  }

  const data = await response.json();
  const results = data.results || [];
  console.log('==================================================');
  console.log(`Found ${results.length} results:`);
  results.forEach((r, i) => {
    const doc = r.document || {};
    const derived = doc.derivedStructData || {};
    console.log(`\nResult ${i + 1}:`);
    console.log(`- Title: ${derived.title}`);
    console.log(`- Link: ${derived.link}`);
    if (derived.snippets && derived.snippets.length > 0) {
      console.log(`- Snippet: ${derived.snippets[0].snippet}`);
    }
  });
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
});
