const BASE = 'https://api.trello.com/1';
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

function isCompletedList(name) {
  return name.endsWith('· Completed') || name === 'Completed';
}

function daysAgo(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

async function findCompletedMoveDate(apiKey, token, cardId) {
  const actions = await trello(
    apiKey, token, 'GET',
    `/cards/${cardId}/actions?filter=updateCard&fields=date,data&limit=50`
  );
  for (const action of actions ?? []) {
    const listAfter = action.data?.listAfter?.name;
    if (listAfter && isCompletedList(listAfter)) return action.date;
  }
  return null;
}

/**
 * Archives cards that have been in any Completed list for more than archiveAfterDays.
 * @param {{ apiKey: string, token: string, boardId: string, archiveAfterDays?: number, dryRun?: boolean }} opts
 */
export async function archiveCompleted({ apiKey, token, boardId, archiveAfterDays = 30, dryRun = false }) {
  const lists = await trello(apiKey, token, 'GET', `/boards/${boardId}/lists?filter=open`);
  const completedLists = lists.filter((l) => isCompletedList(l.name));

  let checked = 0, archived = 0, skipped = 0;

  for (const list of completedLists) {
    const cards = await trello(apiKey, token, 'GET', `/lists/${list.id}/cards?filter=open`);
    if (!cards?.length) continue;

    for (const card of cards) {
      checked++;
      const movedDate = await findCompletedMoveDate(apiKey, token, card.id);
      await delay(80);

      if (!movedDate) { skipped++; continue; }

      const age = daysAgo(movedDate);
      if (age >= archiveAfterDays) {
        console.log(`[archive] ${card.name} (${Math.floor(age)}d in Completed)`);
        if (!dryRun) {
          await trello(apiKey, token, 'PUT', `/cards/${card.id}`, { closed: true });
          await delay(120);
        }
        archived++;
      }
    }
  }

  console.log(`[archive] Done — checked: ${checked}, archived: ${archived}, skipped: ${skipped}`);
  return { checked, archived, skipped };
}
