import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, ctxFor, sh } from './helpers.mjs';
import { combine } from '../../core/policy/lib/decision.mjs';
import { laneFindings, laneAfterCall, contextTokens, laneTranscript } from '../../core/policy/lib/lanes.mjs';
import { verifyDone, laneStop } from '../../core/policy/lib/gates.mjs';
import { writeState } from '../../core/policy/lib/context.mjs';

const TINY_BUDGET = { budget: { warn: 1000, block: 2000 }, gates: { full: 'sh ./check.sh', maxAttempts: 2 } };

// A session transcript and a lane transcript whose latest call used `tokens` of context.
function transcripts(dir, tokens) {
  const session = path.join(dir, '..', `${path.basename(dir)}-session.jsonl`);
  const lane = `${session.replace(/\.jsonl$/, '')}/subagents/agent-a1.jsonl`;
  fs.mkdirSync(path.dirname(lane), { recursive: true });
  const line = (n) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', usage: { input_tokens: 10, cache_read_input_tokens: n - 10, cache_creation_input_tokens: 0 } } });
  fs.writeFileSync(session, `${line(500)}\n`);
  fs.writeFileSync(lane, `${line(300)}\n${line(tokens)}\n{"type":"user"}\n`);
  return session;
}

const lane = (dir, session, extra = {}) => ({ cwd: dir, transcript_path: session, agent_id: 'a1', agent_type: 'frontend-engineer', ...extra });

test('lanes may not spawn agents; the lead may', () => {
  const { dir } = makeRepo();
  const ctxLane = ctxFor(dir, { agent_id: 'a1', agent_type: 'frontend-engineer' });
  assert.equal(combine(laneFindings({ tool_name: 'Agent', agent_id: 'a1' }, ctxLane)).decision, 'deny');
  assert.equal(combine(laneFindings({ tool_name: 'Agent' }, ctxFor(dir))).decision, 'allow');
});

test('the lane transcript is derived from the harness-provided session path', () => {
  assert.equal(laneTranscript({ transcript_path: '/p/s1.jsonl', agent_id: 'abc' }), '/p/s1/subagents/agent-abc.jsonl');
  assert.equal(laneTranscript({ agent_transcript_path: '/x.jsonl' }), '/x.jsonl');
  assert.equal(contextTokens('/does/not/exist.jsonl'), null);
});

test('over the hard cap a lane is denied everything except handing over', () => {
  const { dir } = makeRepo(TINY_BUDGET);
  const session = transcripts(dir, 2500);
  const input = (tool_name, tool_input) => lane(dir, session, { tool_name, tool_input });
  const ctx = ctxFor(dir, input('Bash', {}));
  assert.equal(contextTokens(laneTranscript(input('Bash', {}))), 2500);
  assert.equal(combine(laneFindings(input('Bash', { command: 'npm run build' }), ctx)).decision, 'deny');
  assert.equal(combine(laneFindings(input('Bash', { command: 'ls src' }), ctx)).decision, 'deny', 'reading is work too (found live)');
  assert.equal(combine(laneFindings(input('Bash', { command: 'cat src/a.ts' }), ctx)).decision, 'deny');
  assert.equal(combine(laneFindings(input('Bash', { command: 'bash .claude/skills/handover/scripts/handover.sh fe-1' }), ctx)).decision, 'allow');
  assert.equal(combine(laneFindings(input('Edit', { file_path: path.join(dir, 'src/a.ts') }), ctx)).decision, 'deny');
  assert.equal(combine(laneFindings(input('Bash', { command: 'git add src/a.ts && git commit -m wip && git push' }), ctx)).decision, 'allow');
  assert.equal(combine(laneFindings(input('Write', { file_path: path.join(dir, '.forge/handoffs/fe-1-handover.md') }), ctx)).decision, 'allow');
});

test('past the warning line the lane is told to hand over, at most every 10 calls', () => {
  const { dir } = makeRepo(TINY_BUDGET);
  const session = transcripts(dir, 1500);
  const input = lane(dir, session, { tool_name: 'Bash', tool_input: { command: 'ls' } });
  const ctx = ctxFor(dir, input);
  assert.match(laneAfterCall(input, ctx), /Context budget warning: 2k/);
  assert.equal(laneAfterCall(input, ctx), null);
});

test('past its handover line the lead keeps working: it updates its handover and Claude Code compacts (decision 93)', () => {
  const { dir } = makeRepo({ ...TINY_BUDGET, budget: { ...TINY_BUDGET.budget, leadWarn: 150000 } });
  const session = path.join(dir, '..', `${path.basename(dir)}-lead.jsonl`);
  fs.writeFileSync(session, `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', usage: { input_tokens: 10, cache_read_input_tokens: 159990, cache_creation_input_tokens: 0 } } })}\n`);
  const input = { cwd: dir, transcript_path: session, tool_name: 'Bash', tool_input: { command: 'ls' } };
  const note = laneAfterCall(input, ctxFor(dir, input));
  assert.match(note, /Lead context is 160k \(handover line 150k\)\. Bring \.forge\/handoffs\/lead-handover\.md up to date now/);
  assert.match(note, /keep working: Claude Code compacts this conversation before it reaches 250k/);
  assert.match(note, /Do not stop to ask for \/clear/);
});

test('an engineer lane with 25 calls and no edit is stopped; reviewers are not', () => {
  const { dir } = makeRepo();
  const ctx = ctxFor(dir, { agent_id: 'a2', agent_type: 'frontend-engineer' });
  writeState(ctx, 'lanes/a2.json', { calls: 25, edits: 0 });
  const call = { tool_name: 'Bash', tool_input: { command: 'grep -rn x src' }, agent_id: 'a2' };
  assert.equal(combine(laneFindings(call, ctx)).decision, 'deny');
  assert.equal(combine(laneFindings({ ...call, tool_name: 'Edit', tool_input: { file_path: 'x' } }, ctx)).decision, 'allow');
  const reviewer = ctxFor(dir, { agent_id: 'a2', agent_type: 'code-reviewer' });
  assert.equal(combine(laneFindings(call, reviewer)).decision, 'allow');
});

test('done needs a clean, pushed branch with passing gates', () => {
  const { dir } = makeRepo();
  const ctx = ctxFor(dir);
  fs.writeFileSync(path.join(dir, 'src.ts'), 'x');
  assert.match(verifyDone(ctx, dir).reason, /Uncommitted changes/);
  sh(dir, 'git', 'add', 'src.ts');
  sh(dir, 'git', 'commit', '-q', '-m', 'feat: x');
  assert.match(verifyDone(ctx, dir).reason, /no upstream/);
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'feat/1-login');
  fs.writeFileSync(path.join(dir, 'status.txt'), 'broken\n');
  sh(dir, 'git', 'commit', '-q', '-am', 'test: break');
  sh(dir, 'git', 'push', '-q');
  const failed = verifyDone(ctx, dir);
  assert.equal(failed.ok, false);
  assert.match(failed.reason, /Gates failed on feat\/1-login.*exit 1/s);
  fs.writeFileSync(path.join(dir, 'status.txt'), 'ok\n');
  sh(dir, 'git', 'commit', '-q', '-am', 'fix: repair');
  sh(dir, 'git', 'push', '-q');
  assert.equal(verifyDone(ctx, dir).ok, true);
  assert.equal(verifyDone(ctx, dir).cached, true);
  sh(dir, 'git', 'checkout', '-q', 'main');
  assert.equal(verifyDone(ctx, dir, 'feat/1-login').ok, true, 'recorded result is reused for another branch');
  assert.equal(verifyDone(ctx, dir).ok, false, 'never done on main');
});

test('no gate command configured means nothing can be marked done', () => {
  const { dir } = makeRepo({ gates: { full: '' } });
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'feat/1-login');
  assert.match(verifyDone(ctxFor(dir), dir).reason, /No gate command/);
});

test('SubagentStop keeps an engineer lane working until gates pass, then gives up loudly', () => {
  const { dir } = makeRepo(TINY_BUDGET);
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'feat/1-login');
  fs.writeFileSync(path.join(dir, 'status.txt'), 'broken\n');
  sh(dir, 'git', 'commit', '-q', '-am', 'test: break');
  sh(dir, 'git', 'push', '-q');
  const input = { cwd: dir, agent_id: 'a9', agent_type: 'frontend-engineer', hook_event_name: 'SubagentStop' };
  const ctx = ctxFor(dir, input);
  assert.equal(laneStop(input, ctx).decision, 'block');
  assert.match(laneStop(input, ctx).reason, /attempt 2 of 2/);
  assert.match(laneStop(input, ctx).systemMessage, /GATES-FAILED/);
  assert.equal(laneStop({ ...input, agent_type: 'code-reviewer' }, ctxFor(dir, { ...input, agent_type: 'code-reviewer' })), null);
});
