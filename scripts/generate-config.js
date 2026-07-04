/**
 * Netlify build step — writes config.js from environment variables.
 * Set in Netlify: Site settings → Environment variables
 *   WS_URL=wss://your-app.fly.dev
 *   API_URL=https://your-app.fly.dev
 *   DISCORD_CLIENT_ID=your_app_id
 */

const fs = require('fs');
const path = require('path');

const isNetlify = process.env.NETLIFY === 'true';

const config = {
    WS_URL: process.env.WS_URL || (isNetlify ? 'wss://tiltcheck-royale.fly.dev' : 'ws://localhost:8080'),
    API_URL: process.env.API_URL || (isNetlify ? 'https://tiltcheck-royale.fly.dev' : 'http://localhost:8080'),
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1507876760686039071',
};

const out = `/**
 * Generated at build time — do not edit on Netlify; change env vars instead.
 */
window.APP_CONFIG = ${JSON.stringify(config, null, 4)};
`;

const target = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(target, out, 'utf8');
console.log('Wrote config.js for', config.API_URL);
