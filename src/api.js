import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getApiBase, getApiKey } from './config.js';

export async function withClient(callback) {
  const base = new URL(getApiBase());
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use HTTPS for the Pixalera server.');
  const client = new Client({ name: 'pixalera-cli', version: '0.2.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${getApiBase()}/mcp/${encodeURIComponent(getApiKey())}`), { requestInit: { redirect: 'error' } });
  try { await client.connect(transport); return await callback(client); }
  catch (error) {
    const message = String(error?.message || error).split(getApiKey()).join('[redacted]');
    throw new Error(message.replace(/\/mcp\/[^\s"<>]+/g, '/mcp/[redacted]'));
  } finally { await client.close().catch(() => {}); }
}
export const listRemoteTools = () => withClient(async client => {
  const all = []; let cursor;
  do { const page = await client.listTools(cursor ? { cursor } : {}); all.push(...page.tools); cursor = page.nextCursor; } while (cursor);
  return all;
});
export const callRemote = (name, args) => withClient(client => client.callTool({ name, arguments: args }));
export function resultData(result) {
  if (result.isError) throw new Error((result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n') || 'Pixalera could not complete this command.');
  const text = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  try { return JSON.parse(text); } catch { return text; }
}
