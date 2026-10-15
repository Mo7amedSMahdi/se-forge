// The project's folder in the team repo, linked as .forge/project and opened to Claude Code as an extra
// working directory: the rules must treat its real path exactly like the linked one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, DEFAULT_TEST_CONFIG } from './helpers.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/policy/bin/forge-hook.mjs');

function linked() {
  const { dir } = makeRepo(null);
  const team = `${dir}-team/demo`;
  for (const d of ['plans', 'reviews/12', 'kit']) fs.mkdirSync(path.join(team, d), { recursive: true });
  fs.writeFileSync(path.join(team, 'project.json'), JSON.stringify({ policy: DEFAULT_TEST_CONFIG }, null, 2));
  fs.mkdirSync(path.join(dir, '.forge'), { recursive: true });
  fs.symlinkSync(team, path.join(dir, '.forge/project'), 'dir');
  return { dir, team };
}

// project: the session's project (CLAUDE_PROJECT_DIR), when the call runs elsewhere.
function pre(dir, tool_name, tool_input, extra = {}, project = dir) {
  const r = spawnSync('node', [BIN, 'pre-tool-use'], { input: JSON.stringify({ cwd: dir, permission_mode: 'default', transcript_path: '/nonexistent/s.jsonl', hook_event_name: 'PreToolUse', tool_name, tool_input, ...extra }), encoding: 'utf8', cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: project } });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout ? JSON.parse(r.stdout) : null;
  return { decision: out?.hookSpecificOutput?.permissionDecision ?? 'allow', reason: out?.hookSpecificOutput?.permissionDecisionReason ?? '' };
}
const write = (file) => ({ file_path: file, content: 'x\n' });

test('project.json by its real path asks like the linked path', () => {
  const { dir, team } = linked();
  for (const file of [path.join(team, 'project.json'), path.join(dir, '.forge/project/project.json')]) {
    const r = pre(dir, 'Write', write(file));
    assert.equal(r.decision, 'ask', file);
    assert.match(r.reason, /\[repo:config\]/);
  }
  assert.match(pre(dir, 'Bash', { command: `echo '{}' > ${path.join(team, 'project.json')}` }).reason, /\[repo:config\]/, 'Bash writers too');
});

test('the kit overrides ask a person, by either path', () => {
  const { dir, team } = linked();
  for (const file of [path.join(team, 'kit/rules.md'), path.join(dir, '.forge/project/kit/roles/planner.md')]) {
    const r = pre(dir, 'Write', write(file));
    assert.equal(r.decision, 'ask', file);
    assert.match(r.reason, /\[repo:agent-config\] .*kit overrides/);
  }
});

test('plans and reports are written freely; restricted roles keep their limits on real paths', () => {
  const { dir, team } = linked();
  assert.equal(pre(dir, 'Write', write(path.join(team, 'plans/12-x.md'))).decision, 'allow');
  const planner = { agent_id: 'p1', agent_type: 'planner' };
  assert.equal(pre(dir, 'Write', write(path.join(team, 'plans/12-x.md')), planner).decision, 'allow', 'a docs role writes plans by the real path');
  const reviewer = { agent_id: 'r1', agent_type: 'code-reviewer' };
  assert.equal(pre(dir, 'Write', write(path.join(team, 'reviews/12/code.md')), reviewer).decision, 'allow', 'a reviewer writes its report by the real path');
  const r = pre(dir, 'Write', write(path.join(team, 'kit/rules.md')), reviewer);
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /\[roles:read-only\]/);
  assert.equal(pre(dir, 'Write', write(path.join(path.dirname(team), 'other/x.md'))).decision, 'allow', 'outside the project folder: not the kit\'s business');
});

test('an agent that starts in the team repo keeps the project\'s rules (decision 116)', () => {
  const { dir, team } = linked();
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: path.dirname(team) });
  const planner = { agent_id: 'p1', agent_type: 'planner' };
  for (const file of [path.join(dir, '.forge/project/plans/12-x.md'), path.join(team, 'plans/12-x.md')]) {
    const r = pre(team, 'Write', write(file), planner, dir);
    assert.equal(r.decision, 'allow', `${file}: ${r.reason}`);
  }
  assert.equal(pre(team, 'Write', write(path.join(dir, 'src/a.ts')), planner, dir).decision, 'deny', 'still documents only');
});
