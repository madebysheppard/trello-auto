#!/usr/bin/env node
/**
 * Archives cards that have been in any "· Completed" list for more than
 * ARCHIVE_AFTER_DAYS (default 30). The automation server runs this daily
 * at 06:00 UTC automatically. Use this script for manual runs.
 *
 * Usage:
 *   node scripts/poll-completed.mjs
 *   ARCHIVE_AFTER_DAYS=14 node scripts/poll-completed.mjs
 *   DRY_RUN=1 node scripts/poll-completed.mjs
 */

import { loadCredentials } from './lib/credentials.mjs';
import { archiveCompleted } from './lib/archive.mjs';

const { apiKey, token } = loadCredentials();
const boardId         = process.env.BOARD_ID ?? '65a2a15ad03c80037bd890ad';
const archiveAfterDays = parseInt(process.env.ARCHIVE_AFTER_DAYS ?? '30', 10);
const dryRun          = process.env.DRY_RUN === '1';

if (dryRun) console.log('[dry-run] No cards will be archived.\n');

await archiveCompleted({ apiKey, token, boardId, archiveAfterDays, dryRun });
