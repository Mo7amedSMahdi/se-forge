// The kit's git hooks with real commits in a checkout set up by forge init.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sh } from '../policy/helpers.mjs';

const FORGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/cli/forge.mjs');

function setup({ project = {}, policy = {}, husky = false } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-hooks-')));
  const team = path.join(base, 'team');
  const client = path.join(base, 'client');
  for (const d of [team, client]) {
    fs.mkdirSync(d);
    sh(d, 'git', 'init', '-q', '-b', 'main');
    sh(d, 'git', 'config', 'user.email', 't@e'); sh(d, 'git', 'config', 'user.name', 't');
  }
  sh(team, 'git', 'commit', '-q', '--allow-empty', '-m', 'init');
  fs.writeFileSync(path.join(client, 'a.ts'), 'export const a = 1\n');
  sh(client, 'git', 'add', 'a.ts'); sh(client, 'git', 'commit', '-q', '-m', 'chore: init');
  if (husky) {
    fs.mkdirSync(path.join(client, '.husky'));
    fs.writeFileSync(path.join(client, '.husky/pre-commit'), '#!/bin/sh\ntouch "$(git rev-parse --show-toplevel)/.husky-ran"\n', { mode: 0o755 });
    sh(client, 'git', 'config', 'core.hooksPath', '.husky');
  }
  const env = { ...process.env, FORGE_USER_CONFIG: path.join(base, 'cfg.json') };
  const forge = (...a) => { const r = spawnSync('node', [FORGE, ...a], { cwd: client, env, encoding: 'utf8' }); assert.equal(r.status, 0, `${r.stdout}${r.stderr}`); };
  forge('setup', '--team-repo', team);
  forge('init', '--project', 'demo', '--new');
  const pj = path.join(team, 'demo/project.json');
  const cfg = JSON.parse(fs.readFileSync(pj, 'utf8'));
  Object.assign(cfg.project, project); Object.assign(cfg.policy, policy);
  fs.writeFileSync(pj, JSON.stringify(cfg, null, 2));
  forge('sync');
  const commit = (msg, cwd = client) => {
    const r = spawnSync('git', ['commit', '-m', msg], { cwd, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const stage = (rel, text, cwd = client) => { fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true }); fs.writeFileSync(path.join(cwd, rel), text); sh(cwd, 'git', 'add', '-f', rel); };
  return { client, commit, stage };
}

test('commit messages must be Conventional Commits', () => {
  const w = setup();
  w.stage('b.ts', 'export const b = 2\n');
  let r = w.commit('added b');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /"added b" is not a Conventional Commit/);
  r = w.commit('feat(b): add b');
  assert.equal(r.code, 0, r.out);
});

test('coAuthor false strips the AI co-author line; true keeps it', () => {
  const off = setup({ project: { coAuthor: false } });
  off.stage('b.ts', 'x\n');
  assert.equal(off.commit('feat: b\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nReviewed-by: A Person <a@p>').code, 0);
  const msg = sh(off.client, 'git', 'log', '-1', '--format=%B');
  assert.doesNotMatch(msg, /Co-Authored-By/i);
  assert.match(msg, /Reviewed-by: A Person/);
  const settings = JSON.parse(fs.readFileSync(path.join(off.client, '.claude/settings.local.json'), 'utf8'));
  assert.deepEqual(settings.attribution, { commit: '', pr: '' }, "Claude Code's own attribution is off too");
  const on = setup({ project: { coAuthor: true } });
  on.stage('b.ts', 'x\n');
  on.commit('feat: b\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
  assert.match(sh(on.client, 'git', 'log', '-1', '--format=%B'), /Co-Authored-By: Claude/);
});

test('a staged secret is refused', () => {
  const w = setup();
  w.stage('config.ts', 'export const key = "AKIAZ3MNB7Q5XK2PLW4T"\n');
  const r = w.commit('feat: config');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /looks like a secret: config\.ts/);
});

test('kit files can never be committed, not even with git add -f', () => {
  const w = setup();
  sh(w.client, 'git', 'add', '-f', '.forge/kit/VERSION');
  const r = w.commit('chore: oops');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /kit files are staged: \.forge\/kit\/VERSION/);
});

test('the project\'s commit checks run on staged files', () => {
  const w = setup({ policy: { commit: { checks: [{ glob: '**/*.ts', command: '! grep -n TODO {files}' }] } } });
  w.stage('c.ts', '// TODO later\n');
  const r = w.commit('feat: c');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /grep -n TODO \{files\} failed:\n1:\/\/ TODO later/);
});

test('a commit check with dir runs in that folder, with {files} relative to it', () => {
  const w = setup({ policy: { commit: { checks: [{ glob: 'backend/**/*.py', dir: 'backend', command: '! grep -n TODO {files}' }] } } });
  w.stage('backend/app/a.py', '# TODO later\n');
  const r = w.commit('feat: a');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /grep -n TODO \{files\} failed:\n1:# TODO later/);
  w.stage('backend/app/a.py', 'x = 1\n');
  assert.equal(w.commit('feat: a').code, 0);
});

test('a hook the project had before still runs after the kit\'s checks', () => {
  const w = setup({ husky: true });
  assert.match(sh(w.client, 'git', 'config', 'se-forge.previousHooksPath'), /^\.husky$/);
  w.stage('d.ts', 'x\n');
  assert.equal(w.commit('feat: d').code, 0);
  assert.ok(fs.existsSync(path.join(w.client, '.husky-ran')), 'husky pre-commit ran');
});

test('commits in a lane worktree run the hooks too', () => {
  const w = setup();
  const wt = path.join(w.client, '.claude/worktrees/lane-1');
  sh(w.client, 'git', 'worktree', 'add', '-q', '-b', 'feat/1-x', wt);
  w.stage('e.ts', 'x\n', wt);
  const r = w.commit('wip', wt);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /not a Conventional Commit/);
});
