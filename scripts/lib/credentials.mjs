import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const MCP_JSON = resolve(__dir, '../../.cursor/mcp.json');

function fromMcpJson() {
  try {
    const cfg = JSON.parse(readFileSync(MCP_JSON, 'utf8'));
    const env = cfg?.mcpServers?.trello?.env ?? {};
    return { apiKey: env.TRELLO_API_KEY, token: env.TRELLO_TOKEN };
  } catch {
    return {};
  }
}

export function loadCredentials() {
  const fallback = fromMcpJson();
  const apiKey = process.env.TRELLO_API_KEY ?? fallback.apiKey;
  const token  = process.env.TRELLO_TOKEN  ?? fallback.token;

  console.log(`[credentials] TRELLO_API_KEY: ${process.env.TRELLO_API_KEY ? `env (len=${process.env.TRELLO_API_KEY.length})` : fallback.apiKey ? 'mcp.json' : 'MISSING'}`);
  console.log(`[credentials] TRELLO_TOKEN:   ${process.env.TRELLO_TOKEN   ? `env (len=${process.env.TRELLO_TOKEN.length})`   : fallback.token  ? 'mcp.json' : 'MISSING'}`);

  if (!apiKey || !token) {
    console.error('Trello credentials not found. Set TRELLO_API_KEY and TRELLO_TOKEN, or add them to .cursor/mcp.json.');
    process.exit(1);
  }

  return { apiKey, token };
}
