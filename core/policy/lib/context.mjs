// Everything a rule needs to know about where a tool call happens.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { memberOf } from './system.mjs';

export function git(cwd, args, timeout = 10000) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

// The main worktree root: shared by every lane worktree of the same repository.
export function mainRootOf(cwd, env = process.env) {
  const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (common.ok && path.basename(common.out) === '.git') {
    const main = path.dirname(common.out);
    // A repository with no forge setup, such as the team repo after a `cd` there, has no rules of its own: the
    // session's project keeps its config and state (decision 116).
    const project = env.CLAUDE_PROJECT_DIR;
    if (project && project !== cwd && !fs.existsSync(path.join(main, '.forge')) && fs.existsSync(path.join(project, '.forge'))) return mainRootOf(project, {});
    return main;
  }
  return env.CLAUDE_PROJECT_DIR || cwd;
}

export function makeContext(input, env = process.env) {
  const cwd = input.cwd && fs.existsSync(input.cwd) ? input.cwd : (env.CLAUDE_PROJECT_DIR || process.cwd());
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  const root = top.ok ? top.out : cwd;
  const mainRoot = mainRootOf(cwd, env);
  const { config, project, kitVersion, source, errors } = loadConfig(mainRoot, env);
  const stateDir = path.join(mainRoot, '.forge', 'state');
  let branch;
  let projectDir;
  return {
    input,
    env,
    cwd,
    root,
    mainRoot,
    config,
    project,
    kitVersion,
    configSource: source,
    configErrors: errors,
    stateDir,
    home: env.HOME || os.homedir(),
    agentId: input.agent_id || null,
    agentType: (input.agent_type || '').replace(/^.*:/, '') || null, // namespaced agent names ("<namespace>:<name>") count as <name>
    permissionMode: input.permission_mode || 'default',
    git: (args, dir = cwd) => git(dir, args),
    // The project's folder in the team repo, which <main>/.forge/project links to (null when unlinked).
    projectDir() {
      if (projectDir === undefined) {
        try { projectDir = fs.realpathSync(path.join(mainRoot, '.forge', 'project')); } catch { projectDir = null; }
      }
      return projectDir;
    },
    branch() {
      if (branch === undefined) {
        const r = git(cwd, ['symbolic-ref', '--short', '-q', 'HEAD']);
        branch = r.ok ? r.out : null;
      }
      return branch;
    },
  };
}

// A path as the rules name it. The team repo's project folder is also an extra working directory, so an
// agent can reach plans, reports and project.json by their real path; such a path is mapped back to
// <main>/.forge/project/..., so every rule sees one name per file. Every other path is returned with its
// symlinks resolved (macOS /var -> /private/var, a ~/code link to another disk): git names the repository
// by its real path, so a path through a link would otherwise fall outside every repo-relative rule.
export function linkedPath(abs, ctx) {
  const dir = ctx.projectDir?.();
  let real = abs;
  const rest = [];
  for (let p = abs; ; p = path.dirname(p)) {
    try { real = path.join(fs.realpathSync(p), ...rest.reverse()); break; } catch { /* not created yet */ }
    if (path.dirname(p) === p) break;
    rest.push(path.basename(p));
  }
  if (!dir) return real;
  const rel = path.relative(dir, real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return real;
  return path.join(ctx.mainRoot, '.forge', 'project', rel);
}

export function readState(ctx, name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ctx.stateDir, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeState(ctx, name, value) {
  const file = path.join(ctx.stateDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

// The system's workspace root the session runs at (decision 130), or null: the session's project folder, whatever
// folder the call has moved to (the lead's `cd` into a member repository persists across its calls and its agents').
export function systemRootOf(ctx) {
  const project = ctx.env?.CLAUDE_PROJECT_DIR;
  const top = project && fs.existsSync(project) ? git(project, ['rev-parse', '--show-toplevel']) : null;
  const dir = top?.ok ? top.out : project ? null : ctx.mainRoot;
  return dir && memberOf(dir)?.repo === null ? dir : null;
}

// The context a call really works in (system mode, decision 130): the repository of the folder it acts on, when that
// is another repository than the one the call starts in (an agent at a system's workspace root working in a member
// repository's lane). The same context otherwise.
export function contextAt(ctx, dir) {
  if (!dir) return ctx;
  let d = path.resolve(dir);
  while (d !== path.dirname(d) && !fs.existsSync(d)) d = path.dirname(d);
  const top = git(d, ['rev-parse', '--show-toplevel']);
  if (!top.ok || path.resolve(top.out) === path.resolve(ctx.root)) return ctx;
  // A repository without forge (the team repo, through the .forge/project link) keeps the session's rules.
  if (!fs.existsSync(path.join(mainRootOf(d, {}), '.forge'))) return ctx;
  return makeContext({ ...ctx.input, cwd: d }, ctx.env);
}
