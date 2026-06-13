// scripts/inject-secrets.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../google-services.json');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
  
  if (apiKey) {
    // Replace placeholder with the actual API Key
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
