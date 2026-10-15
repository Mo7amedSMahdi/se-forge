// forge docs check <file|folder> ...: architecture documents (decisions 66, 76). Read-only: renders every
// ```mermaid block (C4 diagrams included) with mermaid-cli in Docker into a temporary folder, and checks
// that each decision record has MADR 4.0.0's required parts. Exit 1 on any failure.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class DocsError extends Error {}

export const MERMAID_IMAGE = 'minlag/mermaid-cli:12.0.1';
const BLOCK = /^```mermaid[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;
const STATUS = /^status:\s*"?(proposed|rejected|accepted|deprecated|superseded by ADR-\d{4})"?\s*$/m;

export function mermaidBlocks(text) {
  return [...text.matchAll(BLOCK)].map((m) => ({ code: m[1], line: text.slice(0, m.index).split('\n').length }));
}

// A decision record: in a folder named adr (or decisions), or a file with MADR front matter.
export const isAdr = (file, text) => /(^|\/)(adr|decisions)\/[^/]+\.md$/.test(file.split(path.sep).join('/')) || /^---\n(?:[\s\S]*?\n)?status:/.test(text);

// The MADR 4.0.0 parts a record must have; returns what is missing.
export function madrMissing(file, text) {
  const missing = [];
  if (!/^\d{4}-[a-z0-9-]+\.md$/.test(path.basename(file))) missing.push('file name NNNN-title-with-dashes.md');
  if (!/^# \S/m.test(text)) missing.push('# title');
  for (const h of ['Context and Problem Statement', 'Considered Options', 'Decision Outcome']) {
    if (!new RegExp(`^## ${h}\\s*$`, 'm').test(text)) missing.push(`## ${h}`);
  }
  if (!/^Chosen option: "[^"]+"/m.test(text)) missing.push('Chosen option: "<option>", because …');
  if (!STATUS.test(text)) missing.push('status: proposed | rejected | accepted | deprecated | superseded by ADR-NNNN');
  return missing;
}

function markdownFiles(target) {
  const st = fs.statSync(target, { throwIfNoEntry: false });
  if (!st) throw new DocsError(`${target} does not exist`);
  if (st.isFile()) return target.endsWith('.md') ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).filter((e) => !e.name.startsWith('.')).flatMap((e) => markdownFiles(path.join(target, e.name))).sort();
}

export function checkDocs(targets, { cwd = process.cwd(), render = true } = {}) {
  if (!targets.length) throw new DocsError('forge docs check <file|folder> ...');
  const files = targets.flatMap((t) => markdownFiles(path.resolve(cwd, t)));
  const lines = [];
  let failed = 0;
  const rel = (f) => path.relative(cwd, f) || f;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-docs-'));
  try {
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (isAdr(file, text)) {
        const missing = madrMissing(file, text);
        if (missing.length) { failed++; lines.push(`FAIL ${rel(file)}: not MADR 4.0.0, missing ${missing.join('; ')}`); } else lines.push(`ok   ${rel(file)}: MADR`);
      }
      if (!render) continue;
      for (const [i, block] of mermaidBlocks(text).entries()) {
        const name = `${path.basename(file, '.md')}-${i + 1}`;
        fs.writeFileSync(path.join(tmp, `${name}.mmd`), block.code);
        const user = typeof process.getuid === 'function' ? ['-u', `${process.getuid()}:${process.getgid()}`] : [];
        const r = spawnSync('docker', ['run', '--rm', ...user, '-v', `${tmp}:/data`, MERMAID_IMAGE, '-q', '-i', `/data/${name}.mmd`, '-o', `/data/${name}.svg`], { encoding: 'utf8' });
        if (r.error) throw new DocsError(`docker is not available (${r.error.code}): diagrams are rendered with ${MERMAID_IMAGE}`);
        const ok = r.status === 0 && fs.existsSync(path.join(tmp, `${name}.svg`));
        if (ok) lines.push(`ok   ${rel(file)}:${block.line}: diagram renders`);
        else { failed++; lines.push(`FAIL ${rel(file)}:${block.line}: diagram does not render: ${(r.stderr || r.stdout).split('\n').filter(Boolean).slice(0, 3).join(' | ')}`); }
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (!lines.length) lines.push('no decision records or diagrams found');
  return { ok: failed === 0, text: lines.join('\n') };
}
