// Commit secret scan, checks after edits, read-only roles, auto-approved project commands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, sh, DEFAULT_TEST_CONFIG } from './helpers.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/policy/bin/forge-hook.mjs');
const FAKE_AWS = 'AKIAZ3MNB7Q5XK2PLW4T';

function hook(event, payload, dir) {
  const r = spawnSync('node', [BIN, event], { input: JSON.stringify({ cwd: dir, permission_mode: 'default', transcript_path: '/nonexistent/s.jsonl', ...payload }), encoding: 'utf8', cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  return r.stdout ? JSON.parse(r.stdout) : null;
}
const pre = (dir, tool_name, tool_input, extra = {}) => hook('pre-tool-use', { hook_event_name: 'PreToolUse', tool_name, tool_input, ...extra }, dir);
const decision = (out) => out?.hookSpecificOutput?.permissionDecision ?? 'allow';
const reason = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? '';

for (const scanner of ['auto', 'builtin']) {
  test(`commit scan (${scanner}): staged secrets and secrets staged in the same command are refused`, () => {
    const { dir } = makeRepo({ ...DEFAULT_TEST_CONFIG, secrets: { scanner } });
    fs.writeFileSync(path.join(dir, 'leak.ts'), `export const key = "${FAKE_AWS}"\n`);
    let out = pre(dir, 'Bash', { command: 'git add leak.ts && git commit -m "feat: x"' });
    assert.equal(decision(out), 'deny');
    assert.match(reason(out), /\[secrets:commit\].*leak\.ts/);
    sh(dir, 'git', 'add', 'leak.ts');
    assert.equal(decision(pre(dir, 'Bash', { command: 'git commit -m "feat: x"' })), 'deny');
    sh(dir, 'git', 'reset', '-q', 'leak.ts');
    fs.writeFileSync(path.join(dir, 'leak.ts'), 'export const key = process.env.AWS_KEY\n');
    out = pre(dir, 'Bash', { command: 'git add leak.ts && git commit -m "feat: x"' });
    assert.equal(decision(out), 'allow', reason(out));
  });
}

test('the scanner allowlist is a human decision', () => {
  const { dir } = makeRepo();
  assert.equal(decision(pre(dir, 'Write', { file_path: path.join(dir, '.gitleaksignore'), content: 'x' })), 'ask');
});

test('checks after an edit: format runs, lint failures go back to the agent', () => {
  const stripTrailing = "node -e \"const f=process.argv[1],fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/[ \\t]+$/gm,''))\" {file}";
  const { dir } = makeRepo({
    ...DEFAULT_TEST_CONFIG,
    edits: { format: [{ glob: '**/*.{ts,tsx}', command: stripTrailing }], lint: [{ glob: '**/*.ts', command: '! grep -n TODO {file}' }], typecheck: [] },
  });
  const file = path.join(dir, 'src/feature.ts');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'export const a = 1   \n// TODO finish\n');
  const post = () => hook('post-tool-use', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: file, content: '' } }, dir);
  let out = post();
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /\[lint\] ! grep -n TODO \{file\} \(exit 1\)\n2:\/\/ TODO finish/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'export const a = 1\n// TODO finish\n', 'formatter ran');
  fs.writeFileSync(file, 'export const a = 1\n');
  out = post();
  assert.equal(out, null);
  fs.writeFileSync(path.join(dir, 'README.md'), 'TODO\n');
  assert.equal(hook('post-tool-use', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(dir, 'README.md') } }, dir), null, 'rules only apply to matching files');
});

test('a rule with dir runs in that folder, with {file} relative to it (a repo holding several services)', () => {
  const record = 'printf "%s %s\\n" "$(basename "$PWD")" {file} >> ../ran.txt';
  const { dir } = makeRepo({
    ...DEFAULT_TEST_CONFIG,
    edits: { format: [{ glob: 'backend/**/*.py', dir: 'backend', command: record }, { glob: 'frontend/**/*.tsx', dir: 'frontend', command: record }], lint: [], typecheck: [] },
  });
  for (const f of ['backend/app/users.py', 'frontend/src/App.tsx']) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), 'x\n');
    assert.equal(hook('post-tool-use', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(dir, f), content: '' } }, dir), null);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'ran.txt'), 'utf8'), 'backend app/users.py\nfrontend src/App.tsx\n');
});

test('a rule\'s dir must be a folder inside the repository', () => {
  for (const bad of ['../elsewhere', '/abs', '', 'a/../../b']) {
    const { dir } = makeRepo({ ...DEFAULT_TEST_CONFIG, edits: { lint: [{ glob: '**/*.py', dir: bad, command: 'true' }] } });
    assert.match(reason(pre(dir, 'Write', { file_path: path.join(dir, 'a.ts'), content: '' })), /"dir" is a folder inside the repository/, bad);
  }
});

test('edit rules must be { glob, command } objects', () => {
  const { dir } = makeRepo({ ...DEFAULT_TEST_CONFIG, edits: { lint: ['eslint {file}'] } });
  assert.match(reason(pre(dir, 'Write', { file_path: path.join(dir, 'a.ts'), content: '' })), /edits\.lint must be a list of \{ "glob"/);
});

const REVIEWER = { agent_id: 'r1', agent_type: 'code-reviewer' };
const ROLE_CASES = [
  ['Edit', { file_path: 'src/auth/login.ts', old_string: 'a', new_string: 'b' }, 'deny'],
  ['Write', { file_path: 'src/new.ts', content: 'x' }, 'deny'],
  ['Write', { file_path: '.forge/project/reviews/12/code.md', content: '# Review' }, 'allow'],
  ['Edit', { file_path: '.forge/project/plans/12-login.md', old_string: 'a', new_string: 'b' }, 'allow'],
  ['Bash', { command: 'git fetch -q && git switch --detach origin/feat/1-login && git diff --stat origin/main...HEAD' }, 'allow'],
  ['Bash', { command: 'grep -rn "role ===" src | head -20' }, 'allow'],
  ['Bash', { command: 'git log --oneline -5 > /tmp/review-log.txt' }, 'allow'],
  ['Bash', { command: 'gh pr view 3 && gh api repos/o/r/pulls/3/files' }, 'allow'],
  ['Bash', { command: 'git switch feat/1-login' }, 'deny'],
  ['Bash', { command: 'git commit -m "fix review"' }, 'deny'],
  ['Bash', { command: 'sed -i "" s/a/b/ src/a.ts' }, 'deny'],
  ['Bash', { command: 'echo fixed > src/a.ts' }, 'deny'],
  ['Bash', { command: 'npm run lint > /tmp/lint.log' }, 'deny'],
  ['Bash', { command: 'find src -name "*.bak" -delete' }, 'deny'],
  ['Bash', { command: 'gh api -X POST repos/o/r/issues/3/comments -f body=x' }, 'deny'],
];

for (const [tool, input, want] of ROLE_CASES) {
  test(`read-only reviewer: ${want.padEnd(5)} ${tool} ${input.command ?? input.file_path}`, () => {
    const { dir } = makeRepo();
    const ti = input.file_path ? { ...input, file_path: path.join(dir, input.file_path) } : input;
    const out = pre(dir, tool, ti, REVIEWER);
    assert.equal(decision(out), want, reason(out));
    if (want === 'deny' && tool !== 'Bash') assert.match(reason(out), /roles:read-only/);
  });
}

test('engineers are not read-only; scout is', () => {
  const { dir } = makeRepo();
  const write = { file_path: path.join(dir, 'src/new.ts'), content: 'x' };
  assert.equal(decision(pre(dir, 'Write', write, { agent_id: 'e1', agent_type: 'frontend-engineer' })), 'allow');
  assert.equal(decision(pre(dir, 'Write', write, { agent_id: 's1', agent_type: 'scout' })), 'deny');
});

// Decision 138: the owner-assistant reads the log and the register with the commands its skill names; the lead writes them.
test('the owner-assistant may read the answer log and the register, never write them', () => {
  const { dir } = makeRepo();
  const oa = { agent_id: 'o1', agent_type: 'owner-assistant' };
  const kinds = `awk -F'|' '/^\\| [0-9]{4}-/ {gsub(/ /,"",$4); print $4}' .forge/project/owner-answers.md | sort | uniq -c`;
  for (const c of [kinds, 'grep -n "retry" .forge/project/bootstrap/decisions.md', 'sed -n 1,40p frontend/src/lib/time.ts']) {
    assert.equal(decision(pre(dir, 'Bash', { command: c }, oa)), 'allow', c);
  }
  for (const f of ['.forge/project/owner-answers.md', '.forge/project/bootstrap/decisions.md']) {
    assert.equal(decision(pre(dir, 'Write', { file_path: path.join(dir, f), content: 'x' }, oa)), 'deny', f);
  }
  assert.notEqual(decision(pre(dir, 'Bash', { command: 'echo "| row |" >> .forge/project/owner-answers.md' }, oa)), 'allow');
});

test('project commands are approved without a prompt; anything else is not', () => {
  const { dir } = makeRepo({ ...DEFAULT_TEST_CONFIG, commands: { allow: ['npm run dev'] } });
  const allowed = ['sh ./check.sh', 'sh ./check.sh > /tmp/gates.log 2>&1; tail -5 /tmp/gates.log', 'npm run dev > /tmp/dev.log 2>&1 &',
    'node .forge/kit/core/policy/bin/forge-hook.mjs gates'];
  for (const c of allowed) {
    const out = pre(dir, 'Bash', { command: c });
    assert.equal(decision(out), 'allow', c);
    assert.match(reason(out), /\[allow:project\]/, c);
  }
  for (const c of ['git status', 'sh ./check.sh && rm -rf build/x', 'FOO=1 sh ./check.sh', 'sh ./check.sh > out.log', 'cat src/a.ts']) {
    assert.equal(pre(dir, 'Bash', { command: c })?.hookSpecificOutput?.permissionDecisionReason?.startsWith('[allow:project]') ?? false, false, c);
  }
});

test('reviewers may file issues, but not change ticket status', () => {
  const { dir } = makeRepo();
  const reviewer = { agent_id: 'r1', agent_type: 'code-reviewer' };
  assert.equal(decision(pre(dir, 'Bash', { command: 'forge tracker create --subject "[Follow-up] add an index" --source ai' }, reviewer)), 'allow');
  assert.equal(decision(pre(dir, 'Bash', { command: 'forge tracker status 12 Done' }, reviewer)), 'deny');
});
