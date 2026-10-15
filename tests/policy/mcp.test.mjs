// MCP tools (decision 91): only Figma's server and the ones policy.mcp.allow names, through the hook entry point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, writeProjectConfig, DEFAULT_TEST_CONFIG } from './helpers.mjs';
import { serverPrefix } from '../../core/policy/lib/mcp.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/policy/bin/forge-hook.mjs');

function pre(dir, tool_name, tool_input = {}, extra = {}) {
  const payload = { hook_event_name: 'PreToolUse', cwd: dir, permission_mode: 'default', session_id: 's', transcript_path: '/nonexistent/s.jsonl', tool_name, tool_input, ...extra };
  const r = spawnSync('node', [BIN, 'pre-tool-use'], { input: JSON.stringify(payload), encoding: 'utf8', cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const out = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { decision: out?.permissionDecision ?? 'allow', reason: out?.permissionDecisionReason ?? '' };
}
const LANE = { agent_id: 'a1', agent_type: 'frontend-engineer' };

test("server names map to the tool names Claude Code gives them", () => {
  assert.equal(serverPrefix('plugin:figma:figma'), 'mcp__plugin_figma_figma__');
  assert.equal(serverPrefix('claude.ai Notion'), 'mcp__claude_ai_Notion__');
});

test("Figma's tools pass, for the lead and for lanes", () => {
  const { dir } = makeRepo();
  assert.equal(pre(dir, 'mcp__plugin_figma_figma__get_screenshot', { nodeId: '1:2' }).decision, 'allow');
  assert.equal(pre(dir, 'mcp__plugin_figma_figma__get_metadata', { nodeId: '1:2' }, LANE).decision, 'allow');
  assert.equal(pre(dir, 'ReadMcpResourceTool', { server: 'plugin:figma:figma', uri: 'file://x' }).decision, 'allow');
});

test("any other MCP tool is refused, the person's connectors among them", () => {
  const { dir } = makeRepo();
  for (const [tool, input, extra] of [
    ['mcp__claude_ai_Gmail__send_email', { to: 'x@example.com' }, {}],
    ['mcp__claude_ai_Notion__notion-search', { query: 'x' }, LANE],
    ['mcp__gitlab__create_merge_request', {}, {}],
  ]) {
    const r = pre(dir, tool, input, extra);
    assert.equal(r.decision, 'deny', tool);
    assert.match(r.reason, /\[mcp:not-allowed\] .* not allowed in this project: .*mcp__plugin_figma_figma__.*policy\.mcp\.allow/, tool);
  }
});

test("reading another server's resources is refused, and so is reading without naming a server", () => {
  const { dir } = makeRepo();
  assert.equal(pre(dir, 'ReadMcpResourceTool', { server: 'claude.ai Notion', uri: 'notion://page' }).decision, 'deny');
  const r = pre(dir, 'ListMcpResourcesTool', {});
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /ListMcpResourcesTool without naming an allowed server/);
});

test('policy.mcp.allow lets a server in by its prefix; a project can name its own Figma server', () => {
  const { dir } = makeRepo(null);
  writeProjectConfig(dir, { policy: { ...DEFAULT_TEST_CONFIG, mcp: { allow: ['mcp__playwright__'] } }, project: { figma: { toolPrefix: 'mcp__figma__' } } });
  assert.equal(pre(dir, 'mcp__playwright__browser_snapshot').decision, 'allow');
  assert.equal(pre(dir, 'ListMcpResourcesTool', { server: 'playwright' }).decision, 'allow');
  assert.equal(pre(dir, 'mcp__figma__get_screenshot').decision, 'allow');
  assert.equal(pre(dir, 'mcp__plugin_figma_figma__get_screenshot').decision, 'deny', 'only the prefix the project names');
});

test('a policy.mcp.allow that is not a list of strings makes the config invalid', () => {
  const { dir } = makeRepo(null);
  writeProjectConfig(dir, { policy: { ...DEFAULT_TEST_CONFIG, mcp: { allow: 'mcp__x__' } } });
  const r = pre(dir, 'mcp__plugin_figma_figma__get_screenshot');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /mcp\.allow must be a list of strings/);
});
