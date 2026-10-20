import { createInterface } from 'node:readline';
import { input, password, select as baseSelect, checkbox, confirm } from '@inquirer/prompts';
import { saveConfig, getApiBase } from './config.js';
import { listRemoteTools } from './api.js';
import { tools, wrapTool, validateInput } from './tools.js';
import { tokenize, parseFlags, suggestions } from './commands.js';
const paint = (code, text) => process.env.NO_COLOR ? text : `\x1b[${code}m${text}\x1b[0m`;
const mint = text => paint('92', text); const dim = text => paint('90', text);
const builtins = ['login', 'logout', 'commands', 'help', 'clear', 'exit', 'refresh', 'whoami'];
async function select(config) {
  const tabNavigation = (_, key) => { if (key?.name === 'tab') key.name = key.shift ? 'up' : 'down'; };
  process.stdin.prependListener('keypress', tabNavigation);
  try { return await baseSelect(config); }
  finally { process.stdin.off('keypress', tabNavigation); }
}
export function banner() {
  console.log('\n' + mint('  ▄█▀█▄   PIXALERA CLI') + '  v0.2.0');
  console.log(mint('  █▄ ▄█') + '   Create · Schedule · Publish');
  console.log(dim(`           ${process.cwd()}\n           ${getApiBase()}\n`));
  console.log('  Your social workspace, one command away.');
  console.log(dim('  /commands to browse · /login to connect · Ctrl+C to exit\n'));
}
export async function login() {
  console.log('Create your API key: https://app.pixalera.in/dashboard/settings?section=developers');
  const key = await password({ message: 'Pixalera API key', mask: '*' });
  if (!key.trim()) throw new Error('No key entered.');
  // Probe before saving so a rejected key never replaces a working one.
  const previous = process.env.PIXALERA_API_KEY;
  process.env.PIXALERA_API_KEY = key.trim();
  try { await listRemoteTools(); saveConfig({ apiKey: key.trim() }); console.log(mint('Account connected. API key saved locally.')); }
  finally { if (previous === undefined) delete process.env.PIXALERA_API_KEY; else process.env.PIXALERA_API_KEY = previous; }
  if (previous) console.log('PIXALERA_API_KEY is set and still overrides the saved key.');
}
async function field(name, schema, required, draft, registry) {
  const message = `${name}${required ? '' : ' (optional)'}${schema.description ? ' — ' + schema.description : ''}`;
  if (schema.enum) return select({ message, choices: [...(!required ? [{ name: 'Skip / default', value: undefined }] : []), ...schema.enum.map(v => ({ name: v, value: v }))], pageSize: 8 });
  if (schema.type === 'boolean') return select({ message, choices: [{ name: 'Skip / default', value: undefined }, { name: 'Yes', value: true }, { name: 'No', value: false }] });
  if (name === 'platforms') {
    const channelTool = registry.find(t => t.name === 'list_channels');
    if (channelTool) {
      const data = await channelTool.run({}); const channels = Array.isArray(data) ? data : data?.channels || [];
      const choices = [...new Set(channels.map(c => c.platform).filter(Boolean))].map(p => ({ name: p, value: p }));
      if (choices.length) return checkbox({ message, choices, required });
      if (required) throw new Error('Connect a social account in your dashboard first.');
    }
  }
  const value = await input({ message, validate: value => !required || value.trim() ? true : 'Required field.' });
  if (!value.trim() && !required) return undefined;
  if (schema.type === 'array' || schema.type === 'object') { try { return JSON.parse(value); } catch { throw new Error(`${name} needs valid JSON.`); } }
  if (schema.type === 'number' || schema.type === 'integer') return Number(value);
  return value;
}
export async function guided(tool, registry) {
  const draft = {};
  console.log('\n' + mint(tool.title || tool.cli)); console.log(dim(tool.description));
  const props = tool.inputSchema.properties || {}; const required = tool.inputSchema.required || [];
  for (const [name, schema] of Object.entries(props)) {
    // Advanced composer fields remain available without turning every draft into a long questionnaire.
    if (tool.name === 'create_post' && !['caption', 'platforms', 'media_urls', 'schedule_mode', 'scheduled_at'].includes(name)) continue;
    if (name === 'scheduled_at' && tool.name === 'create_post' && draft.schedule_mode !== 'time') continue;
    if (name === 'scheduled_at' && draft.mode && draft.mode !== 'time') continue;
    const value = await field(name, schema, required.includes(name), draft, registry);
    if (value !== undefined) draft[name] = value;
  }
  validateInput(tool, draft); return draft;
}
export async function execute(tool, args, approved = false) {
  validateInput(tool, args);
  if (!tool.annotations?.readOnlyHint && !approved) {
    console.log(JSON.stringify(args, null, 2));
    const publicNow = tool.name === 'publish_post_now' || args.publish_now || args.schedule_mode === 'publish_now';
    const ok = await confirm({ message: publicNow ? 'Publish publicly now? This cannot be undone.' : tool.name === 'generate_ideas' ? 'Generate ideas and spend account AI credits?' : 'Apply this change to your account?', default: false });
    if (!ok) { console.log('Cancelled. Nothing sent.'); return; }
  }
  console.log(dim('Working…'));
  const data = await tool.run(args);
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  // Read back a changed post rather than pretending a request is proof of publication.
  if (['create_post', 'schedule_post', 'publish_post_now', 'update_post', 'unschedule_post'].includes(tool.name)) {
    const id = args.post_id || data?.post?.id || data?.post_id || data?.id;
    const get = tools.find(t => t.name === 'get_post');
    if (id && get) { try { console.log(dim('Read-back post status:')); console.log(JSON.stringify(await get.run({ post_id: id }), null, 2)); } catch (e) { console.log(`Change returned, but read-back failed: ${e.message}`); } }
  }
  return data;
}
function readCommand(commands, history) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true, history, completer: line => { const matches = suggestions(line, commands); return [matches.length ? matches : [], line]; } });
    rl.setPrompt(mint('❯ ')); rl.prompt();
    rl.on('line', line => { resolve(line); rl.close(); });
    rl.on('SIGINT', () => { resolve('/exit'); rl.close(); });
    rl.on('close', () => resolve('/exit'));
  });
}
export async function startInteractive() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive mode needs a terminal. Use pixalera --help for script commands.');
  banner(); let registry = [...tools]; const history = [];
  while (true) {
    const commands = [...builtins, ...registry.map(t => t.cli)].map(c => '/' + c);
    console.log(dim('─'.repeat(Math.min(process.stdout.columns || 80, 100))));
    const line = await readCommand(commands, history);
    if (!line.trim()) continue;
    if (!line.startsWith('/login') && !line.includes('--key')) history.unshift(line);
    try {
      const [raw, ...rest] = tokenize(line); const cmd = raw?.replace(/^\//, '');
      if (cmd === 'exit' || cmd === 'quit') break;
      if (cmd === 'clear') { console.clear(); banner(); continue; }
      if (cmd === 'login' || cmd === 'init') { await login(); registry = (await listRemoteTools()).map(wrapTool); continue; }
      if (cmd === 'refresh') { registry = (await listRemoteTools()).map(wrapTool); console.log(`${registry.length} account tools loaded.`); continue; }
      if (cmd === 'logout') { saveConfig({ apiKey: null }); console.log('Saved key removed. Any environment key remains active.'); continue; }
      if (cmd === 'help') { console.log('Slash commands, not AI chat. Tab completes commands; Up/Down recall session history. /commands opens searchable actions; arrows navigate, Tab cycles, Space selects channels. Ctrl+C cancels a form.'); continue; }
      let tool;
      if (cmd === 'commands') {
        const choice = await select({ message: 'Choose an action (type to jump, arrows or Tab to switch)', choices: registry.map(t => ({ name: '/' + t.cli + '  —  ' + (t.title || ''), value: t.name })), pageSize: 10, loop: true });
        tool = registry.find(t => t.name === choice);
      } else tool = registry.find(t => t.cli === (cmd === 'whoami' ? 'overview' : cmd) || t.name === cmd);
      if (!tool) { console.log('Unknown command. Open /commands to browse available actions.'); continue; }
      const args = rest.length ? parseFlags(rest, tool) : await guided(tool, registry);
      const approved = args.yes === true; delete args.yes;
      await execute(tool, args, approved);
    } catch (e) {
      if (e?.name === 'ExitPromptError') console.log('Cancelled.'); else console.log(paint('91', e?.message || String(e)));
    }
  }
  console.log(dim('Workspace closed.'));
}
