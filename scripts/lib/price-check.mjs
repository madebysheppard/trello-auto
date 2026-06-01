import { buildSearchQuery, searchPrices, formatPriceComment } from './price-search.mjs';

const BASE  = 'https://api.trello.com/1';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function trello(apiKey, token, method, path, body) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', token);

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

/**
 * Runs a price check on all cards in "Purchases · Monitoring Price".
 * Posts a comment on each card with current search results.
 */
export async function runPriceCheck({ apiKey, token, boardId }) {
  const lists = await trello(apiKey, token, 'GET', `/boards/${boardId}/lists?filter=open`);
  const monitoringList = lists.find((l) => l.name === 'Purchases · Monitoring Price');

  if (!monitoringList) {
    console.log('[price-check] No "Purchases · Monitoring Price" list found');
    return;
  }

  const cards = await trello(apiKey, token, 'GET', `/lists/${monitoringList.id}/cards?filter=open`);
  if (!cards?.length) {
    console.log('[price-check] No cards to check');
    return;
  }

  console.log(`[price-check] Checking ${cards.length} card(s)…`);

  for (const card of cards) {
    try {
      const query = buildSearchQuery(card.name, card.desc ?? '');
      console.log(`[price-check] ${card.name} → "${query}"`);

      const results = await searchPrices(query);
      const comment = formatPriceComment(card.name, query, results);

      await trello(apiKey, token, 'POST', `/cards/${card.id}/actions/comments`, { text: comment });
      console.log(`[price-check] Posted ${results.length} result(s) on "${card.name}"`);
    } catch (err) {
      console.error(`[price-check] Error on "${card.name}": ${err.message}`);
    }

    await delay(500); // stay well within API rate limits
  }

  console.log('[price-check] Done');
}
