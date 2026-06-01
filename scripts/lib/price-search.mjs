const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX      = process.env.GOOGLE_CX;

/**
 * Parses a card description using the purchase template to extract item details.
 * Returns an object with brand, model, and other known fields.
 */
export function parseCardDescription(desc = '') {
  const field = (name) => {
    const match = desc.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`, 'i'));
    return match?.[1]?.trim() || null;
  };

  return {
    brand: field('Preferred Brand'),
    model: field('Preferred Model'),
    category: field('Category'),
  };
}

/**
 * Builds a search query from a card name and description.
 * E.g. "Washing machine Bosch Series 4 buy UK"
 */
export function buildSearchQuery(cardName, desc = '') {
  const { brand, model } = parseCardDescription(desc);
  const parts = [cardName];
  if (brand && brand !== '_' && !brand.startsWith('_')) parts.push(brand);
  if (model && model !== '_' && !model.startsWith('_')) parts.push(model);
  parts.push('buy UK');
  return parts.join(' ');
}

/**
 * Searches Google Custom Search for shopping results.
 * Returns up to 5 results as { title, link, snippet } objects.
 */
export async function searchPrices(query) {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    throw new Error('Set GOOGLE_API_KEY and GOOGLE_CX environment variables');
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_API_KEY);
  url.searchParams.set('cx', GOOGLE_CX);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Custom Search failed: ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
  }));
}

/**
 * Formats search results as a Trello comment.
 */
export function formatPriceComment(cardName, query, results) {
  if (!results.length) {
    return `🔍 Weekly price check for **${cardName}**\n\nNo results found for: _${query}_`;
  }

  const lines = results.map((r, i) =>
    `${i + 1}. [${r.title}](${r.link})\n   ${r.snippet}`
  );

  return [
    `🔍 Weekly price check for **${cardName}**`,
    `_Search: ${query}_`,
    '',
    ...lines,
  ].join('\n');
}
