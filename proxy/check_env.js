console.log('Environment variables:');
for (const [key, val] of Object.entries(process.env)) {
  if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') || key.toLowerCase().includes('gemini')) {
    console.log(`${key}: ${val ? val.slice(0, 10) + '...' : 'empty'}`);
  }
}
