// Test fixtures: a throwaway git repo with a bare "origin", and a policy context for it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeContext } from '../../core/policy/lib/context.mjs';
import { combine } from '../../core/policy/lib/decision.mjs';
import { checkBash } from '../../core/policy/lib/bash.mjs';

export function sh(cwd, ...args) {
  const r = spawnSync(args[0], args.slice(1), { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

export const DEFAULT_TEST_CONFIG = {
  paths: { generated: ['src/lib/api/generated'], protected: ['docs/user-stories.md'] },
  gates: { full: 'sh ./check.sh' },
};

// main and dev (the base branch, decision 74) with a migration, a story file and an applied migration;
// then feat/1-login checked out from dev.
export function makeRepo(config = DEFAULT_TEST_CONFIG) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-repo-')));
  const remote = `${dir}.git`;
  sh(os.tmpdir(), 'git', 'init', '-q', '--bare', remote);
  sh(dir, 'git', 'init', '-q', '-b', 'main');
  sh(dir, 'git', 'config', 'user.email', 't@example.com');
  sh(dir, 'git', 'config', 'user.name', 'test');
  fs.mkdirSync(path.join(dir, 'db/migrations'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'db/migrations/001_init.sql'), 'create table t (id int);\n');
  fs.writeFileSync(path.join(dir, 'docs/user-stories.md'), '# stories\n');
  fs.writeFileSync(path.join(dir, 'src/auth/login.ts'), 'export {}\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: { react: '^19.0.0' }, scripts: { test: 'vitest' } }, null, 2));
  fs.writeFileSync(path.join(dir, 'check.sh'), 'grep -qx ok status.txt\n');
  fs.writeFileSync(path.join(dir, 'status.txt'), 'ok\n');
  fs.appendFileSync(path.join(dir, '.git/info/exclude'), '.forge/\n.claude/settings.local.json\n.claude/worktrees/\n');
  if (config) writeProjectConfig(dir, { policy: config });
  sh(dir, 'git', 'add', '.');
  sh(dir, 'git', 'commit', '-q', '-m', 'init');
  sh(dir, 'git', 'remote', 'add', 'origin', remote);
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'main');
  sh(dir, 'git', 'checkout', '-q', '-b', 'dev');
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'dev');
  sh(dir, 'git', 'tag', 'v1.0.0');
  sh(dir, 'git', 'checkout', '-q', '-b', 'feat/1-login');
  return { dir, remote };
}

// What forge init links into a checkout: .forge/project/project.json (here a plain folder).
export function writeProjectConfig(dir, data) {
  fs.mkdirSync(path.join(dir, '.forge/project'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.forge/project/project.json'), JSON.stringify(data, null, 2));
}

export function ctxFor(dir, input = {}, env = {}) {
  return makeContext({ cwd: dir, ...input }, { HOME: '/Users/dev', ...env });
}

export function decideBash(cmd, ctx) {
  const findings = checkBash(cmd, ctx);
  if (findings.some((f) => f.decision === 'done') && !findings.some((f) => f.decision === 'deny')) return { decision: 'done', findings };
  return combine(findings);
}
