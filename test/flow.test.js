import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tools } from '../src/tools.js';

function run(args, env) {
  return new Promise(resolve => { const p = spawn(process.execPath, ['bin/pixalera.js', ...args], { env: { ...process.env, ...env, NO_COLOR: '1' } }); let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('close', code => resolve({ code, out, err })); p.stdin.end(); });
}
test('CLI creates, schedules, publishes and reads back through authenticated MCP (local fixture)', async () => {
  let post; const calls = []; const app = express(); app.use(express.json());
  app.post('/mcp/fixture-key', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    const server = new Server({ name: 'fixture', version: '1' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: tools.map(({ cli, run, ...t }) => t) }));
    server.setRequestHandler(CallToolRequestSchema, req => {
      calls.push(req.params); const a = req.params.arguments;
      if (req.params.name === 'create_post') post = { id: 'p_fixture', caption: a.caption, platforms: a.platforms, status: 'draft' };
      if (req.params.name === 'schedule_post') post = { ...post, status: 'scheduled', scheduled_at: a.scheduled_at };
      if (req.params.name === 'publish_post_now') post = { ...post, status: 'published' };
      return { content: [{ type: 'text', text: JSON.stringify({ post }) }] };
    });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport); await transport.handleRequest(req, res, req.body);
  });
  const http = app.listen(0, '127.0.0.1'); await new Promise(resolve => http.once('listening', resolve));
  const env = { PIXALERA_API_URL: `http://127.0.0.1:${http.address().port}`, PIXALERA_API_KEY: 'fixture-key' };
  try {
    let r = await run(['create-post', '--caption', 'Hello creators', '--platforms', '["facebook"]', '--yes'], env);
    assert.equal(r.code, 0, r.err); assert.match(r.out, /draft/); assert.match(r.out, /Read-back/);
    r = await run(['schedule', '--post_id', 'p_fixture', '--scheduled_at', '2099-01-15T10:00:00+05:30', '--yes'], env);
    assert.equal(r.code, 0, r.err); assert.match(r.out, /scheduled/);
    r = await run(['publish', '--post_id', 'p_fixture'], env);
    assert.equal(r.code, 1); assert.match(r.err, /explicit approval/); assert.equal(post.status, 'scheduled');
    r = await run(['publish', '--post_id', 'p_fixture', '--yes'], env);
    assert.equal(r.code, 0, r.err); assert.match(r.out, /published/);
    assert.deepEqual(calls[0].arguments, { caption: 'Hello creators', platforms: ['facebook'] });
    assert.equal(calls.filter(c => c.name === 'get_post').length, 3);
  } finally { http.close(); }
});
