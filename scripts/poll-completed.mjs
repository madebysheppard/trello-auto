#!/usr/bin/env node
/**
 * Archives cards that have been sitting in any "· Completed" list for more than
 * ARCHIVE_AFTER_DAYS (default 30). Run this on a schedule (e.g. daily cron or
 * manually each Sunday during the weekly review).
 *
 * How it works:
 *   1. Fetch all open cards on every "· Completed" list.
 *   2. For each card, look at its action history to find when it was last moved
 *      into a Completed list.
 *   3. Archive (close) cards where that move happened > ARCHIVE_AFTER_DAYS ago.
 *
 * Usage:
 *   node scripts/poll-completed.mjs
 *   ARCHIVE_AFTER_DAYS=14 node scripts/poll-completed.mjs
 *   DRY_RUN=1 node scripts/poll-completed.mjs
 */

import { loadCredentials } from './lib/credentials.mjs';

const { apiKey: API_KEY, token: TOKEN } = loadCredentials();
const BOARD_ID          = process.env.BOARD_ID ?? '65a2a15ad03c80037bd890ad';
const ARCHIVE_AFTER_DAYS = parseInt(process.env.ARCHIVE_AFTER_DAYS ?? '30', 10);
const DRY_RUN           = process.env.DRY_RUN === '1';

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

function isCompletedList(name) {
  return name.endsWith('· Completed') || name === 'Completed';
}

function daysAgo(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Returns the ISO date when the card was most recently moved into a Completed list,
 * or null if no such action is found.
 */
async function findCompletedMoveDate(cardId) {
  const actions = await trello(
    'GET',
    `/cards/${cardId}/actions?filter=updateCard&fields=date,data&limit=50`
  );

  // Actions are newest-first; find the most recent move into a Completed list
  for (const action of actions ?? []) {
    const listAfter = action.data?.listAfter?.name;
    if (listAfter && isCompletedList(listAfter)) {
      return action.date;
    }
  }
  return null;
}

async function main() {
  if (DRY_RUN) console.log('[dry-run] No cards will actually be archived.\n');

  const lists = await trello('GET', `/boards/${BOARD_ID}/lists?filter=open`);
  const completedLists = lists.filter((l) => isCompletedList(l.name));

  console.log(`Found ${completedLists.length} Completed lists: ${completedLists.map((l) => l.name).join(', ')}`);

  let checked = 0;
  let archived = 0;
  let skipped = 0;

  for (const list of completedLists) {
    const cards = await trello('GET', `/lists/${list.id}/cards?filter=open`);
    if (!cards?.length) continue;

    console.log(`\n${list.name} — ${cards.length} open card(s)`);

    for (const card of cards) {
      checked++;
      const movedDate = await findCompletedMoveDate(card.id);
      await delay(80); // stay within rate limits

      if (!movedDate) {
        console.log(`  skip  ${card.name} (no move action found)`);
        skipped++;
        continue;
      }

      const age = daysAgo(movedDate);
      const ageLabel = `${Math.floor(age)}d`;

      if (age >= ARCHIVE_AFTER_DAYS) {
        console.log(`  archive  ${card.name}  (in Completed for ${ageLabel})`);
        if (!DRY_RUN) {
          await trello('PUT', `/cards/${card.id}`, { closed: true });
          await delay(120);
        }
        archived++;
      } else {
        const remaining = Math.ceil(ARCHIVE_AFTER_DAYS - age);
        console.log(`  keep     ${card.name}  (${ageLabel} old, ${remaining}d until archive)`);
      }
    }
  }

  console.log(`\nDone. Checked: ${checked}  Archived: ${archived}  Skipped: ${skipped}`);
  if (DRY_RUN && archived > 0) {
    console.log(`(dry-run: re-run without DRY_RUN=1 to apply)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
