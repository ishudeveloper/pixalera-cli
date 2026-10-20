#!/usr/bin/env node
import { tools, byCli } from '../src/tools.js';
import { parseFlags } from '../src/commands.js';
import { startMcpServer } from '../src/mcp.js';
import { listRemoteTools, resultData, callRemote } from '../src/api.js';
import { saveConfig } from '../src/config.js';
const args = process.argv.slice(2); const command = args[0];
const print = data => console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
function help(tool) {
  if (tool) { console.log(tool.description); console.log(`pixalera ${tool.cli} [flags] [--yes]`); for (const [k, s] of Object.entries(tool.inputSchema.properties || {})) console.log(`  --${k} <${s.type}> ${(tool.inputSchema.required || []).includes(k) ? '(required)' : '(optional)'} ${s.description || ''}`); return; }
  console.log('Pixalera CLI v0.2.0\n\npixalera                  Open interactive workspace\npixalera login            Connect with hidden API key\npixalera mcp              Official stdio MCP bridge\npixalera tools            List live account tools\npixalera whoami           Read account overview\n');
  for (const t of tools) console.log(`  ${t.cli.padEnd(22)} ${t.title}`);
  console.log('\nUse pixalera <command> --help for flags. Write commands require confirmation or --yes for scripts.');
}
async function main() {
  if (!command || command === 'interactive') { const { startInteractive } = await import('../src/interactive.js'); return startInteractive(); }
  if (['help', '--help', '-h'].includes(command)) return help();
  if (command === '--version' || command === '-v') return print('0.2.0');
  if (command === 'mcp') return startMcpServer();
  if (command === 'login' || command === 'init') {
    if (args.includes('--key')) { const flags = parseFlags(args.slice(1)); if (typeof flags.key !== 'string' || !flags.key.trim()) throw new Error('Provide an API key or use pixalera login.'); const prev = process.env.PIXALERA_API_KEY; process.env.PIXALERA_API_KEY = flags.key; try { await listRemoteTools(); saveConfig({ apiKey: flags.key }); print('Account connected. Key saved locally.'); } finally { if (prev === undefined) delete process.env.PIXALERA_API_KEY; else process.env.PIXALERA_API_KEY = prev; } return; }
    const { login } = await import('../src/interactive.js'); return login();
  }
  if (command === 'tools') return print(await listRemoteTools());
  if (command === 'whoami') return print(resultData(await callRemote('get_account_overview', {})));
  const tool = byCli[command] || tools.find(t => t.name === command);
  if (!tool) throw new Error('Unknown command. Run pixalera --help.');
  if (args.includes('--help') || args.includes('-h')) return help(tool);
  const flags = parseFlags(args.slice(1), tool); const approved = flags.yes === true; delete flags.yes;
  if (!tool.annotations?.readOnlyHint && !approved && !process.stdin.isTTY) throw new Error('Write command needs explicit approval. Review arguments and add --yes, or use interactive mode.');
  const { execute } = await import('../src/interactive.js'); await execute(tool, flags, approved);
}
main().catch(e => { console.error(e?.name === 'ExitPromptError' ? 'Cancelled.' : e?.message || String(e)); process.exitCode = 1; });
