#!/usr/bin/env node
/**
 * Manually trigger a price check on all "Purchases · Monitoring Price" cards.
 * The automation server runs this automatically every Sunday at 08:00 UTC.
 *
 * Usage:
 *   GOOGLE_API_KEY=... GOOGLE_CX=... node scripts/run-price-check.mjs
 */

import { loadCredentials } from './lib/credentials.mjs';
import { runPriceCheck } from './lib/price-check.mjs';

const { apiKey, token } = loadCredentials();
const boardId = process.env.BOARD_ID ?? '65a2a15ad03c80037bd890ad';

await runPriceCheck({ apiKey, token, boardId });
