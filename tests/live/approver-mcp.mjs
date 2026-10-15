#!/usr/bin/env node
// Stands in for the human at permission prompts in live tests (claude -p --permission-prompt-tool).
// MCP server over stdio with one tool, "approve", that always answers <allow|deny> and logs each call.
//   node approver-mcp.mjs <allow|deny> <log file>
import fs from 'node:fs';
import readline from 'node:readline';

const [answer = 'allow', log] = process.argv.slice(2);
const send = (m) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...m })}\n`);

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === 'initialize') {
    send({ id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'approver', version: '1.0.0' } } });
  } else if (msg.method === 'tools/list') {
    send({ id: msg.id, result: { tools: [{ name: 'approve', description: 'Answers permission prompts in tests.', inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, input: { type: 'object' }, tool_use_id: { type: 'string' } }, required: ['tool_name', 'input'] } }] } });
  } else if (msg.method === 'tools/call') {
    const args = msg.params?.arguments || {};
    if (log) fs.appendFileSync(log, `${JSON.stringify({ tool: args.tool_name, input: args.input })}\n`);
    const body = answer === 'allow' ? { behavior: 'allow', updatedInput: args.input } : { behavior: 'deny', message: 'Denied by the test approver.' };
    send({ id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(body) }] } });
  } else if (msg.id !== undefined) {
    send({ id: msg.id, result: {} });
  }
});
