// scripts/inject-secrets.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../google-services.json');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  const apiKey = (process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
  
  if (apiKey) {
    // Programmatically inject Firebase API Key into JSON path: client[0].api_key[0].current_key
    try {
      const data = JSON.parse(content);
      if (data && data.client && data.client[0] && data.client[0].api_key && data.client[0].api_key[0]) {
        data.client[0].api_key[0].current_key = apiKey;
        content = JSON.stringify(data, null, 2);
      }
    } catch (e) {
      console.warn('⚠️ JSON parse error on google-services.json, falling back to string replacement:', e.message);
    }

    // Also replace placeholder with the actual API Key if it's still present in string form
    content = content.replace("REPLACE_WITH_YOUR_FIREBASE_API_KEY", apiKey);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully injected Firebase API key into google-services.json');
  } else {
    console.warn('⚠️ Warning: FIREBASE_API_KEY / EXPO_PUBLIC_FIREBASE_API_KEY is not defined in the environment. Skipping secret injection.');
  }
} else {
  console.error('❌ Error: google-services.json file was not found.');
  process.exit(1);
}

