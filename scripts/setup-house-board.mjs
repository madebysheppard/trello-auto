#!/usr/bin/env node
/**
 * Transforms the "To Watch..." board into House Move & Home Management.
 * Usage: node scripts/setup-house-board.mjs
 */

import { loadCredentials } from './lib/credentials.mjs';

const { apiKey: API_KEY, token: TOKEN } = loadCredentials();
const BOARD_ID = '65a2a15ad03c80037bd890ad';

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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const BOARD_DESC = `A Trello-based operating system for moving house, furnishing it, maintaining it, and reducing ongoing household costs.

## Objectives
- Manage the house move from offer acceptance through completion
- Track all purchases required before and after moving
- Monitor products for discounts and price drops
- Manage home improvement projects and recurring maintenance
- Track household contracts and renewals
- Provide automated reminders and savings opportunities

## Technology Stack
**Core:** Trello · Google Drive · Google Sheets · Gmail · Calendar
**Future:** Make.com · OpenAI · Airtable · PriceRunner · HotUKDeals

## Weekly Routine (Every Sunday)
1. Review Move list
2. Review Purchases list
3. Check Deal Found items
4. Schedule next week's work
5. Archive completed cards
6. Review upcoming renewals

Target: 15–30 min weekly household admin review.`;

const LABELS = [
  { name: '🔴 Critical', color: 'red' },
  { name: '🟠 High', color: 'orange' },
  { name: '🟡 Medium', color: 'yellow' },
  { name: '🟢 Low', color: 'green' },
  { name: '🏠 Property', color: 'blue' },
  { name: '⚖️ Legal', color: 'purple' },
  { name: '💰 Finance', color: 'lime' },
  { name: '🛒 Purchase', color: 'sky' },
  { name: '🔧 Maintenance', color: 'black' },
  { name: '🌳 Garden', color: 'green_dark' },
  { name: 'Monitoring', color: 'yellow_dark' },
];

const LISTS = [
  '📋 System Guide',
  'Move · Backlog',
  'Move · Next Up',
  'Move · Waiting On Others',
  'Move · Scheduled',
  'Move · Completed',
  'Purchases · Need',
  'Purchases · Researching',
  'Purchases · Monitoring Price',
  'Purchases · Deal Found',
  'Purchases · Purchased',
  'Projects · Ideas',
  'Projects · Planned',
  'Projects · Ready',
  'Projects · In Progress',
  'Projects · Waiting',
  'Projects · Completed',
  'Maintenance · Upcoming',
  'Maintenance · This Month',
  'Maintenance · Completed',
  'Renewals · Future',
  'Renewals · Due Soon',
  'Renewals · Reviewing',
  'Renewals · Completed',
  'Documents · Purchase',
  'Documents · Property',
  'Documents · Household',
];

const PURCHASE_TEMPLATE = `**Item:**
**Category:**
**Preferred Brand:**
**Preferred Model:**

**Target Price:**
**Maximum Price:**

**Needed By:**
**Priority:**

**Notes:**`;

function card(name, desc = '', labels = [], due = null) {
  return { name, desc, labels, due };
}

const CARDS_BY_LIST = {
  '📋 System Guide': [
    card(
      '📖 How to use this board',
      `This board is your household operating system.

**Sections**
- **Move** — pre-completion tasks (legal, utilities, logistics)
- **Purchases** — spending decisions with target prices
- **Projects** — home improvements and upgrades
- **Maintenance** — recurring upkeep
- **Renewals & Savings** — contracts and cost reviews
- **Documents** — links to Google Drive files

**Butler automations (Phase 1)**
- *Monitoring Price* → add Monitoring label, due +7 days, comment "Price monitoring started."
- *Waiting On Others* → due +14 days, yellow label
- *Completed* → mark complete, archive after 30 days

**Automation roadmap**
- Phase 2: Price tracking via Google Sheet
- Phase 3: AI deal assessment
- Phase 4: Annual review + maintenance scheduler

**Success criteria**
Every house task on the board · every purchase has a target price · no missed renewals · maintenance scheduled · favourable prices on large purchases · 15–30 min weekly review.`,
      ['🟡 Medium']
    ),
    card(
      '☀️ Weekly review checklist',
      `Every **Sunday** (15–30 min):

- [ ] Review Move list
- [ ] Review Purchases list
- [ ] Check Deal Found items
- [ ] Schedule next week's work
- [ ] Archive completed cards
- [ ] Review upcoming renewals`,
      ['🟡 Medium']
    ),
  ],

  'Move · Backlog': [
    card('Receive mortgage offer', '', ['⚖️ Legal', '🔴 Critical']),
    card('Review survey', '', ['⚖️ Legal', '🏠 Property', '🔴 Critical']),
    card('Raise solicitor enquiries', '', ['⚖️ Legal', '🟠 High']),
    card('Exchange contracts', '', ['⚖️ Legal', '🔴 Critical']),
    card('Complete purchase', '', ['⚖️ Legal', '🔴 Critical']),
    card('Arrange broadband', '', ['🏠 Property', '🟠 High']),
    card('Arrange energy supplier', '', ['🏠 Property', '💰 Finance', '🔴 Critical']),
    card('Arrange council tax', '', ['🏠 Property', '💰 Finance', '🟠 High']),
    card('Book removals', '', ['🏠 Property', '🟠 High']),
    card('Redirect mail', '', ['🏠 Property', '🟡 Medium']),
    card('Update driving licence', '', ['🏠 Property', '🟡 Medium']),
    card('Update electoral roll', '', ['🏠 Property', '🟡 Medium']),
  ],

  'Purchases · Need': [
    card('Washing machine', `${PURCHASE_TEMPLATE}\n\n_Category: Essential_`, ['🛒 Purchase', '🔴 Critical']),
    card('Fridge freezer', `${PURCHASE_TEMPLATE}\n\n_Category: Essential_`, ['🛒 Purchase', '🔴 Critical']),
    card('Curtains', `${PURCHASE_TEMPLATE}\n\n_Category: Essential_`, ['🛒 Purchase', '🟠 High']),
    card('Cot', `${PURCHASE_TEMPLATE}\n\n_Category: Essential_`, ['🛒 Purchase', '🟠 High']),
    card('Sofa', `${PURCHASE_TEMPLATE}\n\n_Category: Furniture_`, ['🛒 Purchase', '🟠 High']),
    card('Dining table', `${PURCHASE_TEMPLATE}\n\n_Category: Furniture_`, ['🛒 Purchase', '🟡 Medium']),
    card('Office desk', `${PURCHASE_TEMPLATE}\n\n_Category: Furniture_`, ['🛒 Purchase', '🟡 Medium']),
    card('Lawn mower', `${PURCHASE_TEMPLATE}\n\n_Category: Garden_`, ['🛒 Purchase', '🌳 Garden', '🟡 Medium']),
    card('Storage box', `${PURCHASE_TEMPLATE}\n\n_Category: Garden_`, ['🛒 Purchase', '🌳 Garden', '🟢 Low']),
    card('Hose', `${PURCHASE_TEMPLATE}\n\n_Category: Garden_`, ['🛒 Purchase', '🌳 Garden', '🟢 Low']),
    card('Lamps', `${PURCHASE_TEMPLATE}\n\n_Category: Decor_`, ['🛒 Purchase', '🟢 Low']),
    card('Shelving', `${PURCHASE_TEMPLATE}\n\n_Category: Decor_`, ['🛒 Purchase', '🟢 Low']),
    card('Mirrors', `${PURCHASE_TEMPLATE}\n\n_Category: Decor_`, ['🛒 Purchase', '🟢 Low']),
  ],

  'Projects · Ideas': [
    card('Paint nursery', '_Immediate_', ['🏠 Property', '🟠 High']),
    card('Install shelving', '_Immediate_', ['🏠 Property', '🟡 Medium']),
    card('Replace locks', '_Immediate_', ['🏠 Property', '🔴 Critical']),
    card('Improve loft insulation', '_Medium term_', ['🏠 Property', '💰 Finance', '🟡 Medium']),
    card('Create office space', '_Medium term_', ['🏠 Property', '🟡 Medium']),
    card('Build garden storage', '_Medium term_', ['🌳 Garden', '🟡 Medium']),
    card('Kitchen renovation', '_Long term_', ['🏠 Property', '💰 Finance', '🟢 Low']),
    card('Bathroom renovation', '_Long term_', ['🏠 Property', '💰 Finance', '🟢 Low']),
  ],

  'Maintenance · Upcoming': [
    card('Test smoke alarms', '_Monthly_', ['🔧 Maintenance', '🔴 Critical']),
    card('Check boiler pressure', '_Monthly_', ['🔧 Maintenance', '🟠 High']),
    card('Clean extractor filters', '_Quarterly_', ['🔧 Maintenance', '🟡 Medium']),
    card('Inspect gutters', '_Quarterly_', ['🔧 Maintenance', '🌳 Garden', '🟡 Medium']),
    card('Boiler service', '_Annual_', ['🔧 Maintenance', '🔴 Critical']),
    card('Renew insurance', '_Annual_', ['🔧 Maintenance', '💰 Finance', '🔴 Critical']),
    card('Clean carpets', '_Annual_', ['🔧 Maintenance', '🟢 Low']),
  ],

  'Renewals · Future': [
    card('Broadband', '_Utilities — track provider & contract end date_', ['💰 Finance', '🟠 High']),
    card('Mobile contracts', '_Utilities_', ['💰 Finance', '🟡 Medium']),
    card('Energy tariff', '_Utilities — notify if saving > £100/year_', ['💰 Finance', '🔴 Critical']),
    card('Home insurance', '_Insurance_', ['💰 Finance', '🔴 Critical']),
    card('Life insurance', '_Insurance_', ['💰 Finance', '🟠 High']),
    card('Pet insurance', '_Insurance_', ['💰 Finance', '🟢 Low']),
    card('Mortgage review', '_Finance — annual January review_', ['💰 Finance', '🟠 High']),
    card('Savings account review', '_Finance — annual January review_', ['💰 Finance', '🟡 Medium']),
  ],

  'Documents · Purchase': [
    card('Survey', '_Link to Google Drive document_', ['🏠 Property', '⚖️ Legal']),
    card('Searches', '_Link to Google Drive document_', ['⚖️ Legal']),
    card('Mortgage offer', '_Link to Google Drive document_', ['💰 Finance', '⚖️ Legal']),
  ],

  'Documents · Property': [
    card('EPC', '_Link to Google Drive document_', ['🏠 Property']),
    card('Warranties', '_Link to Google Drive document_', ['🏠 Property']),
    card('Building certificates', '_Link to Google Drive document_', ['🏠 Property']),
  ],

  'Documents · Household': [
    card('Insurance policies', '_Link to Google Drive document_', ['💰 Finance']),
    card('Appliance manuals', '_Link to Google Drive document_', ['🏠 Property']),
  ],
};

const NEW_LIST_PREFIXES = [
  '📋',
  'Move ·',
  'Purchases ·',
  'Projects ·',
  'Maintenance ·',
  'Renewals ·',
  'Documents ·',
];

async function archiveLegacyCards() {
  const lists = await trello('GET', `/boards/${BOARD_ID}/lists?filter=all`);
  const newListIds = new Set(
    lists.filter((l) => NEW_LIST_PREFIXES.some((p) => l.name.startsWith(p))).map((l) => l.id)
  );
  const cards = await trello('GET', `/boards/${BOARD_ID}/cards?filter=open`);
  let archived = 0;
  for (const c of cards) {
    if (!c.closed && !newListIds.has(c.idList)) {
      await trello('PUT', `/cards/${c.id}`, { closed: true });
      archived++;
      await delay(80);
    }
  }
  return archived;
}

async function main() {
  const archiveOnly = process.argv.includes('--archive-only');

  if (archiveOnly) {
    const archived = await archiveLegacyCards();
    console.log(`Archived ${archived} legacy cards`);
    return;
  }

  console.log('Renaming board and setting description…');
  await trello('PUT', `/boards/${BOARD_ID}`, {
    name: 'House Move & Home Management',
    desc: BOARD_DESC,
  });

  console.log('Archiving old cards…');
  const archived = await archiveLegacyCards();
  console.log(`  Archived ${archived} cards`);

  console.log('Replacing labels…');
  const existingLabels = await trello('GET', `/boards/${BOARD_ID}/labels`);
  for (const label of existingLabels) {
    await trello('DELETE', `/labels/${label.id}`);
    await delay(80);
  }
  const labelMap = {};
  for (const { name, color } of LABELS) {
    const created = await trello('POST', '/labels', {
      name,
      color,
      idBoard: BOARD_ID,
    });
    labelMap[name] = created.id;
    await delay(80);
  }

  console.log('Creating lists…');
  const listMap = {};
  let pos = 16384;
  for (const name of LISTS) {
    const created = await trello('POST', '/lists', {
      name,
      idBoard: BOARD_ID,
      pos,
    });
    listMap[name] = created.id;
    pos += 16384;
    await delay(100);
  }

  console.log('Creating cards…');
  let cardCount = 0;
  for (const [listName, cardsToCreate] of Object.entries(CARDS_BY_LIST)) {
    const listId = listMap[listName];
    if (!listId) {
      console.warn(`  Missing list: ${listName}`);
      continue;
    }
    for (const { name, desc, labels } of cardsToCreate) {
      const idLabels = labels.map((l) => labelMap[l]).filter(Boolean);
      await trello('POST', '/cards', {
        name,
        desc,
        idList: listId,
        idLabels,
        pos: 'bottom',
      });
      cardCount++;
      await delay(120);
    }
  }

  const board = await trello('GET', `/boards/${BOARD_ID}?fields=name,url,shortUrl`);
  console.log('\nDone!');
  console.log(`Board: ${board.name}`);
  console.log(`URL: ${board.shortUrl}`);
  console.log(`Lists: ${LISTS.length} · Labels: ${LABELS.length} · Cards: ${cardCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
