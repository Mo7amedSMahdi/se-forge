// After a file edit: run the project's format, lint and type-check rules for that file and
// hand failures straight back to the agent (fast feedback; the gates still decide "done").
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { git, linkedPath } from './context.mjs';
import { globToRegex, resolvePath, relTo } from './paths.mjs';

const quote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
// The folder a rule's command runs in: rule.dir (repo-relative), else the repo root.
export const ruleDir = (root, rule) => (rule.dir ? path.join(root, rule.dir) : root);
const tail = (s, n = 25) => s.trim().split('\n').slice(-n).join('\n');

// Returns a message for the agent when a check failed, else null.
export function checkAfterEdit(input, ctx) {
  const p = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!p) return null;
  const abs = linkedPath(resolvePath(p, ctx.cwd, ctx.home), ctx);
  if (!fs.existsSync(abs)) return null;
  const top = git(path.dirname(abs), ['rev-parse', '--show-toplevel']);
  const root = top.ok ? top.out : ctx.root;
  const rel = relTo(abs, root);
  if (rel === null) return null;
  const { edits } = ctx.config;
  const failures = [];
  for (const phase of ['format', 'lint', 'typecheck']) {
    for (const rule of edits[phase]) {
      if (!globToRegex(rule.glob).test(rel)) continue;
      // {file} is repo-relative and the command runs from the repo root, also inside a toolchain container;
      // with rule.dir (a folder holding one service), both are relative to that folder instead.
      const where = ruleDir(root, rule);
      const file = path.relative(where, abs);
      if (file.startsWith('..')) continue;
      const cmd = rule.command.replaceAll('{file}', quote(file));
      const r = spawnSync('sh', ['-c', cmd], { cwd: where, encoding: 'utf8', timeout: edits.timeoutSec * 1000, env: { ...ctx.env, CI: 'true' } });
      if (r.status !== 0) {
        const why = r.error?.code === 'ETIMEDOUT' ? `timed out after ${edits.timeoutSec}s` : `exit ${r.status}`;
        failures.push(`[${phase}] ${rule.command} (${why})\n${tail(`${r.stdout || ''}\n${r.stderr || ''}`)}`);
      }
    }
  }
  return failures.length ? `Checks failed after your edit of ${rel}. Fix them before you move on:\n${failures.join('\n\n')}` : null;
}
