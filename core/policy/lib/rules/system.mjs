// At a system's workspace root (decision 130), an agent works in the lane the lead opened for it. A member
// repository's main checkout stays as forge and people left it (forge lane and forge merge work from it), so an agent
// never commits, switches or writes there.
import path from 'node:path';
import { deny } from '../decision.mjs';
import { systemRootOf } from '../context.mjs';
import { memberOf } from '../system.mjs';
import { splitGit } from './git.mjs';

const CHANGES = new Set(['switch', 'checkout', 'commit', 'merge', 'rebase', 'reset', 'push', 'pull', 'add', 'rm', 'mv', 'stash', 'cherry-pick', 'revert', 'restore', 'am', 'apply', 'clean']);

// here: the context of the repository the call acts on; session: the call's own.
export function inMemberMain(here, session) {
  if (!session.agentId || !systemRootOf(session)) return null;
  const repo = memberOf(here.mainRoot)?.repo;
  return repo && path.resolve(here.root) === path.resolve(here.mainRoot) ? repo : null;
}

const why = (repo, what) => `${what} ${repo}'s main checkout, which stays as it is (decision 130). Work in your lane, the worktree your task names (<workspace>/${repo}/.claude/worktrees/<name>): \`cd <lane> && …\`. No lane in your task: report that to the lead.`;

export function checkMemberGit(c, a0, here, session) {
  if (a0 !== 'git') return [];
  const sub = splitGit(c.argv).sub;
  const repo = CHANGES.has(sub) ? inMemberMain(here, session) : null;
  return repo ? [deny('lane:main-checkout', why(repo, `git ${sub} would change`))] : [];
}

export function checkMemberFile(input, here, session, writes) {
  if (!writes) return [];
  const repo = inMemberMain(here, session);
  return repo ? [deny('lane:main-checkout', why(repo, `${input.tool_name} would write into`))] : [];
}
