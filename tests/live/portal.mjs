// The users portal workspace for the live trials (tests/live): the FastAPI
// sample set up as forge init and the stack guide leave it, the approved bootstrap artefacts of
// tests/live/fixtures/users-portal, and a stateful fake GitLab (issues, labels, merge requests that really
// merge into the local bare remote). Nothing leaves the machine.
//   base/<name>/      the client checkout        base/<name>.git   its "origin"
//   base/team/        the team repo clone         base/team.git     its "origin"
//   base/gitlab/      the fake GitLab's state     base/bin/         forge and glab for the PATH
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = path.join(KIT, 'core/cli/forge.mjs');
const STACKS = path.join(KIT, 'tests/stacks');
const FIXTURES = path.join(KIT, 'tests/live/fixtures');
export const PORTAL = path.join(FIXTURES, 'users-portal');

export const run = (cwd, cmd, ...args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

export function setPolicy(dir, change) {
  const file = path.join(dir, '.forge/project/project.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(cfg);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

// The two ticket drafts of the fixture as { title, body }.
export const portalTickets = () => fs.readFileSync(path.join(PORTAL, 'tickets.md'), 'utf8').split(/\n## \d\. /).slice(1)
  .map((t) => { const [title, ...body] = t.split('\n'); return { title: title.trim(), body: body.join('\n').trim() }; });

export function portalWorkspace(base, { name = 'portal', spec = false, team: teamName = 'team' } = {}) {
  const dir = path.join(base, name);
  const remote = path.join(base, `${name}.git`);
  const team = path.join(base, teamName);
  const fake = path.join(base, 'gitlab');
  fs.cpSync(path.join(STACKS, 'fastapi'), dir, { recursive: true, filter: (src) => !/(^|\/)(\.venv|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache)(\/|$)/.test(src) });
  if (spec) { fs.mkdirSync(path.join(dir, 'api')); fs.copyFileSync(path.join(STACKS, 'contract/users.yaml'), path.join(dir, 'api/openapi.yaml')); }
  run(base, 'git', 'init', '-q', '--bare', remote);
  for (const d of [dir, team]) { if (!fs.existsSync(d)) fs.mkdirSync(d); run(d, 'git', 'init', '-q', '-b', 'main'); }
  run(dir, 'git', 'add', '.');
  run(dir, 'git', 'commit', '-q', '-m', 'chore: users service');
  if (spec) run(dir, 'git', 'tag', 'api-v1.0.0');
  run(dir, 'git', 'remote', 'add', 'origin', remote);
  run(dir, 'git', 'push', '-q', '-u', 'origin', 'main', '--tags');
  run(team, 'git', 'init', '-q', '--bare', `${team}.git`);
  run(team, 'git', 'commit', '-q', '--allow-empty', '-m', 'team repo');
  run(team, 'git', 'remote', 'add', 'origin', `${team}.git`);
  run(team, 'git', 'push', '-q', '-u', 'origin', 'main');
  fs.mkdirSync(path.join(base, 'bin'), { recursive: true });
  fs.mkdirSync(fake, { recursive: true });
  fs.writeFileSync(path.join(base, 'bin', 'forge'), `#!/bin/sh\nexec node "${FORGE}" "$@"\n`, { mode: 0o755 });
  fs.copyFileSync(path.join(FIXTURES, 'fake-gitlab/glab.js'), path.join(base, 'bin', 'glab'));
  fs.chmodSync(path.join(base, 'bin', 'glab'), 0o755);
  const env = { ...process.env, FORGE_USER_CONFIG: path.join(base, 'forge-config.json'), PATH: `${path.join(base, 'bin')}:${process.env.PATH}`, FAKE_DIR: fake, FAKE_REMOTE: remote };
  const forge = (...args) => { const r = spawnSync('node', [FORGE, ...args], { cwd: dir, env, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`forge ${args.join(' ')}: ${r.stdout}${r.stderr}`); return r.stdout; };
  const glab = (...args) => { const r = spawnSync(path.join(base, 'bin', 'glab'), args, { cwd: dir, env, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`glab ${args.join(' ')}: ${r.stderr}`); return r.stdout; };
  forge('setup', '--team-repo', team);
  forge('init', '--project', name, '--new', '--client', 'Demo');
  run(dir, 'git', 'push', '-q', 'origin', 'dev', 'staging');
  const guide = fs.readFileSync(path.join(KIT, 'core/skills/stack-fastapi/SKILL.md'), 'utf8');
  const snippet = JSON.parse(`{${/## project.json\n```json\n([\s\S]*?)\n```/.exec(guide)[1]}}`);
  setPolicy(dir, (cfg) => {
    cfg.project = { ...cfg.project, ...snippet.project, stack: { ...cfg.project.stack, ...snippet.project.stack, database: 'PostgreSQL 17' },
      api: { ...(cfg.project.api || {}), spec: 'api/openapi.yaml' }, storiesPath: '.forge/project/bootstrap/user-stories.md', tracker: 'gitlab', host: 'gitlab' };
    cfg.policy = { ...cfg.policy, ...snippet.policy };
  });
  const boot = path.join(dir, '.forge/project/bootstrap');
  const arch = path.join(dir, '.forge/project/architecture');
  for (const d of [boot, path.join(arch, 'adr')]) fs.mkdirSync(d, { recursive: true });
  for (const f of ['decisions.md', 'user-stories.md', 'review.md', 'tickets.md']) fs.copyFileSync(path.join(PORTAL, f), path.join(boot, f));
  fs.copyFileSync(path.join(STACKS, 'contract/users.yaml'), path.join(boot, 'contract.yaml'));
  fs.copyFileSync(path.join(PORTAL, 'architecture/overview.md'), path.join(arch, 'overview.md'));
  for (const f of ['context.md', 'containers.md']) fs.copyFileSync(path.join(KIT, 'tests/architecture/docs/architecture', f), path.join(arch, f));
  fs.writeFileSync(path.join(arch, 'adr/0001-cursor-pagination-for-lists.md'), fs.readFileSync(path.join(KIT, 'tests/architecture/docs/adr/0001-cursor-pagination-for-lists.md'), 'utf8').replace('status: accepted', 'status: proposed'));
  fs.copyFileSync(path.join(PORTAL, 'architecture/0002-fastapi-and-postgresql.md'), path.join(arch, 'adr/0002-fastapi-and-postgresql.md'));
  forge('save', '-m', 'bootstrap artefacts, approved');
  const state = () => JSON.parse(fs.existsSync(path.join(fake, 'state.json')) ? fs.readFileSync(path.join(fake, 'state.json'), 'utf8') : '{"issues":{},"mrs":{}}');
  return { base, dir, remote, team, env, forge, glab, fake, state };
}
