#!/usr/bin/env node
/**
 * Registers (or re-registers) the Phase 1 automation webhook with Trello.
 *
 * Usage:
 *   node scripts/register-webhook.mjs <callback-url>
 *
 * Example with ngrok:
 *   node scripts/register-webhook.mjs https://abc123.ngrok.io
 *
 * The callback URL must be publicly reachable over HTTPS.
 * Trello will send a HEAD request to verify it before registration succeeds.
 *
 * To list existing webhooks:
 *   node scripts/register-webhook.mjs --list
 *
 * To delete a webhook:
 *   node scripts/register-webhook.mjs --delete <webhookId>
 */

import { loadCredentials } from './lib/credentials.mjs';

const { apiKey: API_KEY, token: TOKEN } = loadCredentials();
const BOARD_ID = process.env.BOARD_ID ?? '65a2a15ad03c80037bd890ad';

const BASE = 'https://api.trello.com/1';

async function trello(method, path, body) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('token', TOKEN);

  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const [,, arg, extra] = process.argv;

if (arg === '--list') {
  const hooks = await trello('GET', `/tokens/${TOKEN}/webhooks`);
  if (!hooks?.length) {
    console.log('No webhooks registered.');
  } else {
    for (const h of hooks) {
      console.log(`${h.id}  active=${h.active}  ${h.callbackURL}`);
      console.log(`         model: ${h.idModel}  description: ${h.description ?? '—'}`);
    }
  }
  process.exit(0);
}

if (arg === '--delete') {
  if (!extra) { console.error('Provide a webhook ID'); process.exit(1); }
  await trello('DELETE', `/webhooks/${extra}`);
  console.log(`Deleted webhook ${extra}`);
  process.exit(0);
}

const callbackUrl = arg;
if (!callbackUrl?.startsWith('http')) {
  console.error('Usage: node scripts/register-webhook.mjs <callback-url>');
  console.error('       node scripts/register-webhook.mjs --list');
  console.error('       node scripts/register-webhook.mjs --delete <id>');
  process.exit(1);
}

// Remove any existing webhooks pointing at this board to avoid duplicates
const existing = await trello('GET', `/tokens/${TOKEN}/webhooks`);
for (const h of existing ?? []) {
  if (h.idModel === BOARD_ID) {
    await trello('DELETE', `/webhooks/${h.id}`);
    console.log(`Removed existing webhook ${h.id}`);
  }
}

const webhook = await trello('POST', '/webhooks', {
  description: 'House board Phase 1 automations',
  callbackURL: callbackUrl,
  idModel: BOARD_ID,
});

console.log(`Registered webhook: ${webhook.id}`);
console.log(`Callback: ${webhook.callbackURL}`);
console.log(`Active: ${webhook.active}`);
