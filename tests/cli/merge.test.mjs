// forge merge (decision 75): the lead merges a ticket into dev only when gates, tests, reviews and the
// contract all hold for the branch head, and tells the host that commit. glab and gh are fakes that
// answer `mr list`/`pr list` from a file and record merge calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, writeProjectConfig, sh, ctxFor, decideBash, DEFAULT_TEST_CONFIG } from '../policy/helpers.mjs';
import { merge, readReport } from '../../core/cli/merge.mjs';

const FAKE = `#!/bin/sh
# $0 is glab or gh; list answers come from $FAKE_DIR/list.json, merges are appended to $FAKE_DIR/calls.
echo "$(basename "$0") $*" >> "$FAKE_DIR/calls"
case "$1 $2" in
  "mr list"|"pr list") cat "$FAKE_DIR/list.json" ;;
  "mr merge"|"pr merge") echo merged ;;
  "issue view") if [ "$(basename "$0")" = gh ]; then echo '{"labels":[{"name":"status:In Testing"}],"state":"OPEN"}'; else echo '{"iid":1,"state":"opened","labels":["status::In Testing"]}'; fi ;;
  "issue update"|"issue edit"|"issue close"|"issue note"|"issue comment"|"label create"|"issue reopen") ;;
  "label list") echo '[]' ;;
  *) echo "unexpected: $*" >&2; exit 1 ;;
esac
`;

function setup({ host = 'gitlab', policy = {} } = {}) {
  const { dir } = makeRepo();
  writeProjectConfig(dir, { project: { host }, policy: { ...DEFAULT_TEST_CONFIG, ...policy } });
  fs.mkdirSync(path.join(dir, '.forge/project/plans'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.forge/project/plans/1-login.md'), '# Login (#1)\nBranch: feat/1-login\nE2E: not applicable (no user flow)\n');
  fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/auth/login.ts'), 'export const login = 1;\n');
  fs.writeFileSync(path.join(dir, 'tests/login.test.ts'), 'test(1);\n');
  sh(dir, 'git', 'add', 'src', 'tests'); sh(dir, 'git', 'commit', '-q', '-m', 'feat: login');
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'feat/1-login');
  const bin = path.join(dir, '.forge/fake-bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const n of ['glab', 'gh']) { fs.writeFileSync(path.join(bin, n), FAKE); fs.chmodSync(path.join(bin, n), 0o755); }
  const env = { HOME: '/Users/dev', PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: bin };
  const head = () => sh(dir, 'git', 'rev-parse', 'HEAD');
  const w = {
    dir, env, bin, head,
    gates(sha = head()) { fs.mkdirSync(path.join(dir, '.forge/state'), { recursive: true }); fs.writeFileSync(path.join(dir, '.forge/state/gates.json'), JSON.stringify({ [sha]: { ok: true } })); },
    review(name, verdict = 'APPROVE', sha = head()) {
      fs.mkdirSync(path.join(dir, '.forge/project/reviews/1'), { recursive: true });
      fs.writeFileSync(path.join(dir, `.forge/project/reviews/1/${name}.md`), `# ${name} review\n\nVerdict: **${verdict}**\nCommit: \`${sha}\`\n\nNo blockers.\n`);
    },
    request({ draft = false, sha = head() } = {}) {
      fs.writeFileSync(path.join(bin, 'list.json'), JSON.stringify(host === 'github' ? [{ number: 7, isDraft: draft, headRefOid: sha }] : [{ iid: 7, draft, sha }]));
    },
    run() { const lines = []; const code = merge({ ticket: '1' }, env, dir, (l) => lines.push(l)); return { code, out: lines.join('\n') }; },
    calls() { try { return fs.readFileSync(path.join(bin, 'calls'), 'utf8'); } catch { return ''; } },
    ready() { w.gates(); for (const r of ['code', 'security', 'spec']) w.review(r); w.request(); },
  };
  return w;
}

test('report lines are read with or without Markdown emphasis', () => {
  assert.deepEqual(readReport('Verdict: **APPROVE**\nCommit: `abc1234`'), { verdict: 'APPROVE', commit: 'abc1234' });
  assert.deepEqual(readReport('**Verdict:** PASS\n**Commit:** 0123456789abcdef0123456789abcdef01234567'), { verdict: 'PASS', commit: '0123456789abcdef0123456789abcdef01234567' });
  assert.equal(readReport('Verdict: CHANGES REQUESTED').verdict, 'CHANGES REQUESTED');
  assert.deepEqual(readReport('no lines here'), { verdict: null, commit: null });
});

test('with everything green it merges into dev and tells GitLab the commit', () => {
  const w = setup();
  w.ready();
  const r = w.run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /merged feat\/1-login@\w{8} into dev \(MR\/PR 7\)/);
  assert.match(w.calls(), /^glab mr list --source-branch feat\/1-login --target-branch dev --output json$/m);
  assert.match(w.calls(), new RegExp(`^glab mr merge 7 --yes --sha ${w.head()}$`, 'm'));
});

test('the merged ticket moves to Done and its issue closes (decision 118)', () => {
  const w = setup();
  w.ready();
  const r = w.run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /#1 -> Done \(its issue is closed\)/);
  const calls = w.calls();
  assert.match(calls, /^glab issue update 1 --unlabel status::In Testing --label status::Done$/m);
  assert.match(calls, /^glab issue close 1$/m);
  assert.match(calls, new RegExp(`^glab issue note 1 --message Merged into dev: feat/1-login@${w.head().slice(0, 12)}, MR/PR 7`, 'm'));
  assert.ok(calls.indexOf('mr merge') < calls.indexOf('issue close'), 'only after the merge');
});

test('a tracker failure after the merge is reported, and the merge stands', () => {
  const w = setup();
  w.ready();
  fs.writeFileSync(path.join(w.bin, 'glab'), FAKE.replace('"issue view")', '"issue view") echo "401 Unauthorized" >&2; exit 1 ;;\n  "never")'));
  const r = w.run();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /merged feat\/1-login/);
  assert.match(r.out, /the tracker did not move #1 .*forge tracker status 1 Done/);
});

test('a refused merge leaves the ticket alone', () => {
  const w = setup();
  w.ready();
  w.review('security', 'CHANGES REQUESTED');
  assert.equal(w.run().code, 1);
  assert.doesNotMatch(w.calls(), /issue (update|close)/);
});

test('GitHub: the PR is merged with --match-head-commit', () => {
  const w = setup({ host: 'github' });
  w.ready();
  assert.equal(w.run().code, 0);
  assert.match(w.calls(), /^gh pr list --head feat\/1-login --base dev --state open --json number,isDraft,headRefOid$/m);
  assert.match(w.calls(), new RegExp(`^gh pr merge 7 --merge --match-head-commit ${w.head()}$`, 'm'));
});

test('it refuses, and calls no merge, when a check fails', () => {
  const cases = [
    ['no gates on the head', (w) => fs.rmSync(path.join(w.dir, '.forge/state/gates.json')), /gates have not passed/],
    ['a required review missing', (w) => fs.rmSync(path.join(w.dir, '.forge/project/reviews/1/security.md')), /no security review/],
    ['a review asking for changes', (w) => w.review('code', 'CHANGES REQUESTED'), /code review verdict is CHANGES REQUESTED/],
    ['an optional report present and failing', (w) => w.review('qa', 'FAIL'), /qa review verdict is FAIL/],
    ['a report without a commit', (w) => fs.writeFileSync(path.join(w.dir, '.forge/project/reviews/1/spec.md'), 'Verdict: PASS\n'), /spec review names no known commit/],
    ['a draft MR', (w) => w.request({ draft: true }), /is a draft/],
    ['the MR at another commit', (w) => w.request({ sha: 'f'.repeat(40) }), /MR\/PR 7 is at ffffffff/],
    ['no MR', (w) => fs.writeFileSync(path.join(w.bin, 'list.json'), '[]'), /no open MR\/PR from feat\/1-login into dev/],
  ];
  for (const [name, breakIt, why] of cases) {
    const w = setup();
    w.ready();
    breakIt(w);
    const r = w.run();
    assert.equal(r.code, 1, name);
    assert.match(r.out, /^NOT MERGED/m, name);
    assert.match(r.out, why, name);
    assert.doesNotMatch(w.calls(), /merge 7/, `${name}: no merge call`);
  }
});

test('reviews of an earlier commit count only when the commits since change only tests', () => {
  const policy = { tests: { sides: [{ name: 'backend', code: ['src/**'], tests: ['tests/**'] }], e2e: { tests: [], command: '' } } };
  const w = setup({ policy });
  const reviewed = w.head();
  for (const r of ['code', 'security', 'spec']) w.review(r, 'APPROVE', reviewed);
  fs.writeFileSync(path.join(w.dir, 'tests/login.test.ts'), 'test(2);\n');
  sh(w.dir, 'git', 'commit', '-q', '-am', 'test: QA adds a case'); sh(w.dir, 'git', 'push', '-q');
  w.gates(); w.request();
  assert.equal(w.run().code, 0, 'a test-only commit after the review is fine');
  fs.writeFileSync(path.join(w.dir, 'src/auth/login.ts'), 'export const login = 2;\n');
  fs.writeFileSync(path.join(w.dir, 'tests/login.test.ts'), 'test(3);\n');
  sh(w.dir, 'git', 'commit', '-q', '-am', 'fix: after review'); sh(w.dir, 'git', 'push', '-q');
  w.gates(); w.request();
  const r = w.run();
  assert.equal(r.code, 1);
  assert.match(r.out, /code review is of \w{8}; since then src\/auth\/login\.ts changed: review again/);
});

test('a branch that changes the contract is left to a person', () => {
  const w = setup({ policy: { paths: { ...DEFAULT_TEST_CONFIG.paths, contract: ['api/openapi.yaml'] } } });
  fs.mkdirSync(path.join(w.dir, 'api'));
  fs.writeFileSync(path.join(w.dir, 'api/openapi.yaml'), 'openapi: 3.1.0\n');
  sh(w.dir, 'git', 'add', 'api'); sh(w.dir, 'git', 'commit', '-q', '-m', 'feat: contract'); sh(w.dir, 'git', 'push', '-q');
  w.ready();
  const r = w.run();
  assert.equal(r.code, 1);
  assert.match(r.out, /changes the API contract \(api\/openapi\.yaml\): a person merges it/);
});

test('the policy: forge merge is the lead\'s, raw merges stay refused', () => {
  const { dir } = makeRepo();
  assert.equal(decideBash('forge merge 12', ctxFor(dir)).decision, 'allow', 'the lead');
  for (const t of ['backend-engineer', 'code-reviewer', 'project-manager']) assert.equal(decideBash('forge merge 12', ctxFor(dir, { agent_id: 'a1', agent_type: t })).decision, 'deny', t);
  for (const c of ['glab mr merge 3', 'gh pr merge 3 --merge']) {
    const r = decideBash(c, ctxFor(dir));
    assert.equal(r.decision, 'deny', c);
    assert.match(r.findings[0].reason, /forge merge <ticket>/);
  }
  for (const c of ['git push origin dev', 'git push origin HEAD:staging', 'git push origin main']) assert.equal(decideBash(c, ctxFor(dir)).decision, 'deny', c);
});
