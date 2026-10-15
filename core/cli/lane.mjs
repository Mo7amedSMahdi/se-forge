// forge lane (system mode, decision 130): a worktree in the member repository a ticket changes, for one agent.
//   forge lane open <ticket> [--name <name>] [--review]   the plan's Repo: and Branch: give the repository and the
//                         branch; --review checks out the branch's last pushed commit, detached, for a reviewer
//   forge lane close <path>                              removes a finished lane's worktree (the branch stays)
// The worktree is <repo>/.claude/worktrees/<name>, where the kit looks for lanes; the lead gives its path to the agent.
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../policy/lib/context.mjs';
import { ticketTarget } from '../policy/lib/system.mjs';

export class LaneError extends Error {}

// The system's workspace root, the plan of a ticket, and the member repository it names.
export function laneTarget(main, ticket) {
  const t = ticketTarget(main, ticket);
  if (t.error) throw new LaneError(t.error.startsWith('not a system') ? `forge lane works in a system: ${t.error}` : t.error);
  return t;
}

export function lane(o, { main, out }) {
  const verb = o._[0];
  if (verb === 'close') {
    const target = o._[1] ? path.resolve(o._[1]) : null;
    if (!target || !/\/\.claude\/worktrees\/[^/]+\/?$/.test(target)) throw new LaneError('forge lane close <path of the lane\'s worktree>');
    const top = git(target, ['rev-parse', '--git-common-dir']);
    if (!top.ok) throw new LaneError(`${target} is not a worktree.`);
    const repo = path.dirname(path.resolve(target, top.out));
    const r = git(repo, ['worktree', 'remove', target]);
    if (!r.ok) throw new LaneError(`${r.err.split('\n').pop()} (commit or push the lane's work first; the branch stays either way)`);
    out(`closed ${target}`);
    return 0;
  }
  if (verb !== 'open' || !/^\d+$/.test(String(o._[1] ?? '').replace(/^#/, ''))) throw new LaneError('forge lane open <ticket> [--name <name>] [--review] | forge lane close <path>');
  const ticket = String(o._[1]).replace(/^#/, '');
  const t = laneTarget(main, ticket);
  if (!fs.existsSync(path.join(t.dir, '.git'))) throw new LaneError(`${t.repo.name} is not in the workspace (${t.dir}): forge system init.`);
  const base = t.repo.base;
  git(t.dir, ['fetch', '-q', 'origin'], 120000);
  const has = (ref) => git(t.dir, ['rev-parse', '--verify', '-q', ref]).ok;
  const root = path.join(t.dir, '.claude', 'worktrees');
  let name = typeof o.name === 'string' ? o.name : `${ticket}-${o.review ? 'review' : 'lane'}`;
  if (!/^[\w.-]+$/.test(name)) throw new LaneError('--name takes letters, digits, . _ -');
  for (let n = 2; fs.existsSync(path.join(root, name)); n++) name = `${name.replace(/-\d+$/, '')}-${n}`;
  const where = path.join(root, name);
  fs.mkdirSync(root, { recursive: true });
  let r;
  if (o.review) {
    // A reviewer reads what was pushed, never a lane's unpushed work.
    if (!has(`origin/${t.branch}`)) throw new LaneError(`${t.branch} is not pushed yet: nothing to review.`);
    r = git(t.dir, ['worktree', 'add', '-q', '--detach', where, `origin/${t.branch}`]);
  } else if (has(`refs/heads/${t.branch}`)) {
    r = git(t.dir, ['worktree', 'add', '-q', where, t.branch]);
  } else if (has(`origin/${t.branch}`)) {
    r = git(t.dir, ['worktree', 'add', '-q', '--track', '-b', t.branch, where, `origin/${t.branch}`]);
  } else {
    const from = has(`origin/${base}`) ? `origin/${base}` : base;
    if (!has(from)) throw new LaneError(`${t.repo.name} has no ${base} branch to start ${t.branch} from.`);
    r = git(t.dir, ['worktree', 'add', '-q', '--no-track', '-b', t.branch, where, from]);
  }
  if (!r.ok) throw new LaneError(`git worktree add: ${r.err.split('\n').pop()}`);
  out(`lane: ${where}\nrepository ${t.repo.name}, branch ${o.review ? `${t.branch} (detached, for review)` : t.branch}, base ${base}`);
  return 0;
}
