// forge docs check (decisions 66, 76): MADR 4.0.0's required parts and the Mermaid blocks it renders.
// Rendering needs Docker; it is covered by tests/architecture/run.sh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { madrMissing, mermaidBlocks, isAdr, checkDocs } from '../../core/cli/docs.mjs';

const SAMPLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../architecture/docs');

test('the sample ADR has every MADR part', () => {
  const f = path.join(SAMPLE, 'adr/0001-cursor-pagination-for-lists.md');
  assert.deepEqual(madrMissing(f, fs.readFileSync(f, 'utf8')), []);
});

test('missing MADR parts are named', () => {
  const missing = madrMissing('/x/adr/use-postgres.md', '# Use PostgreSQL\n\n## Context\n\nWe chose PostgreSQL.\n');
  assert.deepEqual(missing, ['file name NNNN-title-with-dashes.md', '## Context and Problem Statement', '## Considered Options', '## Decision Outcome', 'Chosen option: "<option>", because …', 'status: proposed | rejected | accepted | deprecated | superseded by ADR-NNNN']);
  assert.ok(madrMissing('/x/adr/0002-a.md', '---\nstatus: superseded by ADR-0007\n---\n# A\n## Context and Problem Statement\n## Considered Options\n## Decision Outcome\nChosen option: "B", because x\n').length === 0);
});

test('records are found by folder or front matter; mermaid blocks with their line', () => {
  assert.ok(isAdr('/r/docs/adr/0001-x.md', ''));
  assert.ok(isAdr('/r/notes/x.md', '---\nstatus: proposed\n---\n'));
  assert.ok(!isAdr('/r/docs/architecture/context.md', '# Context'));
  const blocks = mermaidBlocks('# x\n\n```mermaid\nC4Context\n  title t\n```\n\ntext\n```mermaid\nflowchart LR\n  a --> b\n```\n');
  assert.deepEqual(blocks.map((b) => b.line), [3, 9]);
  assert.match(blocks[0].code, /^C4Context\n/);
});

test('checkDocs reports per file and fails on a broken record (without rendering)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-docs-test-'));
  fs.mkdirSync(path.join(dir, 'adr'));
  fs.copyFileSync(path.join(SAMPLE, 'adr/0001-cursor-pagination-for-lists.md'), path.join(dir, 'adr/0001-cursor-pagination-for-lists.md'));
  assert.equal(checkDocs([dir], { cwd: dir, render: false }).ok, true);
  fs.writeFileSync(path.join(dir, 'adr/0002-cache.md'), '# Cache\n');
  const r = checkDocs(['adr'], { cwd: dir, render: false });
  assert.equal(r.ok, false);
  assert.match(r.text, /^ok {3}adr\/0001-cursor-pagination-for-lists\.md: MADR$/m);
  assert.match(r.text, /^FAIL adr\/0002-cache\.md: not MADR 4\.0\.0, missing ## Context and Problem Statement/m);
});
