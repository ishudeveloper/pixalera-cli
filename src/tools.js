import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { callRemote, resultData } from './api.js';
const catalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
const aliases = { get_account_overview: 'overview', list_channels: 'channels', list_posts: 'posts', get_post: 'post', publish_post_now: 'publish', schedule_post: 'schedule', unschedule_post: 'unschedule', get_queue: 'queue', list_ideas: 'ideas', convert_idea_to_post: 'convert-idea', get_analytics_snapshot: 'analytics', get_platform_analytics: 'platform-analytics', list_products: 'products' };
const ajv = new Ajv({ allErrors: true, strict: false });
export function validateInput(tool, args) {
  const check = ajv.compile(tool.inputSchema);
  if (!check(args)) throw new Error(ajv.errorsText(check.errors));
  const time = args.scheduled_at;
  if (time && (!/(Z|[+-]\d{2}:\d{2})$/i.test(time) || !Number.isFinite(Date.parse(time)) || Date.parse(time) <= Date.now())) throw new Error('scheduled_at must be a future ISO date with timezone, e.g. 2027-01-15T10:00:00+05:30.');
  if (tool.name === 'schedule_post' && (!args.mode || args.mode === 'time') && !time) throw new Error('scheduled_at is required for time scheduling.');
  if (tool.name === 'create_post' && args.schedule_mode === 'time' && !time) throw new Error('scheduled_at is required for time scheduling.');
  return args;
}
export function needsConfirmation(tool, args) {
  return !tool.annotations?.readOnlyHint || args.publish_now === true || args.schedule_mode === 'publish_now';
}
export function wrapTool(t) {
  return { ...t, cli: aliases[t.name] || t.name.replaceAll('_', '-'), run: async a => resultData(await callRemote(t.name, validateInput(t, a))) };
}
export const tools = catalog.map(wrapTool);
export const byName = Object.fromEntries(tools.map(t => [t.name, t]));
export const byCli = Object.fromEntries(tools.map(t => [t.cli, t]));
