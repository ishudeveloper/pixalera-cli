export function tokenize(line) {
  const tokens = []; let token = '', quote = null, escaped = false, active = false;
  for (const c of line) {
    if (escaped) { token += c; escaped = false; active = true; continue; }
    if (c === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) { if (c === quote) quote = null; else token += c; active = true; continue; }
    if (c === '"' || c === "'") { quote = c; active = true; }
    else if (/\s/.test(c)) { if (active) { tokens.push(token); token = ''; active = false; } }
    else { token += c; active = true; }
  }
  if (quote || escaped) throw new Error('Close the quote or escape before running the command.');
  if (active) tokens.push(token);
  return tokens;
}
export function parseFlags(list, tool) {
  const out = {}; const props = tool?.inputSchema.properties || {};
  const aliases = { content: 'caption', id: 'post_id', scheduledAt: 'scheduled_at', mediaUrls: 'media_urls' };
  for (let i = 0; i < list.length; i++) {
    if (!list[i].startsWith('--')) throw new Error(`Expected a flag, received ${list[i]}`);
    const [raw, ...rest] = list[i].slice(2).split('='); const key = aliases[raw] || raw;
    let value = rest.length ? rest.join('=') : (list[i + 1] !== undefined && !list[i + 1].startsWith('--') ? list[++i] : true);
    if (key !== 'yes' && key !== 'key' && !props[key]) throw new Error(`Unknown flag --${raw}. Use --help for supported fields.`);
    const type = props[key]?.type;
    if (type === 'array' || type === 'object') { try { value = JSON.parse(value); } catch { throw new Error(`--${raw} needs valid JSON.`); } }
    if (type === 'number' || type === 'integer') value = Number(value);
    if (type === 'boolean') value = value === true || value === 'true' ? true : value === 'false' ? false : value;
    out[key] = value;
  }
  return out;
}
export function suggestions(line, commands) {
  return commands.filter(c => c.startsWith(line)).sort();
}
