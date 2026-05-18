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

  console.log(`Listing Discovery Engine Data Stores for project: ${projectId}...`);
  const endpoint = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/global/collections/default_collection/dataStores`;
  
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Error fetching data stores:', JSON.stringify(err, null, 2));
    process.exit(1);
  }

  const data = await response.json();
  const dataStores = data.dataStores || [];
  console.log('==================================================');
  console.log(`Found ${dataStores.length} Data Stores:`);
  dataStores.forEach(ds => {
    console.log(`- ID: ${ds.name.split('/').pop()}`);
    console.log(`  Display Name: ${ds.displayName}`);
    console.log(`  Content Config: ${ds.contentConfig}`);
    console.log(`  Create Time: ${ds.createTime}`);
  });
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
});
