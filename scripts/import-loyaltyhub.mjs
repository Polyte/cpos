#!/usr/bin/env node

/* Import LoyaltyHub's paged catalogue into Product Cloud. */
// Required: ADMIN_EMAIL and ADMIN_PASSWORD
// Optional: SUPABASE_PROJECT_ID, SUPABASE_ANON_KEY, BATCH_SIZE (default 250), START_OFFSET (default 0)

import fs from 'node:fs';

const info = fs.readFileSync(new URL('../utils/supabase/info.tsx', import.meta.url), 'utf8');
const projectId = process.env.SUPABASE_PROJECT_ID || info.match(/projectId\s*=\s*"([^"]+)/)?.[1];
const anonKey = process.env.SUPABASE_ANON_KEY || info.match(/publicAnonKey\s*=\s*"([^"]+)/)?.[1];
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const batchSize = Math.min(Math.max(Number(process.env.BATCH_SIZE || 250), 1), 500);
let offset = Math.max(Number(process.env.START_OFFSET || 0), 0);

if (!projectId || !anonKey || !email || !password) {
  console.error('Missing ADMIN_EMAIL, ADMIN_PASSWORD, or Supabase project configuration.');
  process.exit(1);
}

const server = `https://${projectId}.supabase.co/functions/v1/make-server-69ad2d15`;

async function request(url, options = {}, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || attempt === attempts || ![429, 500, 502, 503, 504].includes(response.status)) return response;
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
}

const loginResponse = await request(`${server}/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${anonKey}` },
  body: JSON.stringify({ email, password }),
});
const login = await loginResponse.json();
if (!loginResponse.ok || !login.token) throw new Error(`Admin login failed: ${login.error || loginResponse.status}`);

let totalImported = 0;
while (true) {
  const response = await request(`${server}/product-cloud/import-loyaltyhub-catalog`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${login.token}`, apikey: anonKey },
    body: JSON.stringify({ offset, limit: batchSize }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(`Import failed at offset ${offset}: ${result.error || response.status}`);
  totalImported += result.imported || 0;
  console.log(`Imported ${result.imported} rows at offset ${offset} (run total: ${totalImported})`);
  if (!result.hasMore || result.discovered === 0) break;
  offset += batchSize;
}

console.log(`Finished. Imported ${totalImported} LoyaltyHub catalogue rows.`);
