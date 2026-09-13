import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const catalogFile = process.env.CATALOG_FILE || '/data/runtime-games.json';
const catalogTemplate = process.env.CATALOG_TEMPLATE_FILE || '/data/games.json';

try {
  if (!fs.existsSync(catalogFile)) {
    fs.mkdirSync(path.dirname(catalogFile), { recursive: true });
    fs.copyFileSync(catalogTemplate, catalogFile);
    console.log(`[library-manager] Runtime catalog initialized from ${catalogTemplate}`);
  }
} catch (error) {
  console.error(`[library-manager] Could not initialize runtime catalog: ${error.message}`);
}

if (!process.env.ADMIN_TOKEN || String(process.env.ADMIN_TOKEN).length < 16) {
  const tokenFile = process.env.ADMIN_TOKEN_FILE || path.join(path.dirname(catalogFile), 'admin-token');
  try {
    let token = '';
    if (fs.existsSync(tokenFile)) token = fs.readFileSync(tokenFile, 'utf8').trim();
    if (token.length < 16) {
      token = crypto.randomBytes(24).toString('hex');
      fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
    }
    process.env.ADMIN_TOKEN = token;
    console.log(`[library-manager] ADMIN_TOKEN loaded from ${tokenFile}`);
  } catch (error) {
    console.error(`[library-manager] Could not create/read admin token: ${error.message}`);
  }
}
