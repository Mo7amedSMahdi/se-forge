// The dashboard's Architecture tab (decision 124): the approved documents and their drafts, the requirements and
// the SRS, the contract's operations, the standards with the register's overrides, the diagrams and their cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo, sh } from '../policy/helpers.mjs';
import { loadConfig } from '../../core/policy/lib/config.mjs';
import { architectureModel, operations, asvsLevel, inlineSvg, renderDiagrams } from '../../core/cli/dashboard/architecture.mjs';
import { renderArchitecture } from '../../core/cli/dashboard/architecture-view.mjs';

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const commitAll = (dir, msg, date) => sh(dir, 'env', `GIT_AUTHOR_DATE=${date}`, `GIT_COMMITTER_DATE=${date}`, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-qam', msg);
const OVERVIEW = '# Architecture overview: Acme\n\nThe app.\n\n```mermaid\nC4Container\n  title Containers: Acme\n  Container(api, "API", "NestJS")\n```\n\n```mermaid\nsequenceDiagram\n  a->>b: hi\n```\n';
const ADR = (n, title, status = 'accepted') => `---\nstatus: ${status}\ndate: 2026-10-10\ndecision-makers: the owner\n---\n\n# ${title}\n\n## Context and Problem Statement\nWhy.\n`;
const CONTRACT = 'openapi: 3.1.0\ninfo:\n  title: Acme\npaths:\n  /api/users:\n    get:\n      operationId: listUsers\n      summary: List the users\n      responses:\n        \'200\':\n          description: ok\n        \'422\':\n          description: bad\n    post:\n      operationId: createUser\n      summary: "Create a user"\n      responses:\n        \'201\':\n          description: made\ncomponents:\n  schemas:\n    get:\n      operationId: notAnOperation\n';

// A fake docker standing in for mermaid-cli: one out-N.svg per mermaid block of the input, each call logged.
function fakeDocker(base) {
  const bin = path.join(base, 'bin');
  write(path.join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(path.join(base, 'docker.log'))}, a.join(' ') + '\\n');
const dir = a[a.indexOf('-v') + 1].split(':')[0];
const blocks = [...fs.readFileSync(path.join(dir, 'all.md'), 'utf8').matchAll(/\`\`\`mermaid\\n([\\s\\S]*?)\\n\`\`\`/g)];
if (blocks.some((b) => /broken/.test(b[1]))) { console.error('Parse error on line 1'); process.exit(1); }
blocks.forEach((b, i) => fs.writeFileSync(path.join(dir, 'out-' + (i + 1) + '.svg'), '<svg id="my-svg" onload="x()"><style>#my-svg{fill:red}</style><script>alert(1)</script><text>' + b[1].split('\\n')[0] + '</text></svg>'));
`);
  fs.chmodSync(path.join(bin, 'docker'), 0o755);
  return { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, calls: () => (fs.existsSync(path.join(base, 'docker.log')) ? fs.readFileSync(path.join(base, 'docker.log'), 'utf8').trim().split('\n') : []) };
}

function fixture() {
  const { dir } = makeRepo();
  const base = path.dirname(dir);
  sh(dir, 'git', 'checkout', '-q', 'dev');
  write(path.join(dir, 'docs/architecture/overview.md'), OVERVIEW);
  write(path.join(dir, 'docs/architecture/nfr.md'), '# Non-functional requirements: Acme\n\n| Flow | p95 |\n|---|---|\n| list | 200 ms |\n');
  write(path.join(dir, 'docs/adr/0001-stack.md'), ADR(1, 'NestJS and PostgreSQL'));
  write(path.join(dir, 'docs/adr/0002-layout.md'), ADR(2, 'One repository'));
  write(path.join(dir, 'api/openapi.yaml'), CONTRACT);
  sh(dir, 'git', 'add', '.');
  commitAll(dir, 'docs: architecture', '2026-10-10T12:00:00Z');
  sh(dir, 'git', 'tag', 'api-v1.0.0');
  sh(dir, 'git', 'push', '-q', 'origin', 'dev', 'api-v1.0.0');
  const team = fs.mkdtempSync(path.join(base, 'team-'));
  const folder = path.join(team, 'acme');
  write(path.join(folder, 'architecture/overview.md'), OVERVIEW.replace('The app.', 'The app (draft).'));
  write(path.join(folder, 'architecture/adr/0001-stack.md'), ADR(1, 'NestJS and PostgreSQL', 'proposed'));
  write(path.join(folder, 'architecture/adr/0002-layout.md'), ADR(2, 'One repository', 'proposed'));
  write(path.join(folder, 'bootstrap/inputs/brief.md'), '# The brief\n\nUsers sign up.\n');
  write(path.join(folder, 'bootstrap/inputs/screens.pdf'), '%PDF-1.4');
  write(path.join(folder, 'bootstrap/user-stories.md'), '# User stories: Acme\n\n### E1-S1 Sign up\n- AC1 an email\n');
  write(path.join(folder, 'bootstrap/authorization-matrix.md'), '# Authorization matrix: Acme\n\n| Role | Who |\n|---|---|\n| member | anyone |\n');
  write(path.join(folder, 'bootstrap/decisions.md'), '| ID | Category | Decision |\n|---|---|---|\n| D-001 | Users | One role. |\n| D-020 | Security | Review level **OWASP ASVS Level 1**. |\n| D-079 | Security | Threat model at ASVS Level 1, as before. |\n');
  sh(team, 'git', 'init', '-q', '-b', 'main');
  sh(team, 'git', 'add', '.');
  commitAll(team, 'drafts', '2026-10-09T12:00:00Z');
  write(path.join(folder, 'architecture/adr/0003-cache.md'), ADR(3, 'A cache', 'proposed'));
  write(path.join(folder, 'architecture/adr/0002-layout.md'), `${ADR(2, 'One repository', 'proposed')}\nChanged after the approval.\n`);
  sh(team, 'git', 'add', '.');
  commitAll(team, 'later drafts', '2026-10-12T12:00:00Z');
  const { config } = loadConfig(dir, {});
  const project = { name: 'acme', stack: { frontend: 'React + TypeScript (Vite)', backend: 'NestJS 12', database: 'PostgreSQL 16', other: 'mongo-ish tooling' }, api: { spec: 'api/openapi.yaml', pin: 'api-v1.0.0' } };
  return { dir, base, folder, config, project };
}

test('the contract\'s operations come from its paths only, with their answers', () => {
  assert.deepEqual(operations(CONTRACT), [
    { method: 'GET', path: '/api/users', id: 'listUsers', summary: 'List the users', responses: ['200', '422'] },
    { method: 'POST', path: '/api/users', id: 'createUser', summary: 'Create a user', responses: ['201'] },
  ]);
});

test('the ASVS level is the register\'s first decision naming one; another level later replaces it', () => {
  assert.deepEqual(asvsLevel('| D-020 | Security | **OWASP ASVS Level 1** |\n| D-079 | Security | at ASVS Level 1 |'), { level: 1, source: 'D-020' });
  assert.deepEqual(asvsLevel('| D-020 | Security | ASVS Level 1 |\n| D-090 | Security | raised to ASVS Level 3 |'), { level: 3, source: 'D-090' });
  assert.equal(asvsLevel('| D-001 | Users | One role. |'), null);
});

test('the model: approved documents first, a draft changed after approval noted, a draft never approved shown as one', () => {
  const f = fixture();
  const docker = fakeDocker(f.base);
  const a = architectureModel({ main: f.dir, folder: f.folder, base: 'dev', project: f.project, config: f.config, env: docker.env, stateDir: path.join(f.dir, '.forge/state'), now: Date.parse('2026-10-14T12:00:00Z') });
  assert.equal(a.overview.source, 'docs/architecture/overview.md on origin/dev');
  assert.match(a.overview.text, /The app\.\n/, 'the approved text, not the draft');
  assert.equal(a.overview.newerDraft, null, 'the draft was committed before the approved copy');
  assert.deepEqual(a.adrs.map((d) => [d.number, d.meta.status, d.draft, d.newerDraft]), [['0001', 'accepted', false, null], ['0002', 'accepted', false, 'architecture/adr/0002-layout.md'], ['0003', 'proposed', true, null]]);
  assert.equal(a.adrs[2].source, 'the team repo\'s architecture/adr/0003-cache.md (a draft, not yet approved)');
  assert.deepEqual(a.inputs.map((i) => [i.name, Boolean(i.text), i.kind]), [['brief.md', true, 'MD'], ['screens.pdf', false, 'PDF']]);
  assert.equal(a.api.source, 'api/openapi.yaml at api-v1.0.0');
  assert.deepEqual(a.standards.asvs, { level: 1, source: 'D-020', why: 'the register\'s D-020' });
  assert.deepEqual(a.standards.stack.map((s) => [s.label, s.guide]), [['Frontend', 'stack-react'], ['Backend', 'stack-nestjs'], ['Database', 'db-postgresql'], ['Other', null]]);
  assert.equal(a.registerCount, 3);
  assert.equal(a.designed.length, 1, 'the C4 diagram; a sequence diagram is a flow, not a component view');
  const order = ['## 1. The client\'s requirements', '### The brief', '`bootstrap/inputs/screens.pdf` (PDF', '## 2. Users and roles', '## 3. Functional requirements', '#### E1-S1 Sign up', '## 4. External interfaces', '| GET | `/api/users` | listUsers |', '## 5. Non-functional requirements', '## 6. Constraints and design decisions', '| 0003 | A cache | proposed |', 'holds 3 decisions'];
  let at = 0;
  for (const part of order) { const k = a.srs.indexOf(part, at); assert.ok(k >= at, `the SRS has ${part} in order`); at = k; }
  assert.match(a.standardsText, /OWASP ASVS Level 1\*\* \(the register's D-020\)/);
});

test('diagrams: every new one in one run, kept by its text; one that fails does not cost the others theirs', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-arch-'));
  const docker = fakeDocker(base);
  const state = path.join(base, 'state');
  let d = renderDiagrams(['flowchart A', 'flowchart B'], state, docker.env);
  assert.equal(docker.calls().length, 1, 'one docker run for both');
  assert.match(d.svg('flowchart A'), /^<svg id="dg1"><style>#dg1\{fill:red\}<\/style><text>flowchart A<\/text><\/svg>$/, 'its own id; no script, no handler');
  d = renderDiagrams(['flowchart A', 'flowchart B', 'flowchart C'], state, docker.env);
  assert.equal(docker.calls().length, 2, 'only the new one is drawn');
  assert.ok(d.svg('flowchart B') && d.svg('flowchart C'));
  d = renderDiagrams(['flowchart D', 'broken one'], state, docker.env);
  assert.ok(d.svg('flowchart D'), 'drawn on its own after the batch failed');
  assert.equal(d.svg('broken one'), null);
  assert.match(d.error, /Parse error/);
  assert.equal(inlineSvg('<?xml version="1.0"?><svg id="my-svg"><a href="javascript:x()">l</a><g onclick=\'y()\'/></svg>', 'dg9'), '<svg id="dg9"><a href="#">l</a><g/></svg>');
});

test('the tab: a section per part, each document readable with its source and a download of exactly its text', () => {
  const f = fixture();
  const docker = fakeDocker(f.base);
  const a = architectureModel({ main: f.dir, folder: f.folder, base: 'dev', project: f.project, config: f.config, env: docker.env, stateDir: path.join(f.dir, '.forge/state') });
  const html = renderArchitecture(a);
  for (const id of ['components', 'requirements', 'overview', 'decisions', 'nfr', 'api', 'standards']) assert.match(html, new RegExp(`<details class="doc" id="arch-${id}"`), id);
  assert.match(html, /<details class="doc" id="arch-components" open>/, 'the components first, open');
  assert.match(html, /<figure class="diagram"><svg id="dg\d+">/);
  assert.match(html, /the team repo has a newer draft \(architecture\/adr\/0002-layout\.md\): not approved yet/);
  assert.match(html, /<a href="file:\/\/[^"]+screens\.pdf">Open the PDF<\/a>/);
  assert.match(html, /<span class="verb v-get">GET<\/span><\/td><td><code>\/api\/users<\/code>/);
  const link = (name) => decodeURIComponent(new RegExp(`download="${name}"[^>]*href="data:[^,]+,([^"]+)"`).exec(html)[1]);
  assert.equal(link('overview\\.md'), a.overview.text);
  assert.equal(link('openapi\\.yaml'), CONTRACT);
  assert.equal(link('acme-srs\\.md'), a.srs);
  assert.equal(link('acme-standards\\.md'), a.standardsText);
  assert.doesNotMatch(html, /<script/);
  const none = renderArchitecture(architectureModel({ main: f.dir, folder: f.folder, base: 'dev', project: f.project, config: f.config, env: docker.env, stateDir: path.join(f.dir, '.forge/state'), render: false }));
  assert.match(none, /Diagrams are shown as their text: not drawn in this view/);
  assert.match(none, /<pre class="src"><code>C4Container/);
});
