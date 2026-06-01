#!/usr/bin/env node
/**
 * Phase 1 automation server — receives Trello webhook events and applies board rules:
 *
 *   • Card → "Purchases · Monitoring Price"
 *       Add "Monitoring" label, set due +7 days, comment "Price monitoring started."
 *
 *   • Card → "Move · Waiting On Others"
 *       Set due +14 days
 *
 *   • Card → any "· Completed" list
 *       Mark dueComplete: true
 *
 * Usage:
 *   node scripts/automation-server.mjs
 *   PORT=3001 node scripts/automation-server.mjs
 *
 * Credentials are read from .cursor/mcp.json automatically.
 * Trello must be able to reach this server over HTTPS.
 * For local dev, use ngrok: ngrok http 3000
 * Then register the public URL: node scripts/register-webhook.mjs <ngrok-url>
 */

import http from 'http';
import { loadCredentials } from './lib/credentials.mjs';
import { archiveCompleted } from './lib/archive.mjs';
import { runPriceCheck } from './lib/price-check.mjs';

const { apiKey: API_KEY, token: TOKEN } = loadCredentials();
const PORT    = parseInt(process.env.PORT ?? '3000', 10);
const BOARD_ID = process.env.BOARD_ID ?? '65a2a15ad03c80037bd890ad';

const BASE = 'https://api.trello.com/1';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

// --- Board state cache ---

let listNameById = new Map();   // id → name
let monitoringLabelId = null;

async function refreshBoardState() {
  const [lists, labels] = await Promise.all([
    trello('GET', `/boards/${BOARD_ID}/lists?filter=open`),
    trello('GET', `/boards/${BOARD_ID}/labels`),
  ]);

  listNameById = new Map(lists.map((l) => [l.id, l.name]));

  const monitoringLabel = labels.find((l) => l.name === 'Monitoring');
  monitoringLabelId = monitoringLabel?.id ?? null;

  console.log(`[init] Loaded ${listNameById.size} lists, monitoring label: ${monitoringLabelId ?? 'NOT FOUND'}`);
}

// --- Automation rules ---

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function onCardMovedToMonitoringPrice(cardId) {
  console.log(`[rule] Monitoring Price → card ${cardId}`);

  const updates = { due: daysFromNow(7) };

  if (monitoringLabelId) {
    const card = await trello('GET', `/cards/${cardId}?fields=idLabels`);
    const currentLabels = card.idLabels ?? [];
    if (!currentLabels.includes(monitoringLabelId)) {
      updates.idLabels = [...currentLabels, monitoringLabelId].join(',');
    }
  }

  await trello('PUT', `/cards/${cardId}`, updates);
  await delay(100);
  await trello('POST', `/cards/${cardId}/actions/comments`, {
    text: 'Price monitoring started. Due date set to +7 days for first check.',
  });
}

async function onCardMovedToWaitingOnOthers(cardId) {
  console.log(`[rule] Waiting On Others → card ${cardId}`);
  await trello('PUT', `/cards/${cardId}`, { due: daysFromNow(14) });
}

async function onCardMovedToCompleted(cardId) {
  console.log(`[rule] Completed → card ${cardId}`);
  await trello('PUT', `/cards/${cardId}`, { dueComplete: true });
}

// --- Webhook event handler ---

async function handleEvent(payload) {
  const action = payload?.action;
  if (!action) return;

  // We only care about card moves
  if (action.type !== 'updateCard') return;
  const { card, listAfter } = action.data ?? {};
  if (!listAfter) return;

  const cardId = card?.id;
  const listName = listAfter.name ?? listNameById.get(listAfter.id);

  if (!cardId || !listName) return;

  if (listName === 'Purchases · Monitoring Price') {
    await onCardMovedToMonitoringPrice(cardId);
  } else if (listName === 'Move · Waiting On Others') {
    await onCardMovedToWaitingOnOthers(cardId);
  } else if (listName.endsWith('· Completed') || listName.endsWith('Completed')) {
    await onCardMovedToCompleted(cardId);
  }
}

// --- HTTP server ---

const server = http.createServer((req, res) => {
  // Trello sends HEAD to verify the webhook endpoint exists
  if (req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    res.writeHead(200);
    res.end();

    try {
      const payload = JSON.parse(body);
      await handleEvent(payload);
    } catch (err) {
      console.error('[error]', err.message);
    }
  });
});

// --- Scheduled price check (every Sunday at 08:00 UTC) ---

function schedulePriceCheck() {
  const now = new Date();
  const next = new Date();
  // Roll forward to next Sunday
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  next.setUTCDate(now.getUTCDate() + daysUntilSunday);
  next.setUTCHours(8, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  const msUntilNext = next - now;

  setTimeout(async () => {
    console.log('[cron] Running weekly price check…');
    try {
      await runPriceCheck({ apiKey: API_KEY, token: TOKEN, boardId: BOARD_ID });
    } catch (err) {
      console.error('[cron] Price check error:', err.message);
    }
    schedulePriceCheck();
  }, msUntilNext);

  console.log(`[cron] Price check scheduled for ${next.toISOString()}`);
}

// --- Scheduled archive (daily at 06:00 UTC) ---

function scheduleDailyArchive() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(6, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntilNext = next - now;

  setTimeout(async () => {
    console.log('[cron] Running daily archive check…');
    try {
      await archiveCompleted({ apiKey: API_KEY, token: TOKEN, boardId: BOARD_ID });
    } catch (err) {
      console.error('[cron] Archive error:', err.message);
    }
    scheduleDailyArchive();
  }, msUntilNext);

  console.log(`[cron] Archive check scheduled for ${next.toISOString()}`);
}

// --- Start ---


await refreshBoardState();

server.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log('[server] Register this with Trello using:');
  console.log(`[server]   node scripts/register-webhook.mjs <your-public-https-url>`);
});

scheduleDailyArchive();
schedulePriceCheck();
