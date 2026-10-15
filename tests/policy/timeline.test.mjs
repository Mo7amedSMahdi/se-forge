// The timeline (decision 96): every hook event leaves one line, through the hook entry point with the payloads
// Claude Code sends; nothing of it reaches the agent, and it never blocks work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, ctxFor, sh } from './helpers.mjs';
import { verifyDone } from '../../core/policy/lib/gates.mjs';
import { mask } from '../../core/policy/lib/timeline.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/policy/bin/forge-hook.mjs');

function hook(event, payload, cwd) {
  const r = spawnSync('node', [BIN, event], { input: JSON.stringify({ permission_mode: 'default', session_id: 'sess1234abcd', transcript_path: '/nonexistent/s.jsonl', cwd, ...payload }), encoding: 'utf8', cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: cwd } });
  return { code: r.status, stdout: r.stdout, out: r.stdout ? JSON.parse(r.stdout) : null };
}
const lines = (dir) => {
  const state = path.join(dir, '.forge/state');
  return fs.readdirSync(state).filter((f) => /^timeline-.*\.jsonl$/.test(f)).sort()
    .flatMap((f) => fs.readFileSync(path.join(state, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
};
const last = (dir) => lines(dir).at(-1);

test('a tool call: started with what it does, then done with its run time; the line names who, ticket and branch', () => {
  const { dir } = makeRepo();
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git   log --oneline -5' }, tool_use_id: 'toolu_1' }, dir);
  const start = last(dir);
  assert.equal(start.event, 'tool.start');
  assert.deepEqual([start.who, start.ticket, start.branch, start.session, start.tool, start.what, start.id], ['lead', '#1', 'feat/1-login', 'sess1234', 'Bash', 'git log --oneline -5', 'toolu_1']);
  hook('post-tool-use', { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'git log --oneline -5' }, tool_use_id: 'toolu_1', tool_response: { stdout: 'secret output' }, duration_ms: 3120 }, dir);
  const done = last(dir);
  assert.deepEqual([done.event, done.ms, done.id], ['tool.done', 3120, 'toolu_1']);
  assert.doesNotMatch(JSON.stringify(lines(dir)), /secret output/, 'no command output');
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/auth/login.ts'), old_string: 'a', new_string: 'b' }, tool_use_id: 'toolu_2' }, dir);
  assert.equal(last(dir).what, 'src/auth/login.ts', 'a path relative to the checkout, never the content');
});

test('a refusal and an ask carry the rule and the reason; a failure its error', () => {
  const { dir } = makeRepo();
  const r = hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git push origin x:main' }, tool_use_id: 'toolu_3' }, dir);
  assert.equal(r.out.hookSpecificOutput.permissionDecision, 'deny');
  const refused = last(dir);
  assert.deepEqual([refused.event, refused.rule], ['tool.refused', 'git:push-protected']);
  assert.match(refused.why, /Never push to main/);
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git worktree remove --force .claude/worktrees/x' }, tool_use_id: 'toolu_4' }, dir);
  assert.deepEqual([last(dir).event, last(dir).rule], ['tool.ask', 'git:discard']);
  hook('post-tool-use-failure', { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_use_id: 'toolu_5', error: `Exit code 1\n${'x'.repeat(1000)}`, is_interrupt: true, duration_ms: 900 }, dir);
  const failed = last(dir);
  assert.deepEqual([failed.event, failed.ms, failed.interrupted], ['tool.fail', 900, true]);
  assert.ok(failed.why.startsWith('Exit code 1 x') && failed.why.length <= 300);
});

test('secrets never reach the timeline', () => {
  const { dir } = makeRepo();
  const token = `glpat-${'a1B2'.repeat(6)}`;
  const cmds = [
    `GITLAB_TOKEN=${token} glab mr list`,
    'curl -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz" https://api.example.com',
    'git clone https://oauth2:hunter2hunter2@git.example.com/a/b.git',
    'mysql --password=s3cr3tvalue -u root',
  ];
  cmds.forEach((command, i) => hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, tool_use_id: `toolu_s${i}` }, dir));
  const text = JSON.stringify(lines(dir));
  for (const secret of [token, 'abcdefghijklmnopqrstuvwxyz', 'hunter2hunter2', 's3cr3tvalue']) assert.ok(!text.includes(secret), secret);
  assert.equal(mask('PORT=3000 npm start'), 'PORT=3000 npm start', 'ordinary values stay');
});

test('a spawn names its ticket and model; the agent\'s own lines then carry that ticket', () => {
  const { dir } = makeRepo();
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'code-reviewer', description: '#12 code review', prompt: 'Review.' }, tool_use_id: 'toolu_a' }, dir);
  assert.deepEqual([last(dir).event, last(dir).ticket, last(dir).what], ['tool.start', '#12', 'code-reviewer: #12 code review']);
  assert.equal(last(dir).askedModel, undefined, 'no model= on the spawn');
  hook('post-tool-use', { hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'code-reviewer', description: '#12 code review' }, tool_use_id: 'toolu_a', tool_response: { isAsync: true, status: 'async_launched', agentId: 'a7b86aa85a3bee7fa', description: '#12 code review', resolvedModel: 'claude-sonnet-5-5' }, duration_ms: 40 }, dir);
  const spawned = last(dir);
  assert.deepEqual([spawned.spawned, spawned.ticket, spawned.agentModel, spawned.status], ['a7b86aa85a3bee7fa', '#12', 'claude-sonnet-5-5', 'async_launched']);
  const lane = { agent_id: 'a7b86aa85a3bee7fa', agent_type: 'code-reviewer' };
  hook('subagent-start', { hook_event_name: 'SubagentStart', ...lane }, dir);
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(dir, 'docs/user-stories.md') }, tool_use_id: 'toolu_b', ...lane }, dir);
  hook('subagent-stop', { hook_event_name: 'SubagentStop', stop_hook_active: false, ...lane }, dir);
  const mine = lines(dir).filter((e) => e.agent === lane.agent_id);
  assert.deepEqual(mine.map((e) => e.event), ['agent.start', 'tool.start', 'agent.stop']);
  assert.ok(mine.every((e) => e.who === 'code-reviewer' && e.ticket === '#12'), 'ticket from the spawn, not the branch (#1)');
});

test('an engineer sent back by the gates, and the gate check that stopped it', () => {
  const { dir } = makeRepo();
  const r = hook('subagent-stop', { hook_event_name: 'SubagentStop', stop_hook_active: false, agent_id: 'e1', agent_type: 'backend-engineer' }, dir);
  assert.equal(r.out.decision, 'block');
  const [notReady, sentBack] = lines(dir).slice(-2);
  assert.deepEqual([notReady.event, notReady.who, notReady.by], ['gates.not-ready', 'kit', 'backend-engineer']);
  assert.match(notReady.why, /no upstream/);
  assert.deepEqual([sentBack.event, sentBack.who], ['agent.sent-back', 'backend-engineer']);
});

test('gate runs: pass and fail with their run time and why', () => {
  const { dir } = makeRepo();
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'feat/1-login');
  assert.equal(verifyDone(ctxFor(dir), dir).ok, true);
  const pass = last(dir);
  assert.deepEqual([pass.event, pass.who, pass.by, pass.what], ['gates.pass', 'kit', 'human', 'sh ./check.sh']);
  assert.ok(Number.isFinite(pass.ms));
  verifyDone(ctxFor(dir), dir);
  assert.equal(lines(dir).filter((e) => e.event === 'gates.pass').length, 1, 'a recorded result is not a run');
  fs.writeFileSync(path.join(dir, 'status.txt'), 'broken\n');
  sh(dir, 'git', 'commit', '-qam', 'break');
  sh(dir, 'git', 'push', '-q');
  assert.equal(verifyDone(ctxFor(dir), dir).ok, false);
  assert.deepEqual([last(dir).event, last(dir).why], ['gates.fail', 'exit 1:']);
});

test('the lead\'s turn, your messages, compaction, session and API errors; these hooks print nothing', () => {
  const { dir } = makeRepo();
  const quiet = (event, payload) => {
    const r = hook(event, payload, dir);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, '', `${event} prints nothing`);
  };
  quiet('user-prompt-submit', { hook_event_name: 'UserPromptSubmit', prompt: '/pipeline next 1 with my private notes' });
  quiet('user-prompt-submit', { hook_event_name: 'UserPromptSubmit', prompt: '<task-notification><task-id>a1</task-id></task-notification>' });
  quiet('pre-compact', { hook_event_name: 'PreCompact', trigger: 'auto', custom_instructions: '' });
  quiet('post-compact', { hook_event_name: 'PostCompact', trigger: 'auto', compact_summary: 'the summary' });
  quiet('stop-failure', { hook_event_name: 'StopFailure', error: 'rate_limit', error_details: 'Too many requests' });
  quiet('permission-denied', { hook_event_name: 'PermissionDenied', tool_name: 'Bash', tool_input: { command: 'rm -rf build' }, tool_use_id: 'toolu_p', reason: 'auto mode: destructive' });
  quiet('session-end', { hook_event_name: 'SessionEnd', reason: 'clear' });
  hook('stop', { hook_event_name: 'Stop', stop_hook_active: false }, dir);
  hook('session-start', { hook_event_name: 'SessionStart', source: 'resume' }, dir);
  const got = lines(dir);
  assert.deepEqual(got.map((e) => e.event), ['prompt', 'agent.notify', 'compact.start', 'compact.end', 'turn.fail', 'tool.refused', 'session.end', 'turn.end', 'session.start']);
  assert.deepEqual([got[0].who, got[0].what, got[0].chars], ['human', '/pipeline', 38]);
  assert.equal(got[5].rule, 'permission');
  assert.equal(got[4].why, 'rate_limit: Too many requests');
  assert.equal(got[8].source, 'resume');
  const text = JSON.stringify(got);
  assert.ok(!text.includes('private notes') && !text.includes('the summary'), 'no prompt or summary text');
});

test('the timeline never blocks work', () => {
  const { dir } = makeRepo();
  fs.mkdirSync(path.join(dir, '.forge/state', `timeline-${new Date().toISOString().slice(0, 7)}.jsonl`), { recursive: true });
  const r = hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' }, tool_use_id: 'toolu_x' }, dir);
  assert.equal(r.code, 0);
  assert.equal(r.out, null);
  assert.equal(hook('post-tool-use', { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'git status' }, tool_use_id: 'toolu_x', duration_ms: 5 }, dir).code, 0);
});

test('an unlinked checkout gets no timeline', () => {
  const { dir } = makeRepo(null);
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' }, tool_use_id: 'toolu_y' }, dir);
  assert.equal(fs.existsSync(path.join(dir, '.forge/state')) && fs.readdirSync(path.join(dir, '.forge/state')).some((f) => f.startsWith('timeline-')), false);
});

test('a lead whose shell is in another repo (the team repo) still writes its own project\'s timeline', () => {
  const { dir } = makeRepo();
  const other = makeRepo(null).dir;
  const payload = { hook_event_name: 'Stop', stop_hook_active: false, permission_mode: 'default', session_id: 's', transcript_path: '/nonexistent/s.jsonl', cwd: other };
  spawnSync('node', [BIN, 'stop'], { input: JSON.stringify(payload), encoding: 'utf8', cwd: other, env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.equal(last(dir).event, 'turn.end');
  assert.equal(fs.existsSync(path.join(other, '.forge/state')), false, 'nothing lands in the other repo');
});

// A session log as Claude Code writes it: one line per content block of a reply, each with the reply's id, model
// and final usage.
const usage = (n) => ({ input_tokens: n, cache_creation_input_tokens: 10 * n, cache_creation: { ephemeral_5m_input_tokens: 4 * n, ephemeral_1h_input_tokens: 6 * n }, cache_read_input_tokens: 100 * n, output_tokens: 2 * n });
const block = (id, model, n, content, stop = content.type === 'tool_use' ? 'tool_use' : 'end_turn', ts = new Date().toISOString()) => JSON.stringify({ type: 'assistant', timestamp: ts, message: { id, role: 'assistant', model, content: [content], usage: usage(n), stop_reason: stop } });
const result = (toolId) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId, content: 'ok' }] } });

test('each model reply\'s tokens once: the first line that finds the reply claims them; an answer that ends a turn too', () => {
  const { dir } = makeRepo();
  const log = path.join(dir, '..', `${path.basename(dir)}-session.jsonl`);
  fs.writeFileSync(log, `${[
    block('msg_A', 'claude-opus-5-5', 1, { type: 'text', text: 'Two calls.' }),
    block('msg_A', 'claude-opus-5-5', 1, { type: 'tool_use', id: 'toolu_a1', name: 'Bash', input: { command: 'git status' } }),
    result('toolu_a1'),
    block('msg_A', 'claude-opus-5-5', 1, { type: 'tool_use', id: 'toolu_a2', name: 'Bash', input: { command: 'git log' } }),
  ].join('\n')}\n`);
  const call = (id, command) => hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, tool_use_id: id, transcript_path: log }, dir);
  call('toolu_a1', 'git status');
  assert.deepEqual((({ model, reply, input, cacheWrite5m, cacheWrite1h, cacheRead, output, tokens }) => ({ model, reply, input, cacheWrite5m, cacheWrite1h, cacheRead, output, tokens }))(last(dir)),
    { model: 'claude-opus-5-5', reply: 'msg_A', input: 1, cacheWrite5m: 4, cacheWrite1h: 6, cacheRead: 100, output: 2, tokens: 113 });
  call('toolu_a2', 'git log');
  assert.deepEqual([last(dir).model, last(dir).reply, last(dir).tokens], ['claude-opus-5-5', 'msg_A', undefined], 'the same reply is not counted twice');
  fs.appendFileSync(log, `${result('toolu_a2')}\n${block('msg_B', 'claude-opus-5-5', 3, { type: 'text', text: 'Done.' })}\n`);
  hook('stop', { hook_event_name: 'Stop', stop_hook_active: false, transcript_path: log }, dir);
  assert.deepEqual([last(dir).event, last(dir).reply, last(dir).tokens], ['turn.end', 'msg_B', 339]);
});

test('a reply whose first call starts before Claude Code logs it: the call\'s end claims the tokens', () => {
  const { dir } = makeRepo();
  const log = path.join(dir, '..', `${path.basename(dir)}-stream.jsonl`);
  fs.writeFileSync(log, '');
  const base = { tool_name: 'Bash', transcript_path: log };
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', ...base, tool_input: { command: 'git status' }, tool_use_id: 'toolu_s1' }, dir);
  assert.equal(last(dir).reply, undefined, 'not in the log yet');
  fs.appendFileSync(log, `${block('msg_S', 'claude-sonnet-5-5', 2, { type: 'tool_use', id: 'toolu_s1', name: 'Bash', input: {} })}\n${block('msg_S', 'claude-sonnet-5-5', 2, { type: 'tool_use', id: 'toolu_s2', name: 'Bash', input: {} })}\n`);
  hook('post-tool-use', { hook_event_name: 'PostToolUse', ...base, tool_input: { command: 'git status' }, tool_use_id: 'toolu_s1', duration_ms: 5 }, dir);
  assert.deepEqual([last(dir).event, last(dir).reply, last(dir).tokens], ['tool.done', 'msg_S', 226]);
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', ...base, tool_input: { command: 'git log' }, tool_use_id: 'toolu_s2' }, dir);
  hook('post-tool-use', { hook_event_name: 'PostToolUse', ...base, tool_input: { command: 'git log' }, tool_use_id: 'toolu_s2', duration_ms: 5 }, dir);
  assert.equal(lines(dir).filter((e) => e.tokens).length, 1, 'once');
  hook('stop', { hook_event_name: 'Stop', stop_hook_active: false, transcript_path: log }, dir);
  assert.deepEqual([last(dir).event, last(dir).tokens], ['turn.end', undefined], 'a last reply already counted on its calls');
});

test('a lane\'s tokens come from its own log, at its calls and at its final report', () => {
  const { dir } = makeRepo();
  const session = path.join(dir, '..', `${path.basename(dir)}-lead.jsonl`);
  const lane = `${session.replace(/\.jsonl$/, '')}/subagents/agent-b1.jsonl`;
  fs.mkdirSync(path.dirname(lane), { recursive: true });
  fs.writeFileSync(session, '');
  fs.writeFileSync(lane, `${block('msg_L1', 'claude-sonnet-5-5', 2, { type: 'tool_use', id: 'toolu_l1', name: 'Read', input: {} })}\n${result('toolu_l1')}\n${block('msg_L2', 'claude-sonnet-5-5', 4, { type: 'text', text: 'Verdict: APPROVE' })}\n`);
  const who = { agent_id: 'b1', agent_type: 'code-reviewer', transcript_path: session };
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(dir, 'src/a.ts') }, tool_use_id: 'toolu_l1', ...who }, dir);
  assert.deepEqual([last(dir).who, last(dir).model, last(dir).tokens], ['code-reviewer', 'claude-sonnet-5-5', 226]);
  hook('subagent-stop', { hook_event_name: 'SubagentStop', stop_hook_active: false, agent_transcript_path: lane, ...who }, dir);
  assert.deepEqual([last(dir).event, last(dir).reply, last(dir).tokens, last(dir).context], ['agent.stop', 'msg_L2', 452, 444]);
});

test('a log without the cache split counts every cache write as 5-minute', async () => {
  const { usageFields } = await import('../../core/policy/lib/timeline.mjs');
  assert.deepEqual(usageFields({ usage: { input_tokens: 1, cache_creation_input_tokens: 50, cache_read_input_tokens: 7, output_tokens: 2 } }),
    { input: 1, cacheWrite5m: 50, cacheWrite1h: 0, cacheRead: 7, output: 2, tokens: 60 });
});

test('project.prices: dollars per million tokens per model, checked', () => {
  const { dir } = makeRepo();
  const price = { input: 1, cacheWrite5m: 2, cacheWrite1h: 3, cacheRead: 0.5, output: 4 };
  const load = (prices) => {
    const file = path.join(dir, '.forge/project/project.json');
    fs.writeFileSync(file, JSON.stringify({ project: { prices }, policy: { gates: { full: 'true' } } }));
    return ctxFor(dir);
  };
  assert.deepEqual(load({ opus: price, 'claude-haiku-5-5': price }).configErrors, []);
  assert.match(load({ opus: { input: 1 } }).configErrors.join(), /project\.prices must map a model/);
  assert.match(load({ opus: { ...price, output: -1 } }).configErrors.join(), /project\.prices/);
});

test('a streamed reply counts once it is complete, with its final output; a turn\'s end records any reply not yet counted', () => {
  const { dir } = makeRepo();
  const log = path.join(dir, '..', `${path.basename(dir)}-partial.jsonl`);
  const partial = (id, n, content) => block(id, 'claude-opus-5-5', n, content, null);
  fs.writeFileSync(log, `${partial('msg_P', 2, { type: 'tool_use', id: 'toolu_p1', name: 'Bash', input: {} })}\n`);
  const base = { tool_name: 'Bash', transcript_path: log, tool_input: { command: 'git status' } };
  hook('pre-tool-use', { hook_event_name: 'PreToolUse', ...base, tool_use_id: 'toolu_p1' }, dir);
  assert.deepEqual([last(dir).reply, last(dir).tokens], ['msg_P', undefined], 'still streaming: named, not counted');
  fs.appendFileSync(log, `${block('msg_P', 'claude-opus-5-5', 3, { type: 'tool_use', id: 'toolu_p2', name: 'Bash', input: {} })}\n`);
  hook('post-tool-use', { hook_event_name: 'PostToolUse', ...base, tool_use_id: 'toolu_p1', duration_ms: 5 }, dir);
  assert.deepEqual([last(dir).event, last(dir).tokens, last(dir).output], ['tool.done', 339, 6], 'the final line\'s count');
  // Two replies no hook saw complete (an old one and one that streamed past its calls), then the turn ends.
  fs.appendFileSync(log, `${block('msg_Q', 'claude-opus-5-5', 1, { type: 'tool_use', id: 'toolu_q', name: 'Read', input: {} })}\n${block('msg_old', 'claude-opus-5-5', 1, { type: 'text', text: 'x' }, 'end_turn', new Date(Date.now() - 2 * 86400000).toISOString())}\n${block('msg_R', 'claude-opus-5-5', 4, { type: 'text', text: 'Done.' })}\n`);
  hook('stop', { hook_event_name: 'Stop', stop_hook_active: false, transcript_path: log }, dir);
  const tail = lines(dir).slice(-2);
  assert.deepEqual(tail.map((e) => [e.event, e.reply, e.tokens]), [['turn.end', 'msg_R', 452], ['reply', 'msg_Q', 113]]);
  assert.equal(lines(dir).filter((e) => e.reply === 'msg_old').length, 0, 'older than a day: left to forge timeline import');
  hook('stop', { hook_event_name: 'Stop', stop_hook_active: false, transcript_path: log }, dir);
  assert.equal(lines(dir).filter((e) => e.tokens).length, 3, 'nothing twice');
});
