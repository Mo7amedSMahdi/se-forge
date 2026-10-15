#!/usr/bin/env node
// A stand-in glab with state, for live trials that run the tracker and merge requests end to end:
// issues (labels, notes, open/closed), labels, and merge requests whose merge really merges the source
// branch into the target in the local bare remote, at the commit given with --sha.
//   FAKE_DIR     folder for state.json and calls.log (every call is logged, one JSON array per line)
//   FAKE_REMOTE  the bare repository that stands for the GitLab project
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = process.env.FAKE_DIR;
const remote = process.env.FAKE_REMOTE;
const args = process.argv.slice(2);
fs.appendFileSync(path.join(dir, 'calls.log'), `${JSON.stringify(args)}\n`);
const file = path.join(dir, 'state.json');
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { issues: {}, labels: [], mrs: {}, nextIssue: 1, nextMr: 1 };
const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2));
const out = (v) => process.stdout.write(typeof v === 'string' ? `${v}\n` : JSON.stringify(v));
const fail = (msg) => { process.stderr.write(`${msg}\n`); process.exit(1); };
const now = () => new Date().toISOString();
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = (branch) => { try { return git('--git-dir', remote, 'rev-parse', `refs/heads/${branch}`); } catch { return null; } };
const URL = 'https://gitlab.example.com/acme/users';

// Flags: --name value, --name=value, -x value; repeated ones collected; booleans true.
const VALUED = new Set(['--label', '-l', '--unlabel', '--title', '-t', '--description', '-d', '--message', '-m', '--output', '-F', '--per-page', '-P',
  '--source-branch', '-s', '--target-branch', '-b', '--sha', '--name', '--linked-issues', '--link-type', '--repo', '-R', '--assignee', '-a', '--milestone']);
const flags = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('-') && a.includes('=')) { const [k, v] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]; (flags[k] ??= []).push(v); continue; }
  if (VALUED.has(a)) { (flags[a] ??= []).push(args[i + 1] ?? ''); i++; continue; }
  if (a.startsWith('-')) { (flags[a] ??= []).push(true); continue; }
  pos.push(a);
}
const one = (...names) => names.map((n) => flags[n]?.[0]).find((v) => v !== undefined);
const many = (...names) => names.flatMap((n) => flags[n] || []).flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean);
const [group, verb, target] = pos;

const issueOut = (i) => ({ iid: i.iid, title: i.title, description: i.description, labels: i.labels, state: i.state, created_at: i.created_at, updated_at: i.updated_at, author: { username: i.author }, assignees: [], web_url: `${URL}/-/issues/${i.iid}` });
const mrOut = (m) => ({ iid: m.iid, title: m.title, source_branch: m.source_branch, target_branch: m.target_branch, draft: m.draft, work_in_progress: m.draft, state: m.state, sha: m.state === 'opened' ? head(m.source_branch) : m.sha, web_url: `${URL}/-/merge_requests/${m.iid}` });
const issue = (id) => state.issues[String(id).replace(/^#/, '')] || fail(`issue ${id} not found`);
const findMr = (ref) => {
  if (ref === undefined) { let b; try { b = git('rev-parse', '--abbrev-ref', 'HEAD'); } catch { b = ''; } ref = b; }
  return state.mrs[String(ref).replace(/^!/, '')] || Object.values(state.mrs).find((m) => m.source_branch === ref && m.state === 'opened') || fail(`merge request ${ref} not found`);
};

if (group === 'auth') out('Logged in to gitlab.example.com as test-user');
else if (flags['--version'] || group === 'version') out('glab 1.121.0 (fake)');
else if (group === 'label' && verb === 'list') out(state.labels.map((name) => ({ name })));
else if (group === 'label' && verb === 'create') { const n = one('--name', '-n') ?? target; if (n && !state.labels.includes(n)) state.labels.push(n); save(); out(`Created label ${n}`); }
else if (group === 'issue' && verb === 'list') {
  const want = many('--label', '-l');
  const all = flags['--all'] || flags['-A'];
  out(Object.values(state.issues).filter((i) => (all || i.state === 'opened') && want.every((l) => i.labels.includes(l))).map(issueOut));
} else if (group === 'issue' && verb === 'view') out(issueOut(issue(target)));
else if (group === 'issue' && verb === 'create') {
  const iid = state.nextIssue++;
  state.issues[iid] = { iid, title: one('--title', '-t') ?? '', description: one('--description', '-d') ?? '', labels: many('--label', '-l'), state: 'opened', created_at: now(), updated_at: now(), author: 'test-user', notes: [], links: many('--linked-issues') };
  for (const l of state.issues[iid].labels) if (!state.labels.includes(l)) state.labels.push(l);
  save();
  out(`Creating issue in acme/users\n${URL}/-/issues/${iid}`);
} else if (group === 'issue' && verb === 'update') {
  const i = issue(target);
  const drop = many('--unlabel', '-u');
  i.labels = [...new Set([...i.labels.filter((l) => !drop.includes(l)), ...many('--label', '-l')])];
  i.updated_at = now();
  save();
  out(`Updated issue #${i.iid}`);
} else if (group === 'issue' && (verb === 'close' || verb === 'reopen')) { const i = issue(target); i.state = verb === 'close' ? 'closed' : 'opened'; i.updated_at = now(); save(); out(`${verb === 'close' ? 'Closed' : 'Reopened'} issue #${i.iid}`); }
else if (group === 'issue' && verb === 'note') { const i = issue(target); i.notes.push({ body: one('--message', '-m') ?? '', at: now() }); i.updated_at = now(); save(); out(`${URL}/-/issues/${i.iid}#note_${i.notes.length}`); }
else if (group === 'mr' && verb === 'create') {
  let source = one('--source-branch', '-s');
  if (!source) { try { source = git('rev-parse', '--abbrev-ref', 'HEAD'); } catch { fail('no source branch'); } }
  if (!head(source)) fail(`the source branch ${source} is not on the remote: push it first`);
  const iid = state.nextMr++;
  state.mrs[iid] = { iid, title: one('--title', '-t') ?? source, description: one('--description', '-d') ?? '', source_branch: source, target_branch: one('--target-branch', '-b') ?? 'dev', draft: Boolean(flags['--draft'] || flags['--wip']), state: 'opened', sha: null };
  save();
  out(`${URL}/-/merge_requests/${iid}`);
} else if (group === 'mr' && verb === 'list') {
  const s = one('--source-branch', '-s');
  const t = one('--target-branch', '-b');
  out(Object.values(state.mrs).filter((m) => m.state === 'opened' && (!s || m.source_branch === s) && (!t || m.target_branch === t)).map(mrOut));
} else if (group === 'mr' && verb === 'view') out(mrOut(findMr(target)));
else if (group === 'mr' && verb === 'update') {
  const m = findMr(target);
  if (flags['--ready']) m.draft = false;
  if (flags['--draft'] || flags['--wip']) m.draft = true;
  if (one('--title', '-t')) m.title = one('--title', '-t');
  save();
  out(`Updated merge request !${m.iid}`);
} else if (group === 'mr' && (verb === 'merge' || verb === 'accept')) {
  const m = findMr(target);
  const sha = head(m.source_branch);
  if (m.draft) fail(`merge request !${m.iid} is a draft`);
  const want = one('--sha');
  if (want && want !== sha) fail(`SHA does not match HEAD of source branch: ${sha}`);
  // The merge, as GitLab's default method does it: a merge commit on the target branch.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gitlab-merge-'));
  try {
    git('clone', '-q', '--branch', m.target_branch, remote, work);
    git('-C', work, '-c', 'user.email=gitlab@example.com', '-c', 'user.name=GitLab', 'merge', '--no-ff', '-q', '-m', `Merge branch '${m.source_branch}' into '${m.target_branch}'\n\nSee merge request !${m.iid}`, `origin/${m.source_branch}`);
    git('-C', work, 'push', '-q', 'origin', m.target_branch);
  } catch (e) {
    fail(`merge failed: ${e.stderr || e.message}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  m.state = 'merged'; m.sha = sha;
  save();
  out(`Merged !${m.iid} (${m.source_branch} into ${m.target_branch})`);
} else if (group === 'ci') out('No pipelines: this project has no CI in the trial.');
else if (group === 'api') out('[]');
else fail(`fake glab: not supported: ${args.join(' ')}`);
