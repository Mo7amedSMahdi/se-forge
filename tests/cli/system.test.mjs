// System mode, phase S1 (decisions 130-133): a system's description, and forge system init: every member repository
// cloned side by side (origin unchanged, no branch created), linked to one team folder with its own settings, and the
// workspace root as the lead's home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sh } from '../policy/helpers.mjs';
import { checkSystem, memberOf, deepMerge, deploysOn } from '../../core/policy/lib/system.mjs';
import { loadConfig } from '../../core/policy/lib/config.mjs';

const FORGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/cli/forge.mjs');

const SYSTEM = (base) => ({
  name: 'acme',
  description: 'Orders and files for Acme.',
  board: { host: 'gitlab', project: 'acme/board' },
  repos: [
    { name: 'orders-api', url: path.join(base, 'remotes', 'orders-api.git'), role: 'backend', base: 'develop', release: ['main'], deploys: [{ branch: 'develop', to: 'the test server' }], stack: 'NestJS 12, PostgreSQL 16' },
    { name: 'web', url: path.join(base, 'remotes', 'web.git'), role: 'frontend', host: 'github', base: 'main', release: [], stack: 'React 19' },
  ],
  databases: [{ name: 'orders', engine: 'PostgreSQL 16', repos: ['orders-api'] }],
  services: [{ name: 'keycloak', kind: 'auth', version: '26', runs: 'container', used: [{ repo: 'orders-api', for: 'realm acme, client orders-api' }, { repo: 'web', for: 'client web' }] }],
  env: [{ repo: 'orders-api', name: 'DATABASE_URL', purpose: 'the orders database', secret: true, from: 'the team\'s vault' }],
});

// Two existing repositories on local remotes, with their own branches (develop is orders-api's, web has only main).
function world() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-system-')));
  const team = path.join(base, 'se-forge-projects');
  for (const d of [team]) { fs.mkdirSync(d, { recursive: true }); sh(d, 'git', 'init', '-q', '-b', 'main'); sh(d, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'team'); }
  for (const [name, branches] of [['orders-api', ['main', 'develop']], ['web', ['main']]]) {
    const src = path.join(base, 'src', name);
    fs.mkdirSync(src, { recursive: true });
    sh(src, 'git', 'init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(src, 'README.md'), `# ${name}\n`);
    fs.mkdirSync(path.join(src, '.github/workflows'), { recursive: true });
    fs.writeFileSync(path.join(src, '.github/workflows/deploy.yml'), 'on: { push: { branches: [develop] } }\n');
    sh(src, 'git', 'add', '.');
    sh(src, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '-m', 'existing');
    for (const b of branches.slice(1)) sh(src, 'git', 'branch', b);
    sh(base, 'git', 'clone', '-q', '--bare', src, path.join(base, 'remotes', `${name}.git`));
  }
  const env = { ...process.env, FORGE_USER_CONFIG: path.join(base, 'user', 'config.json'), FORGE_CACHE_DIR: path.join(base, 'cache') };
  const forge = (args, cwd = base) => { const r = spawnSync('node', [FORGE, ...args], { cwd, env, encoding: 'utf8' }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
  assert.equal(forge(['setup', '--team-repo', team]).code, 0);
  const file = path.join(base, 'system.json');
  fs.writeFileSync(file, JSON.stringify(SYSTEM(base), null, 2));
  return { base, team, env, forge, file, ws: path.join(base, 'code', 'acme') };
}

test('the system description: what is refused, and never a value', () => {
  const sys = SYSTEM('/x');
  assert.deepEqual(checkSystem(sys), []);
  const bad = structuredClone(sys);
  bad.board = { host: 'bitbucket', project: 'acme' };
  bad.repos.push({ name: 'web', url: '', role: 'site', base: '' });
  bad.env.push({ repo: 'payments', name: 'STRIPE_KEY', value: 'sk_live_123' });
  bad.services[0].used.push({ repo: 'nope', for: 'x' });
  bad.extra = 1;
  const errors = checkSystem(bad).join('\n');
  for (const re of [/unknown key extra/, /board must be/, /the name web is used twice/, /url is the repository's Git address/, /role must be one of/, /base is the branch tickets start from/, /env\[1\] \(STRIPE_KEY\): no repository named payments/, /value looks like a value\. The system description names each variable and who provides it, never its value/, /used names no known repository \(nope\)/]) assert.match(errors, re);
  assert.deepEqual(deploysOn(sys, 'orders-api', 'develop'), ['the test server']);
  assert.deepEqual(deploysOn(sys, 'web', 'main'), []);
  assert.deepEqual(deepMerge({ a: { b: 1, c: [1] }, d: 1 }, { a: { c: [2] } }), { a: { b: 1, c: [2] }, d: 1 });
});

test('forge system check: a file, or the system of the checkout', () => {
  const w = world();
  let r = w.forge(['system', 'check', w.file]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /system\.json: ok/);
  fs.writeFileSync(w.file, JSON.stringify({ ...SYSTEM(w.base), board: {} }));
  r = w.forge(['system', 'check', w.file]);
  assert.equal(r.code, 1);
  assert.match(r.out, /1 problem\n- board must be/);
});

test('forge system init: every repository cloned and linked, its own branches kept, the root as the lead\'s home', () => {
  const w = world();
  const r = w.forge(['system', 'init', '--system', 'acme', '--from', w.file, '--workspace', w.ws]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /system acme: 2 of 2 repositories in .*code\/acme; the board is acme\/board/);
  const folder = path.join(w.team, 'acme');
  for (const d of ['plans', 'reviews', 'bootstrap', 'changes', 'repos']) assert.ok(fs.existsSync(path.join(folder, d)), d);
  const pj = JSON.parse(fs.readFileSync(path.join(folder, 'project.json'), 'utf8'));
  assert.equal(pj.project.board, 'acme/board');
  for (const name of ['orders-api', 'web']) {
    const dest = path.join(w.ws, name);
    assert.equal(sh(dest, 'git', 'remote', 'get-url', 'origin'), path.join(w.base, 'remotes', `${name}.git`), 'origin stays the original repository');
    assert.equal(fs.realpathSync(path.join(dest, '.forge/project')), fs.realpathSync(folder));
    assert.deepEqual(memberOf(dest), { system: 'acme', repo: name });
    assert.equal(sh(dest, 'git', 'status', '--porcelain'), '', 'nothing of the kit is visible to git');
    assert.ok(fs.existsSync(path.join(dest, '.claude/settings.local.json')), 'the kit synced there');
  }
  assert.equal(sh(path.join(w.ws, 'web'), 'git', 'branch', '--format=%(refname:short)'), 'main', 'no branch created: web has only main');
  assert.equal(sh(path.join(w.ws, 'orders-api'), 'git', 'branch', '--format=%(refname:short)'), 'main', 'no local develop, dev or staging made');
  const orders = loadConfig(path.join(w.ws, 'orders-api'), {});
  assert.equal(orders.config.branches.base, 'develop');
  assert.deepEqual(orders.config.branches.promote, ['main']);
  assert.deepEqual(orders.config.branches.protected, ['develop', 'main']);
  assert.equal(orders.project.host, 'gitlab');
  assert.equal(orders.project.board, 'acme/board', 'the system\'s board, from the shared settings');
  const web = loadConfig(path.join(w.ws, 'web'), {});
  assert.equal(web.config.branches.base, 'main');
  assert.equal(web.project.host, 'github', 'a repository\'s own host');
  assert.equal(web.errors.length, 0, web.errors.join('; '));
  // The root: a local repository of the kit's files only, the members left out of it.
  assert.deepEqual(memberOf(w.ws), { system: 'acme', repo: null });
  assert.ok(fs.existsSync(path.join(w.ws, '.claude/agents/backend-engineer.md')), 'the lead\'s agents');
  assert.equal(sh(w.ws, 'git', 'status', '--porcelain'), '', 'the member repositories and the kit are left out of the root');
  assert.match(fs.readFileSync(path.join(w.ws, '.git/info/exclude'), 'utf8'), /^\/orders-api\/$/m);
  assert.equal(sh(w.ws, 'git', 'remote'), '', 'the root has no remote: never pushed');
  // Run again: kept as it is, settings a person edited untouched.
  const own = path.join(folder, 'repos/orders-api/project.json');
  const edited = JSON.parse(fs.readFileSync(own, 'utf8'));
  edited.policy.gates.full = 'npm test';
  fs.writeFileSync(own, JSON.stringify(edited));
  const again = w.forge(['system', 'init', '--system', 'acme', '--workspace', w.ws]);
  assert.equal(again.code, 0, again.out);
  assert.doesNotMatch(again.out, /cloning/);
  assert.equal(loadConfig(path.join(w.ws, 'orders-api'), {}).config.gates.full, 'npm test');
});

test('forge system init stops on a broken description, and says which repository failed to clone', () => {
  const w = world();
  const sys = SYSTEM(w.base);
  sys.repos[1].url = path.join(w.base, 'remotes', 'missing.git');
  fs.writeFileSync(w.file, JSON.stringify(sys));
  let r = w.forge(['system', 'init', '--system', 'acme', '--from', w.file, '--workspace', w.ws]);
  assert.equal(r.code, 1);
  assert.match(r.out, /! web: git clone failed/);
  assert.ok(fs.existsSync(path.join(w.ws, 'orders-api/.forge/repo.json')), 'the others are set up');
  r = w.forge(['system', 'init', '--system', 'other', '--from', w.file, '--workspace', w.ws]);
  assert.equal(r.code, 2);
  assert.match(r.out, /name is acme, the system is other/);
});

// A system set up, with ticket 5's plan in orders-api and ticket 6's in web, and the hooks run as Claude Code does.
const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/policy/bin/forge-hook.mjs');
function system() {
  const w = world();
  assert.equal(w.forge(['system', 'init', '--system', 'acme', '--from', w.file, '--workspace', w.ws]).code, 0);
  const folder = path.join(w.team, 'acme');
  for (const [repo, gates] of [['orders-api', 'test -f done.txt'], ['web', 'test -f done.txt']]) {
    const own = path.join(folder, 'repos', repo, 'project.json');
    const s = JSON.parse(fs.readFileSync(own, 'utf8'));
    s.policy.gates.full = gates;
    s.policy.paths = { generated: ['src/gen'] };
    fs.writeFileSync(own, JSON.stringify(s));
  }
  fs.writeFileSync(path.join(folder, 'plans/5-orders.md'), '# Orders (#5)\nRepo: orders-api\nBranch: `feat/5-orders`\nGates: none\nE2E: not applicable (no user flow)\n');
  fs.writeFileSync(path.join(folder, 'plans/6-list.md'), '# List (#6)\nRepo: web\nBranch: feat/6-list\nGates: none\nE2E: not applicable (no user flow)\n');
  fs.writeFileSync(path.join(folder, 'plans/7-none.md'), '# None (#7)\nBranch: feat/7-none\n');
  const hook = (event, payload) => {
    const r = spawnSync('node', [HOOK, event], { input: JSON.stringify({ cwd: w.ws, permission_mode: 'default', session_id: 's', transcript_path: path.join(w.base, 's.jsonl'), ...payload }), encoding: 'utf8', cwd: w.ws, env: { ...w.env, CLAUDE_PROJECT_DIR: w.ws } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  const pre = (tool_name, tool_input, extra = {}) => {
    const out = hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name, tool_input, tool_use_id: 't', ...extra });
    return { decision: out?.hookSpecificOutput?.permissionDecision ?? 'allow', reason: out?.hookSpecificOutput?.permissionDecisionReason ?? '' };
  };
  return { ...w, folder, hook, pre, lane: (repo, name) => path.join(w.ws, repo, '.claude/worktrees', name) };
}

test('forge lane: a worktree in the ticket\'s repository, from its own base branch; a detached one for review', () => {
  const s = system();
  let r = s.forge(['lane', 'open', '5'], s.ws);
  assert.equal(r.code, 0, r.out);
  const lane = s.lane('orders-api', '5-lane');
  assert.match(r.out, new RegExp(`lane: ${lane}\\nrepository orders-api, branch feat/5-orders, base develop`));
  assert.equal(sh(lane, 'git', 'branch', '--show-current'), 'feat/5-orders');
  assert.equal(sh(lane, 'git', 'merge-base', 'HEAD', 'origin/develop'), sh(lane, 'git', 'rev-parse', 'origin/develop'), 'from orders-api\'s develop');
  assert.equal(sh(path.join(s.ws, 'orders-api'), 'git', 'status', '--porcelain'), '', 'the lane is left out of git');
  assert.equal(sh(s.ws, 'git', 'status', '--porcelain'), '', 'and out of the root');
  r = s.forge(['lane', 'open', '5', '--review'], s.ws);
  assert.equal(r.code, 2);
  assert.match(r.out, /feat\/5-orders is not pushed yet: nothing to review/);
  sh(lane, 'git', 'push', '-q', '-u', 'origin', 'feat/5-orders');
  r = s.forge(['lane', 'open', '5', '--review'], path.join(s.ws, 'web'));
  assert.equal(r.code, 0, r.out);
  const review = s.lane('orders-api', '5-review');
  assert.equal(sh(review, 'git', 'rev-parse', 'HEAD'), sh(lane, 'git', 'rev-parse', 'HEAD'));
  assert.equal(spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: review }).status, 1, 'detached');
  r = s.forge(['lane', 'open', '5'], s.ws);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /already used by worktree/, 'the branch is checked out in the first lane already');
  r = s.forge(['lane', 'open', '7'], s.ws);
  assert.equal(r.code, 2);
  assert.match(r.out, /7-none\.md needs a Repo: line naming one of the system's repositories \(orders-api, web\)/);
  r = s.forge(['worktrees'], s.ws);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /✓ orders-api\/\.claude\/worktrees\/5-lane  feat\/5-orders  done, clean, everything pushed/, 'the root lists every repository\'s lanes');
  assert.match(r.out, /✓ orders-api\/\.claude\/worktrees\/5-review  detached  done/);
  assert.equal(s.forge(['lane', 'close', review], s.ws).code, 0);
  assert.ok(!fs.existsSync(review));
  assert.equal(sh(lane, 'git', 'branch', '--show-current'), 'feat/5-orders');
});

test('at the workspace root, each call is judged by the rules of the repository it works in', () => {
  const s = system();
  s.forge(['lane', 'open', '5'], s.ws);
  const lane = s.lane('orders-api', '5-lane');
  const agent = { agent_id: 'a1', agent_type: 'backend-engineer' };
  // develop is orders-api's base branch, protected there and unknown at the root.
  let r = s.pre('Bash', { command: `cd ${lane} && git push origin HEAD:develop` }, agent);
  assert.equal(r.decision, 'deny', r.reason);
  assert.match(r.reason, /develop/);
  assert.equal(s.pre('Bash', { command: `git -C ${lane} push origin HEAD:develop` }, agent).decision, 'deny');
  assert.equal(s.pre('Bash', { command: `cd ${lane} && git push origin feat/5-orders` }, agent).decision, 'allow');
  // orders-api's generated folder, by the file's own repository.
  r = s.pre('Write', { file_path: path.join(lane, 'src/gen/client.ts'), content: 'x' }, agent);
  assert.equal(r.decision, 'deny', r.reason);
  assert.match(r.reason, /generated/i);
  assert.equal(s.pre('Write', { file_path: path.join(lane, 'src/orders.ts'), content: 'x' }, agent).decision, 'allow');
  // forge lane is the lead's.
  assert.equal(s.pre('Bash', { command: 'forge lane open 6' }, agent).decision, 'deny');
  // A member's main checkout stays as it is: an agent that starts there (the lead's cd) is sent to its lane.
  const web = path.join(s.ws, 'web');
  r = s.pre('Bash', { command: 'git switch -c feat/6-list' }, { ...agent, cwd: web });
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /git switch would change web's main checkout.*Work in your lane/s);
  assert.equal(s.pre('Bash', { command: `cd ${web} && git commit -m x` }, agent).decision, 'deny');
  assert.equal(s.pre('Write', { file_path: path.join(web, 'probe.txt'), content: 'ok' }, agent).decision, 'deny');
  assert.equal(s.pre('Bash', { command: 'git status && git log --oneline -3' }, { ...agent, cwd: web }).decision, 'allow', 'reading is fine');
  assert.equal(s.pre('Bash', { command: `cd ${lane} && git commit -q -m "feat: x (#5)"` }, { ...agent, cwd: web }).decision, 'allow', 'in its lane');
});

test('at the workspace root, an engineer is spawned into its ticket\'s lane, in the plan\'s repository', () => {
  const s = system();
  s.forge(['lane', 'open', '5'], s.ws);
  s.forge(['lane', 'open', '6'], s.ws);
  const spawn = (prompt) => s.pre('Agent', { subagent_type: 'backend-engineer', description: 'Build #5', prompt });
  let r = spawn('Build ticket #5 from .forge/project/plans/5-orders.md.');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /forge lane open 5/);
  r = spawn(`Build ticket #5 from .forge/project/plans/5-orders.md. Your lane: ${s.lane('web', '6-lane')}`);
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /changes orders-api, but the lane .* is in web: one ticket, one repository/);
  r = spawn(`Build ticket #5 from .forge/project/plans/5-orders.md. Your lane: ${s.lane('orders-api', '5-lane')} (cd there first).`);
  assert.equal(r.decision, 'allow', r.reason);
  // The lead's `cd` into a member repository persists across its calls: the session is still the system's root.
  r = s.pre('Agent', { subagent_type: 'frontend-engineer', description: 'UI lane #6', prompt: 'Build ticket #6 in the web repository.' }, { cwd: path.join(s.ws, 'web') });
  assert.equal(r.decision, 'deny', 'no lane, even with the lead in web');
  assert.match(r.reason, /forge lane open/);
  const start = s.hook('subagent-start', { hook_event_name: 'SubagentStart', agent_id: 'a1', agent_type: 'backend-engineer' });
  assert.match(start.hookSpecificOutput.additionalContext, /^SYSTEM: you start at the system's workspace root/m);
});

test('an agent of the root finishes on its lane\'s gates, recorded in its repository', () => {
  const s = system();
  s.forge(['lane', 'open', '5'], s.ws);
  const lane = s.lane('orders-api', '5-lane');
  const transcript = path.join(s.base, 'agent-a1.jsonl');
  fs.writeFileSync(transcript, `${JSON.stringify({ type: 'user', message: { role: 'user', content: `Build #5. Your lane: ${lane}` } })}\n`);
  const stop = () => s.hook('subagent-stop', { hook_event_name: 'SubagentStop', stop_hook_active: false, agent_id: 'a1', agent_type: 'backend-engineer', agent_transcript_path: transcript });
  sh(lane, 'git', 'push', '-q', '-u', 'origin', 'feat/5-orders');
  let out = stop();
  assert.equal(out?.decision, 'block');
  assert.match(out.reason, /Gates failed on feat\/5-orders@\w{8} .*test -f done\.txt/s, 'the lane\'s branch and orders-api\'s gate, not the root\'s');
  fs.writeFileSync(path.join(lane, 'done.txt'), 'ok\n');
  sh(lane, 'git', 'add', 'done.txt');
  sh(lane, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '-m', 'feat: orders');
  sh(lane, 'git', 'push', '-q');
  out = stop();
  assert.equal(out, null, JSON.stringify(out));
  const head = sh(lane, 'git', 'rev-parse', 'HEAD');
  const gates = JSON.parse(fs.readFileSync(path.join(s.ws, 'orders-api/.forge/state/gates.json'), 'utf8'));
  assert.equal(gates[head]?.ok, true, 'in orders-api\'s state, where forge merge reads it');
  const state = path.join(s.ws, '.forge/state');
  const events = fs.readdirSync(state).filter((f) => /^timeline-.*\.jsonl$/.test(f)).flatMap((f) => fs.readFileSync(path.join(state, f), 'utf8').trim().split('\n')).map((l) => JSON.parse(l));
  assert.deepEqual(events.filter((e) => e.event === 'agent.stop').map((e) => e.repo), ['orders-api'], 'the lead\'s timeline names the repository');
  // The lead moves #5 to Done from the root: checked in orders-api, once a person merged it into develop (decision 133).
  let r = s.pre('Bash', { command: 'forge tracker status 5 Done' });
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /not on a commit merged into origin\/develop/);
  sh(lane, 'git', 'push', '-q', 'origin', 'HEAD:develop');
  sh(path.join(s.ws, 'orders-api'), 'git', 'fetch', '-q', 'origin');
  r = s.pre('Bash', { command: 'forge tracker status 5 Done' });
  assert.notEqual(r.decision, 'deny', r.reason);
});

const FAKE_HOST = `#!/bin/sh
echo "$(basename "$0") $* [board=$GITLAB_REPO]" >> "$FAKE_DIR/calls"
case "$1 $2" in
  "mr list") cat "$FAKE_DIR/list.json" ;;
  "mr merge") echo merged ;;
  "issue view") echo '{"iid":1,"state":"opened","labels":["status::In Testing"]}' ;;
  "issue update"|"issue close"|"issue note"|"label create") ;;
  "label list") echo '[]' ;;
  *) echo "unexpected: $*" >&2; exit 1 ;;
esac
`;

test('forge merge from the root: in the ticket\'s repository, the issue closed on the system board; a deploying base is a person\'s', () => {
  const s = system();
  const bin = path.join(s.base, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'glab'), FAKE_HOST);
  fs.chmodSync(path.join(bin, 'glab'), 0o755);
  const env = { ...s.env, PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: bin };
  const forge = (args) => { const r = spawnSync('node', [FORGE, ...args], { cwd: s.ws, env, encoding: 'utf8' }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
  // web's tickets go to GitLab's board even though web lives on GitHub: give web a GitLab host for this test.
  const web = path.join(s.folder, 'repos/web/project.json');
  fs.writeFileSync(web, JSON.stringify({ ...JSON.parse(fs.readFileSync(web, 'utf8')), project: { host: 'gitlab' } }));
  const ready = (ticket, repo, branch) => {
    s.forge(['lane', 'open', ticket], s.ws);
    const lane = s.lane(repo, `${ticket}-lane`);
    fs.writeFileSync(path.join(lane, 'done.txt'), 'ok\n');
    sh(lane, 'git', 'add', 'done.txt');
    sh(lane, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '-m', 'feat: x');
    sh(lane, 'git', 'push', '-q', '-u', 'origin', branch);
    const head = sh(lane, 'git', 'rev-parse', 'HEAD');
    fs.mkdirSync(path.join(s.ws, repo, '.forge/state'), { recursive: true });
    fs.writeFileSync(path.join(s.ws, repo, '.forge/state/gates.json'), JSON.stringify({ [head]: { ok: true, branch } }));
    fs.mkdirSync(path.join(s.folder, 'reviews', ticket), { recursive: true });
    for (const n of ['code', 'security', 'spec']) fs.writeFileSync(path.join(s.folder, 'reviews', ticket, `${n}.md`), `Verdict: APPROVE\nCommit: ${head}\n`);
    fs.writeFileSync(path.join(bin, 'list.json'), JSON.stringify([{ iid: 9, draft: false, sha: head }]));
    return head;
  };
  ready('5', 'orders-api', 'feat/5-orders');
  let r = forge(['merge', '5']);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /READY FOR A PERSON: feat\/5-orders@\w{8} passed every check, but merging into develop deploys to the test server \(decision 133\)/);
  assert.match(fs.readFileSync(path.join(bin, 'calls'), 'utf8'), /^glab mr list --source-branch feat\/5-orders --target-branch develop/m);
  assert.doesNotMatch(fs.readFileSync(path.join(bin, 'calls'), 'utf8'), /mr merge|issue/);
  const head = ready('6', 'web', 'feat/6-list');
  r = forge(['merge', '6']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /merged feat\/6-list@\w{8} into main \(MR\/PR 9\)/);
  const calls = fs.readFileSync(path.join(bin, 'calls'), 'utf8');
  assert.match(calls, new RegExp(`^glab mr merge 9 --yes --sha ${head} \\[board=\\]$`, 'm'), 'the merge request is the repository\'s own');
  assert.match(calls, /^glab issue .*6.* \[board=acme\/board\]$/m, 'the issue is on the system board');
  // The owner lets the lead merge into develop (decision 133's setting).
  const sys = JSON.parse(fs.readFileSync(path.join(s.folder, 'system.json'), 'utf8'));
  sys.repos[0].deploys[0].merge = 'lead';
  fs.writeFileSync(path.join(s.folder, 'system.json'), JSON.stringify(sys));
  fs.writeFileSync(path.join(bin, 'list.json'), JSON.stringify([{ iid: 9, draft: false, sha: sh(s.lane('orders-api', '5-lane'), 'git', 'rev-parse', 'HEAD') }]));
  r = forge(['merge', '5']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /merged feat\/5-orders@\w{8} into develop/);
});

test('forge dashboard at the root covers the system: every repository\'s merges, a Repo column and filter', () => {
  const s = system();
  s.forge(['lane', 'open', '6'], s.ws);
  const lane = s.lane('web', '6-lane');
  fs.writeFileSync(path.join(lane, 'list.tsx'), 'export {}\n');
  sh(lane, 'git', 'add', 'list.tsx');
  sh(lane, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '-m', 'feat: list');
  sh(lane, 'git', 'push', '-q', '-u', 'origin', 'feat/6-list');
  const web = path.join(s.ws, 'web');
  sh(web, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'merge', '-q', '--no-ff', '-m', "Merge branch 'feat/6-list' into 'main'", 'feat/6-list');
  sh(web, 'git', 'push', '-q', 'origin', 'main');
  let r = s.forge(['dashboard', '--text', '--offline'], s.ws);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /#6 \[web\] List/);
  r = s.forge(['dashboard', '--offline', '--no-open'], s.ws);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /of \d+ merged/);
  const html = fs.readFileSync(path.join(s.ws, '.forge/state/dashboard.html'), 'utf8');
  assert.match(html, /<th data-i="2">Repo<\/th>/);
  assert.match(html, /<select id="repo-filter"><option value="">all 2<\/option><option>orders-api<\/option><option>web<\/option><\/select>/);
  assert.match(html, /<tr class="t-row" data-repo="web">/);
  assert.match(fs.readFileSync(path.join(s.ws, '.forge/state/dashboard.csv'), 'utf8').split('\n')[0], /,merged,repo$/);
});

test('forge doctor at the root checks each repository, not the root\'s own gate and branches', () => {
  const w = world();
  assert.equal(w.forge(['system', 'init', '--system', 'acme', '--from', w.file, '--workspace', w.ws]).code, 0);
  const r = w.forge(['doctor'], w.ws);
  assert.match(r.out, /✓ system acme: 2 repositories, the board acme\/board/);
  assert.match(r.out, /! orders-api: no gate command \(repos\/orders-api\/project\.json, policy\.gates\.full\)/);
  assert.match(r.out, /! web: no gate command/);
  assert.doesNotMatch(r.out, /branches missing on origin|^! no gate command/m);
});
