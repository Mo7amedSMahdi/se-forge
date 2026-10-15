// forge metrics (decision 84): which agents belong to a ticket, each reply counted once, the lead's share
// while they ran, and the AI cost cell in metrics.md. Synthetic session logs in Claude Code's layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ticketTokens, recordRow, fmt } from '../../core/cli/metrics.mjs';

const at = (min) => new Date(Date.UTC(2026, 9, 8, 10, min)).toISOString();
const reply = (id, min, model, out, extra = {}) => ({ type: 'assistant', timestamp: at(min), message: { id, model, usage: { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: out } }, ...extra });

function logs() {
  const projects = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-metrics-'));
  const checkout = '/work/portal';
  const dir = path.join(projects, '-work-portal');
  const sub = path.join(dir, 'sess1', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  const write = (file, rows) => fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  // The lead: replies at minutes 0 (before), 15 (during ticket 1), 45 (during ticket 2).
  write(path.join(dir, 'sess1.jsonl'), [reply('L0', 0, 'claude-sonnet-5-5', 1), reply('L1', 15, 'claude-sonnet-5-5', 2), reply('L2', 45, 'claude-sonnet-5-5', 3)]);
  const agent = (id, meta, rows) => { write(path.join(sub, `agent-${id}.jsonl`), rows); fs.writeFileSync(path.join(sub, `agent-${id}.meta.json`), JSON.stringify(meta)); };
  // Ticket 1's planner (opus) and engineer; the engineer's reply is logged three times (one per content block)
  // as it streams: only the last line, with the stop reason, has the final output count.
  const streamed = (out, stop) => { const r = reply('E1', 20, 'claude-sonnet-5-5', out, { gitBranch: 'feat/1-x' }); r.message.stop_reason = stop; return r; };
  agent('p1', { agentType: 'planner', description: 'Plan ticket #1' }, [reply('P1', 10, 'claude-opus-5-5', 50, { gitBranch: 'dev' })]);
  agent('e1', { agentType: 'backend-engineer', description: 'API lane' }, [{ type: 'user', timestamp: at(12), gitBranch: 'dev' }, streamed(5, null), streamed(5, null), streamed(70, 'tool_use')]);
  // Ticket 2's engineer: its first messages carry ticket 1's branch (its worktree started there), the description decides.
  agent('e2', { agentType: 'backend-engineer', description: 'API lane ticket #2' }, [reply('E2', 40, 'claude-sonnet-5-5', 30, { gitBranch: 'feat/1-x' }), reply('E2b', 50, 'claude-sonnet-5-5', 30, { gitBranch: 'feat/2-y' })]);
  // The project manager's board check names no ticket and works on dev: nobody's.
  agent('pm', { agentType: 'project-manager', description: 'Board digest' }, [reply('PM', 5, 'claude-sonnet-5-5', 9, { gitBranch: 'dev' })]);
  return { projects, checkout };
}

test('a ticket gets the agents its description or its branch names, each reply once, and the lead while they ran', () => {
  const { projects, checkout } = logs();
  const r = ticketTokens({ ticket: '1', branch: 'feat/1-x', checkoutDirs: [checkout], projectsDir: projects });
  assert.deepEqual(r.agents.map((a) => a.agent).sort(), ['backend-engineer', 'planner']);
  const sonnet = r.byModel['claude-sonnet-5-5'];
  assert.equal(sonnet.output, 70 + 2, 'the engineer once (not three times, and its final count) and the lead\'s reply at minute 15 only');
  assert.equal(r.byModel['claude-opus-5-5'].output, 50);
  assert.equal(r.total, (10 + 100 + 1000) * 3 + 70 + 2 + 50);
  assert.match(r.cell, /^3\.5k tokens \(sonnet 2\.3k, opus 1\.2k\)$/);
});

test('the description wins over a branch a worktree started on; agents naming no ticket stay out', () => {
  const { projects, checkout } = logs();
  const r = ticketTokens({ ticket: '2', branch: 'feat/2-y', checkoutDirs: [checkout], projectsDir: projects });
  assert.deepEqual(r.agents.map((a) => a.description), ['API lane ticket #2']);
  assert.equal(r.byModel['claude-sonnet-5-5'].output, 30 + 30 + 3, 'its two replies and the lead\'s at minute 45');
  assert.equal(ticketTokens({ ticket: '9', branch: 'feat/9-z', checkoutDirs: [checkout], projectsDir: projects }).agents.length, 0);
});

test('the AI cost cell goes into the ticket\'s row, other cells kept; a missing row is added', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-metrics-')), 'metrics.md');
  fs.writeFileSync(file, '# Metrics: portal\n\n| Ticket | Estimate | Actual | Bugs after release | Rework | AI cost |\n|---|---|---|---|---|---|\n| #1 | 1-2 h | 1.5 h | 0 | none |  |\n\nNotes.\n');
  recordRow(file, '1', '3.5k tokens (sonnet 2.3k, opus 1.2k)');
  recordRow(file, '#2', '1.0M tokens (sonnet 1.0M)');
  assert.equal(fs.readFileSync(file, 'utf8'), '# Metrics: portal\n\n| Ticket | Estimate | Actual | Bugs after release | Rework | AI cost |\n|---|---|---|---|---|---|\n| #1 | 1-2 h | 1.5 h | 0 | none | 3.5k tokens (sonnet 2.3k, opus 1.2k) |\n| #2 |  |  |  |  | 1.0M tokens (sonnet 1.0M) |\n\nNotes.\n');
  assert.equal(fmt(999), '999');
  assert.equal(fmt(1500), '1.5k');
});
