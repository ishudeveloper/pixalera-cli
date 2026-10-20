import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { listRemoteTools, callRemote } from './api.js';
import { validateInput } from './tools.js';

export async function startMcpServer() {
  const server = new Server({ name: 'pixalera-cli', version: '0.2.0' }, { capabilities: { tools: {} }, instructions: 'Tools act on real Pixalera accounts. Confirm mutations with the user, especially publishing publicly and spending credits. Prefer drafts.' });
  let catalog;
  server.setRequestHandler(ListToolsRequestSchema, async () => { catalog = await listRemoteTools(); return { tools: catalog }; });
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      catalog ||= await listRemoteTools();
      const tool = catalog.find(t => t.name === request.params.name);
      if (!tool) throw new Error('Unknown tool. Refresh tools/list.');
      const args = validateInput(tool, request.params.arguments || {});
      return await callRemote(tool.name, args);
    } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
  });
  await server.connect(new StdioServerTransport());
}
