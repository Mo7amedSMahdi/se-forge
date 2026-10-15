// Engineers run on their tier's model (decision 94), through the hook entry point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRepo, writeProjectConfig, DEFAULT_TEST_CONFIG } from './helpers.mjs';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/policy/bin/forge-hook.mjs');

function spawn(dir, subagent_type, model) {
  const payload = { hook_event_name: 'PreToolUse', cwd: dir, permission_mode: 'default', session_id: 's', transcript_path: '/nonexistent/s.jsonl', tool_name: 'Agent', tool_input: { subagent_type, description: 'API lane #7', prompt: 'Do the work.', ...(model ? { model } : {}) } };
  const r = spawnSync('node', [BIN, 'pre-tool-use'], { input: JSON.stringify(payload), encoding: 'utf8', cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const out = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { decision: out?.permissionDecision ?? 'allow', reason: out?.permissionDecisionReason ?? '' };
}

test('an engineer spawned with a costlier model is refused; without one, or with its own, it runs', () => {
  const { dir } = makeRepo();
  for (const type of ['backend-engineer', 'frontend-engineer', 'mobile-engineer', 'db-engineer', 'devops-engineer', 'qa-engineer']) {
    const r = spawn(dir, type, 'opus');
    assert.equal(r.decision, 'deny', type);
    assert.match(r.reason, new RegExp(`\\[models:tier\\] ${type} runs on its own model \\(sonnet\\), not opus: spawn it without model=`));
  }
  assert.equal(spawn(dir, 'backend-engineer').decision, 'allow');
  assert.equal(spawn(dir, 'backend-engineer', 'sonnet').decision, 'allow');
});

test('the planner, the reviewers and other roles keep their model choice', () => {
  const { dir } = makeRepo();
  for (const type of ['planner', 'code-reviewer', 'security-reviewer', 'architect']) assert.equal(spawn(dir, type, 'opus').decision, 'allow', type);
});

test("the model forge sync rendered for the role decides, and the project's mapping when none is rendered", () => {
  const { dir } = makeRepo();
  fs.mkdirSync(path.join(dir, '.claude/agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude/agents/backend-engineer.md'), '---\nname: backend-engineer\nmodel: claude-sonnet-5-5\n---\n');
  assert.equal(spawn(dir, 'backend-engineer', 'sonnet').decision, 'allow', 'an alias of the rendered model');
  assert.equal(spawn(dir, 'backend-engineer', 'opus').decision, 'deny');
  const other = makeRepo(null).dir;
  writeProjectConfig(other, { policy: DEFAULT_TEST_CONFIG, project: { models: { standard: 'opus' } } });
  assert.equal(spawn(other, 'backend-engineer', 'opus').decision, 'allow', 'a project that maps its standard tier to opus');
});
