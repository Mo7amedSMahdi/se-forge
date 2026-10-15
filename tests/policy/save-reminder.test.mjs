// The Stop hook reminds the lead to `forge save` unsaved plans and reports, once per set of changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, sh, ctxFor } from './helpers.mjs';
import { saveReminder } from '../../core/policy/lib/save.mjs';

// A client checkout whose .forge/project links to a folder in a real team repo, as forge init leaves it.
function linked() {
  const { dir } = makeRepo();
  const team = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-team-')));
  sh(team, 'git', 'init', '-q', '-b', 'main');
  sh(team, 'git', 'config', 'user.email', 't@e'); sh(team, 'git', 'config', 'user.name', 't');
  const folder = path.join(team, 'portal');
  fs.mkdirSync(path.join(folder, 'plans'), { recursive: true });
  fs.renameSync(path.join(dir, '.forge/project/project.json'), path.join(folder, 'project.json'));
  sh(team, 'git', 'add', '.'); sh(team, 'git', 'commit', '-q', '-m', 'init');
  fs.rmSync(path.join(dir, '.forge/project'), { recursive: true });
  fs.symlinkSync(folder, path.join(dir, '.forge/project'), 'dir');
  return { dir, team, folder };
}
const stop = (dir, extra = {}) => saveReminder({ hook_event_name: 'Stop', ...extra }, ctxFor(dir));

test('nothing unsaved: the lead stops', () => {
  const { dir } = linked();
  assert.equal(stop(dir), null);
});

test('an unsaved plan sends the lead back once, naming it and forge save', () => {
  const { dir, folder } = linked();
  fs.writeFileSync(path.join(folder, 'plans/12-login.md'), '# Login (#12)\n');
  const r = stop(dir);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /1 file\(s\) in the team repo are not saved yet \(plans\/12-login\.md\)/);
  assert.match(r.reason, /forge save -m/);
  assert.equal(stop(dir, { stop_hook_active: true }), null, 'never twice in a row');
  assert.equal(stop(dir), null, 'not again for the same unsaved set');
  fs.writeFileSync(path.join(folder, 'plans/13-logout.md'), '# Logout (#13)\n');
  assert.equal(stop(dir).decision, 'block', 'again once something new is unsaved');
});

test('saved: no reminder; lanes are never reminded (they stop through SubagentStop)', () => {
  const { dir, team, folder } = linked();
  fs.writeFileSync(path.join(folder, 'plans/12-login.md'), '# Login (#12)\n');
  assert.equal(saveReminder({ hook_event_name: 'Stop' }, ctxFor(dir, { agent_id: 'a1', agent_type: 'backend-engineer' })), null);
  sh(team, 'git', 'add', '.'); sh(team, 'git', 'commit', '-q', '-m', 'save');
  assert.equal(stop(dir), null);
});

test('changes elsewhere in the team repo (another project) do not count', () => {
  const { dir, team } = linked();
  fs.mkdirSync(path.join(team, 'other'));
  fs.writeFileSync(path.join(team, 'other/notes.md'), 'x\n');
  assert.equal(stop(dir), null);
});
