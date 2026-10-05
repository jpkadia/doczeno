/**
 * Secure environment synchronization script
 * Reads Doczeno/env.txt safely and produces .env.local without logging secret values.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envTxtPath = path.join(process.cwd(), 'env.txt');
const envLocalPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envTxtPath)) {
  console.log('[setup-env] No env.txt found, skipping sync.');
  process.exit(0);
}

const content = fs.readFileSync(envTxtPath, 'utf8');
const lines = content.split('\n');

const mapped = {};
let inSuperadminSection = false;

for (let rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  if (line.toLowerCase().startsWith('superadmin')) {
    inSuperadminSection = true;
    continue;
  }

  const separatorIndex = line.indexOf(':');
  const equalIndex = line.indexOf('=');
  let splitIndex = -1;

  if (separatorIndex !== -1 && equalIndex !== -1) {
    splitIndex = Math.min(separatorIndex, equalIndex);
  } else if (separatorIndex !== -1) {
    splitIndex = separatorIndex;
  } else if (equalIndex !== -1) {
    splitIndex = equalIndex;
  }

  if (splitIndex === -1) continue;

  const key = line.slice(0, splitIndex).trim();
  const value = line.slice(splitIndex + 1).trim();

  const lowerKey = key.toLowerCase();

  if (lowerKey.includes('mongo uri') || lowerKey === 'mongodb_uri') {
    mapped['MONGODB_URI'] = value;
  } else if (lowerKey.includes('mongo db username')) {
    mapped['MONGODB_USER'] = value;
  } else if (lowerKey.includes('mongo db password')) {
    mapped['MONGODB_PASSWORD'] = value;
  } else if (lowerKey === 'cloudinary_url') {
    mapped['CLOUDINARY_URL'] = value;
  } else if (lowerKey.includes('cloudinary key name') || lowerKey.includes('cloudinary cloud name')) {
    mapped['CLOUDINARY_CLOUD_NAME'] = value;
  } else if (lowerKey.includes('cloudinary api key')) {
    mapped['CLOUDINARY_API_KEY'] = value;
  } else if (lowerKey.includes('cloudinary api secret')) {
    mapped['CLOUDINARY_API_SECRET'] = value;
  } else if (lowerKey.includes('brevo api') || lowerKey === 'brevo_api_key') {
    mapped['BREVO_API_KEY'] = value;
  } else if (lowerKey.includes('brevo sender mail') || lowerKey === 'brevo_sender_email') {
    mapped['BREVO_SENDER_EMAIL'] = value;
  } else if (inSuperadminSection && lowerKey === 'email') {
    mapped['SUPERADMIN_EMAIL'] = value;
  } else if (inSuperadminSection && lowerKey === 'password') {
    mapped['SUPERADMIN_PASSWORD'] = value;
  } else if (lowerKey === 'better_auth_secret') {
    mapped['BETTER_AUTH_SECRET'] = value;
  } else if (lowerKey === 'better_auth_url') {
    mapped['BETTER_AUTH_URL'] = value;
  } else if (lowerKey === 'gemini_api_key') {
    mapped['GEMINI_API_KEY'] = value;
  }
}

// Generate secure random secret for Better Auth if not present
if (!mapped['BETTER_AUTH_SECRET']) {
  // If .env.local already exists and has a generated secret, preserve it
  if (fs.existsSync(envLocalPath)) {
    const existing = fs.readFileSync(envLocalPath, 'utf8');
    const match = existing.match(/^BETTER_AUTH_SECRET=(.+)$/m);
    if (match && match[1]) {
      mapped['BETTER_AUTH_SECRET'] = match[1].trim();
    }
  }
  if (!mapped['BETTER_AUTH_SECRET']) {
    mapped['BETTER_AUTH_SECRET'] = crypto.randomBytes(32).toString('hex');
  }
}

if (!mapped['BETTER_AUTH_URL']) {
  mapped['BETTER_AUTH_URL'] = 'http://localhost:3000';
}

if (!mapped['NEXT_PUBLIC_APP_URL']) {
  mapped['NEXT_PUBLIC_APP_URL'] = 'http://localhost:3000';
}

if (!mapped['NODE_ENV']) {
  mapped['NODE_ENV'] = 'development';
}

const envOutput = Object.entries(mapped)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');

fs.writeFileSync(envLocalPath, envOutput + '\n', { encoding: 'utf8', mode: 0o600 });
console.log(`[setup-env] Successfully synchronized ${Object.keys(mapped).length} environment variables to .env.local without exposing values.`);
