// Restricted roles. Read-only roles (reviewers, scout) write only their report; docs-only roles
// (planner, analysts, designer, tracker clerk) write only under .forge/. Both run only commands
// that inspect, plus the forge commands their job needs.
import { deny } from './decision.mjs';
import { parseShell } from './shell.mjs';
import { expand } from './bash.mjs';
import { relTo, resolvePath, matchAny } from './paths.mjs';
import { WRITE_TOOLS } from './files.mjs';
import { readState, linkedPath } from './context.mjs';

const INSPECT = new Set(['ls', 'cat', 'head', 'tail', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'sort', 'uniq', 'cut', 'tr', 'diff',
  'cmp', 'file', 'stat', 'pwd', 'echo', 'printf', 'test', '[', 'true', 'false', 'basename', 'dirname', 'realpath', 'readlink',
  'tree', 'du', 'which', 'date', 'jq', 'column', 'nl', 'cd']);
const GIT_READ = new Set(['status', 'diff', 'log', 'show', 'fetch', 'rev-parse', 'ls-files', 'ls-tree', 'blame', 'grep', 'merge-base',
  'describe', 'cat-file', 'shortlog', 'rev-list', 'for-each-ref', 'show-ref', 'name-rev', 'reflog']);
const HOST_READ = /^(pr (view|diff|checks|list|status)|mr (view|diff|list)|issue (view|list)|run (view|list)|ci (view|list|status|get|trace)|repo view|release (view|list)|search \w+)$/;

const tmpTarget = (t, ctx) => t === '/dev/null' || t.startsWith('/tmp/') || (ctx.env.TMPDIR && t.startsWith(ctx.env.TMPDIR));

function inspects(c, ctx, writable, docs) {
  const [a0 = '', sub = '', verb = ''] = c.argv;
  const line = c.argv.join(' ');
  if (ctx.config.roles.readOnlyCommands.some((p) => line === p || line.startsWith(`${p} `))) return true;
  if (c.redirects.some((r) => ['>', '>>', '>|', '<>'].includes(r.op) && !tmpTarget(r.target, ctx) && !writable(r.target))) return false;
  if (a0 === 'forge') return ['gates', 'doctor', 'version'].includes(sub) || (sub === 'api' && verb === 'check') || (sub === 'config' && verb === 'check') || (sub === 'design' && verb === 'sample') || (sub === 'docs' && verb === 'check') || (sub === 'tracker' && (docs || ['get', 'list', 'statuses', 'create'].includes(verb))) || (docs && sub === 'handover');
  if (docs && a0 === 'mkdir') return c.argv.slice(1).filter((a) => !a.startsWith('-')).every(writable);
  if (INSPECT.has(a0)) return true;
  if (a0 === 'sed') return !c.argv.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'));
  if (a0 === 'find') return !c.argv.some((a) => /^-(delete|exec|execdir|ok|okdir|fprint\w*|fls)$/.test(a));
  if (a0 === 'awk' || a0 === 'gawk') return !c.argv.slice(1).some((a) => /system\s*\(|print[f]?\s*[^;]*>\s*"|\|\s*"/.test(a));
  if (a0 === 'git') {
    if (GIT_READ.has(sub)) return true;
    if (sub === 'branch') return c.argv.slice(2).every((a) => /^(--list|-a|-r|-v|-vv|--all|--remotes|--show-current|--contains|--merged|--no-merged|--format=.*)$/.test(a) || !a.startsWith('-') && c.argv.includes('--contains'));
    if (sub === 'switch' || sub === 'checkout') return c.argv.includes('--detach') || c.argv.includes('-d');
    if (sub === 'worktree') return verb === 'list';
    if (sub === 'stash') return verb === 'list' || verb === 'show';
    if (sub === 'tag') return c.argv.length === 2 || c.argv.includes('-l') || c.argv.includes('--list');
    return false;
  }
  if (a0 === 'gh' || a0 === 'glab') return HOST_READ.test(`${sub} ${verb}`.trim()) || (sub === 'api' && !c.argv.some((a) => /^(-X|--method)$/.test(a) || /^(-f|-F|--field|--raw-field|--input)$/.test(a)));
  if (/tracker\.sh$/.test(a0)) return ['get', 'list', 'statuses'].includes(sub);
  return false;
}

// The access each role declares (written by forge sync from the rendered roles, overrides included).
function declaredAccess(ctx) {
  return readState(ctx, 'roles.json', {})[ctx.agentType] ?? null;
}

// 'read-only', 'docs', or null for the lead and code roles.
export function restrictedAccess(ctx) {
  if (!ctx.agentType) return null;
  const { readOnly, docsOnly } = ctx.config.roles;
  const declared = declaredAccess(ctx);
  if (declared === 'docs' || (declared === null && docsOnly.includes(ctx.agentType))) return 'docs';
  if (declared === 'read-only' || (declared === null && readOnly.includes(ctx.agentType))) return 'read-only';
  return null;
}

export function roleFindings(input, ctx) {
  const access = restrictedAccess(ctx);
  if (!access) return [];
  const docs = access === 'docs';
  const globs = docs ? ctx.config.paths.docs : ctx.config.paths.reports;
  const rule = docs ? 'roles:docs-only' : 'roles:read-only';
  const who = docs ? `${ctx.agentType} writes documents only` : `${ctx.agentType} is read-only`;
  // A lane's own worktree first: it sits inside the main checkout (.claude/worktrees/), and its documents
  // there (.forge/…) are copied to the main checkout when it stops (decision 92).
  const writable = (p) => {
    const abs = linkedPath(resolvePath(p, ctx.cwd, ctx.home), ctx);
    return matchAny(globs, relTo(abs, ctx.root) ?? relTo(abs, ctx.mainRoot));
  };
  if (WRITE_TOOLS.has(input.tool_name)) {
    const p = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '';
    if (input.tool_name !== 'NotebookEdit' && writable(p)) return [];
    return [deny(rule, `${who}: it may write only ${globs.join(', ')}. Describe the change in the plan or report instead of making it.`)];
  }
  if (input.tool_name === 'Bash') {
    const bad = expand(parseShell(input.tool_input?.command || ''), 0, ctx.config.commands.wrappers).filter((c) => c.argv.length && !inspects(c, ctx, writable, docs));
    if (bad.length) return [deny(rule, `${who}: \`${bad[0].argv.join(' ').slice(0, 80)}\` is not an inspection command. Read, diff and report; the lead routes changes to an engineer.`)];
  }
  return [];
}
