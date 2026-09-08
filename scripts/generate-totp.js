/**
 * Generate a new TOTP secret
 * Run: node scripts/generate-totp.js
 */
const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim();
      if (key && val) process.env[key] = val;
    }
  });
}

const { generateSecret, generateCode } = require('../lib/totp');

async function generateTOTP() {
  console.log('=== Generate TOTP Secret ===\n');

  const secret = generateSecret();
  console.log('New TOTP Secret:');
  console.log(`  ${secret}`);
  console.log('');

  // Generate current code
  const code = await generateCode(secret);
  console.log('Current TOTP Code (for testing):');
  console.log(`  ${code}`);
  console.log('');

  // Generate otpauth URL
  const otpauth = `otpauth://totp/Ahmad%20Portfolio%20Admin?secret=${secret}&issuer=Ahmad%20Portfolio`;
  console.log('OTP Auth URL (for QR code):');
  console.log(`  ${otpauth}`);
  console.log('');

  console.log('=== Setup Instructions ===');
  console.log('');
  console.log('1. Add this to your .env.local:');
  console.log(`   TOTP_SECRET=${secret}`);
  console.log('');
  console.log('2. Scan the QR code with Google Authenticator:');
  console.log('   - Open Google Authenticator app');
  console.log('   - Tap "+" → "Scan QR code"');
  console.log('   - Or enter the secret manually');
  console.log('');
  console.log('3. Restart your dev server:');
  console.log('   npm run dev');
  console.log('');
  console.log('4. Go to the admin panel and sign in with Google');
  console.log('   You will be prompted for the TOTP code');
  console.log('');
}

generateTOTP().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
