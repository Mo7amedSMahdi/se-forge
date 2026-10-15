// "Done" means gates green: a clean, pushed feature branch whose affected tests pass.
// Results are recorded per commit, so the lead can open a PR for a lane's branch without rerunning them.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { git, readState, writeState, mainRootOf } from './context.mjs';
import { isProtected } from './rules/git.mjs';
import { matchAny } from './paths.mjs';
import { record, actor, clip } from './timeline.mjs';
import { ticketReports, PASSING } from './reports.mjs';

const quote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
const tail = (s, n = 30) => s.trim().split('\n').slice(-n).join('\n');

function baseRef(ctx, root) {
  const main = ctx.config.branches.base;
  return git(root, ['rev-parse', '--verify', '-q', `origin/${main}`]).ok ? `origin/${main}` : main;
}

export function gateCommand(ctx, root) {
  const { affected, full } = ctx.config.gates;
  if (affected) {
    const r = git(root, ['diff', '--name-only', `${baseRef(ctx, root)}...HEAD`]);
    const files = r.ok ? r.out.split('\n').filter(Boolean) : [];
    if (files.length) return affected.replaceAll('{files}', files.map(quote).join(' '));
  }
  return full;
}

// The plan whose Branch: line names this branch.
export function planFor(ctx, branch) {
  const dir = path.join(ctx.mainRoot, '.forge', 'project', 'plans');
  try {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 6000);
      if (/^Branch:\s*`?([^\s`]+)`?/mi.exec(text)?.[1] === branch) return { name: f, text };
    }
  } catch { /* no plans folder */ }
  return null;
}

// Done needs tests (decision 50). Returns { ok, reason } and, when the plan names an end-to-end flow, the
// end-to-end command to run after the gate command.
export function testsCheck(ctx, root, branch, head = 'HEAD') {
  const { sides, e2e } = ctx.config.tests;
  if (!sides.length && !e2e.tests.length) return { ok: true };
  const diff = git(root, ['diff', '--name-only', `${baseRef(ctx, root)}...${head}`]);
  const files = diff.ok ? diff.out.split('\n').filter(Boolean) : [];
  for (const side of sides) {
    const code = files.filter((f) => matchAny(side.code, f) && !matchAny(side.tests, f) && !matchAny(side.ignore || [], f));
    if (code.length && !files.some((f) => matchAny(side.tests, f))) {
      return { ok: false, reason: `The ${side.name} code changed (${code.slice(0, 5).join(', ')}${code.length > 5 ? ', …' : ''}) but no ${side.name} test was added or changed (${side.tests.join(', ')}). Write the tests from the acceptance criteria (skill write-unit-tests).` };
    }
  }
  if (!e2e.tests.length) return { ok: true };
  const plan = planFor(ctx, branch);
  if (!plan) return { ok: false, reason: `No plan in .forge/project/plans/ has "Branch: ${branch}". Its E2E: line decides whether end-to-end tests are needed.` };
  const line = /^E2E:\s*(.+)$/mi.exec(plan.text)?.[1]?.replace(/[`*]/g, '').trim();
  if (!line) return { ok: false, reason: `${plan.name} has no E2E: line. Name the user flow the end-to-end tests cover, or write "not applicable (<reason>)".` };
  if (/^not applicable/i.test(line)) {
    return /\(([^)]{8,})\)/.test(line) ? { ok: true } : { ok: false, reason: `${plan.name}: "E2E: not applicable" needs the reason in brackets, e.g. "not applicable (no user-facing change)".` };
  }
  if (!files.some((f) => matchAny(e2e.tests, f))) {
    return { ok: false, reason: `${plan.name} says E2E: ${line}, but the branch changes no end-to-end test (${e2e.tests.join(', ')}). Add or update it (skill write-e2e).` };
  }
  return { ok: true, e2eCommand: e2e.command || null };
}

// Checks the branch checked out in `cwd`, or the named branch's recorded result. Each run of the gate command,
// and each check that stops before it, goes into the timeline.
export function verifyDone(ctx, cwd, branch = null, ticket = null) {
  const { ran, ...r } = checkDone(ctx, cwd, branch, ticket);
  const by = actor(ctx);
  if (ran) record(ctx, r.ok ? 'gates.pass' : 'gates.fail', { who: 'kit', by, what: clip(ran.cmd, 120), ms: ran.ms, why: r.ok ? undefined : clip(ran.why) });
  else if (!r.ok) record(ctx, 'gates.not-ready', { who: 'kit', by, why: clip(r.reason.split('\n')[0]) });
  return r;
}

// A ticket moved to a done status from the base branch or a detached HEAD: the lead accepting merged work on the
// person's word (decision 116), or closing released work (decision 117). The ticket's own branch must have passed
// the gates on a commit that is merged into the base branch. noBranch: the ticket has no branch here at all.
function ticketDone(ctx, root, ticket, results) {
  const ours = (b) => new RegExp(`^[\\w-]+/${ticket}(?:-|$)`).test(b ?? '');
  const base = baseRef(ctx, root);
  const passed = Object.entries(results).filter(([, r]) => r?.ok && ours(r.branch));
  const merged = passed.find(([sha]) => git(root, ['merge-base', '--is-ancestor', sha, base]).ok);
  if (merged) return { ok: true, sha: merged[0] };
  const refs = git(root, ['for-each-ref', '--format=%(refname:short)', `refs/heads/*/${ticket}-*`, `refs/remotes/origin/*/${ticket}-*`]).out.split('\n').filter(Boolean);
  const branches = [...new Set([...refs.map((r) => r.replace(/^origin\//, '')), ...Object.values(results).map((r) => r?.branch).filter(ours)])];
  if (!branches.length) {
    // Work with no branch (the team repo, a setting): its approving reviews stand in for the gates (decision 120).
    const reports = ticketReports(ctx.mainRoot, ticket);
    if (reports.length && reports.every((r) => PASSING.has(r.verdict))) return { ok: true, reviews: reports.map((r) => r.name) };
    const why = reports.length ? `and its reviews do not all approve (${reports.filter((r) => !PASSING.has(r.verdict)).map((r) => `${r.name}: ${r.verdict ?? 'no verdict'}`).join(', ')})` : 'and it has no review report';
    return { ok: false, noBranch: true, reason: `#${ticket} has no branch in this repository, so there are no gates to check (its work is elsewhere: the team repo, a setting), ${why}. A person confirms it.` };
  }
  return { ok: false, reason: passed.length
    ? `The gates passed on ${branches.join(', ')}, but not on a commit merged into ${base}. Move it from the branch itself (the QA lane does), or after forge merge.`
    : `The gates have not passed on ${branches.join(', ')}. The lane that built it runs them when it finishes; or run them on that branch.` };
}

function checkDone(ctx, cwd, branch, ticket = null) {
  // In a repository with no forge setup (the team repo), the claim is about the project's own checkout.
  if (!fs.existsSync(path.join(mainRootOf(cwd, {}), '.forge'))) cwd = ctx.mainRoot;
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!top.ok) return { ok: false, reason: 'Not inside a git repository.' };
  const root = top.out;
  const current = git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).out || null;
  const results = readState(ctx, 'gates.json', {});

  if (branch && branch !== current) {
    const sha = git(root, ['rev-parse', '--verify', '-q', branch]).out;
    if (sha && results[sha]?.ok) return { ok: true, sha };
    return { ok: false, reason: `Gates have not passed on ${branch}${sha ? `@${sha.slice(0, 8)}` : ''}. The lane that built it runs them when it finishes; or run them on that branch.` };
  }
  if (ticket && current && isProtected(current, ctx.config)) return ticketDone(ctx, root, ticket, results);
  if (ticket && !current) {
    const merged = ticketDone(ctx, root, ticket, results);
    if (merged.ok) return merged;
  }
  if (!current) return { ok: false, reason: 'Detached HEAD: finished work lives on a feature branch.' };
  if (isProtected(current, ctx.config)) return { ok: false, reason: `You are on ${current}. Finished work lives on a feat|fix|chore/<ticket>-<slug> branch. To accept a ticket merged into ${ctx.config.branches.base}, name it by its number: forge tracker status <id> Done, one command per ticket (joined by && is fine), not a loop.` };

  const dirty = git(root, ['status', '--porcelain', '--untracked-files=normal']).out.split('\n').filter((l) => l && !/ \.forge\//.test(l));
  if (dirty.length) return { ok: false, reason: `Uncommitted changes:\n${dirty.slice(0, 15).join('\n')}\nCommit them with explicit paths (or remove what is not part of the ticket).` };

  if (ctx.config.gates.requirePushed) {
    const up = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    if (!up.ok) return { ok: false, reason: `${current} has no upstream. Push it: git push -u origin ${current}` };
    const ahead = Number(git(root, ['rev-list', '--count', '@{u}..HEAD']).out || 0);
    if (ahead > 0) return { ok: false, reason: `${ahead} commit(s) on ${current} are not pushed. Push before finishing.` };
  }

  const tests = testsCheck(ctx, root, current);
  if (!tests.ok) return { ok: false, reason: tests.reason };

  const sha = git(root, ['rev-parse', 'HEAD']).out;
  if (results[sha]?.ok) return { ok: true, sha, cached: true };
  const gate = gateCommand(ctx, root);
  // Each in its own subshell from the repo root: a gate that ends in another folder (cd frontend) does not move
  // the end-to-end command.
  const cmd = gate && tests.e2eCommand ? `(${gate}) && (${tests.e2eCommand})` : gate;
  if (!cmd) return { ok: false, reason: 'No gate command is configured (gates.full in the policy config), so "done" cannot be verified. A human sets it.' };

  const started = Date.now();
  const r = spawnSync('sh', ['-c', cmd], { cwd: root, encoding: 'utf8', timeout: ctx.config.gates.timeoutSec * 1000, env: { ...ctx.env, CI: 'true' }, maxBuffer: 64 * 1024 * 1024 });
  const log = path.join(ctx.stateDir, 'gates', `${sha.slice(0, 12)}.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  fs.writeFileSync(log, `$ ${cmd}\n${r.stdout || ''}\n${r.stderr || ''}`);
  const ok = r.status === 0;
  results[sha] = { ok, branch: current, cmd, at: new Date().toISOString(), log };
  writeState(ctx, 'gates.json', results);
  const ms = Date.now() - started;
  if (ok) return { ok: true, sha, ran: { cmd, ms } };
  const why = r.error?.code === 'ETIMEDOUT' ? `timed out after ${ctx.config.gates.timeoutSec}s` : `exit ${r.status}`;
  return { ok: false, ran: { cmd, ms, why: `${why}: ${tail(`${r.stdout || ''}\n${r.stderr || ''}`, 1)}` }, reason: `Gates failed on ${current}@${sha.slice(0, 8)} (${why}): ${cmd}\nLast lines (full log: ${log}):\n${tail(`${r.stdout || ''}\n${r.stderr || ''}`)}` };
}

// SubagentStop: an engineer lane may only finish with green gates. After maxAttempts
// refusals it may stop, and the branch is recorded as GATES-FAILED for the lead.
export function laneStop(input, ctx) {
  if (!ctx.config.gates.agents.includes(ctx.agentType)) return null;
  const cwd = input.cwd || ctx.cwd;
  const r = verifyDone(ctx, cwd);
  const attempts = readState(ctx, 'stop-attempts.json', {});
  const id = ctx.agentId || 'main';
  if (r.ok) {
    delete attempts[id];
    writeState(ctx, 'stop-attempts.json', attempts);
    return null;
  }
  attempts[id] = (attempts[id] || 0) + 1;
  writeState(ctx, 'stop-attempts.json', attempts);
  if (attempts[id] <= ctx.config.gates.maxAttempts) {
    return { decision: 'block', reason: `Not done yet (attempt ${attempts[id]} of ${ctx.config.gates.maxAttempts}). ${r.reason}\nFix it, commit with explicit paths, push, and finish again. Never weaken, skip or delete a test to make it pass.` };
  }
  const branch = git(cwd, ['symbolic-ref', '--short', '-q', 'HEAD']).out || '(detached)';
  const failed = readState(ctx, 'gates-failed.json', {});
  failed[branch] = { agent: ctx.agentType, at: new Date().toISOString(), reason: r.reason.split('\n')[0] };
  writeState(ctx, 'gates-failed.json', failed);
  return { systemMessage: `GATES-FAILED: ${ctx.agentType} stopped on ${branch} with failing gates after ${ctx.config.gates.maxAttempts} attempts. Not done. ${r.reason.split('\n')[0]}` };
}
