#!/usr/bin/env node
// The kit's git hooks, for people and agents alike. Run by the pre-commit and commit-msg wrappers.
//   pre-commit:  no kit files staged, no secrets in the staged changes, the project's commit checks pass
//   commit-msg:  Conventional Commits; the AI co-author line follows the project's coAuthor setting
// Exit 1 stops the commit. A checkout that is not set up for the kit is left alone.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeContext, git, readState } from '../policy/lib/context.mjs';
import { scanCommit } from '../policy/lib/scan.mjs';
import { globToRegex } from '../policy/lib/paths.mjs';
import { ruleDir } from '../policy/lib/edits.mjs';

const TYPES = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'];
const HEADER = new RegExp(`^(${TYPES.join('|')})(\\([\\w./,-]+\\))?!?: \\S.*`);
const GIT_MADE = /^(Merge |Revert "|fixup! |squash! |amend! )/;
const AI_TRAILER = /^Co-Authored-By:.*(\bClaude\b|noreply@anthropic\.com).*$/gim;
const quote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
const fail = (msg) => { process.stderr.write(`se-forge ${process.argv[2]}: ${msg}\n`); process.exit(1); };

function preCommit(ctx) {
  const staged = git(ctx.cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']).out.split('\n').filter(Boolean);
  const generated = readState(ctx, 'sync-manifest.json', { files: {} }).files;
  const kit = staged.filter((f) => f.startsWith('.forge/') || f === '.claude/settings.local.json' || f in generated);
  if (kit.length) fail(`kit files are staged: ${kit.join(', ')}. The kit never goes into a client repository: git restore --staged them.`);

  const found = scanCommit(ctx, ctx.cwd, []);
  if (found.length) fail(found[0].reason);

  for (const rule of ctx.config.commit.checks) {
    // With rule.dir the command runs in that folder and {files} are relative to it (see edits.mjs).
    const where = ruleDir(ctx.root, rule);
    const files = staged.filter((f) => globToRegex(rule.glob).test(f)).map((f) => path.relative(where, path.join(ctx.root, f))).filter((f) => !f.startsWith('..'));
    if (!files.length) continue;
    const cmd = rule.command.replaceAll('{files}', files.map(quote).join(' '));
    const r = spawnSync('sh', ['-c', cmd], { cwd: where, encoding: 'utf8', timeout: ctx.config.edits.timeoutSec * 1000 });
    if (r.status !== 0) fail(`${rule.command} failed:\n${`${r.stdout || ''}\n${r.stderr || ''}`.trim().split('\n').slice(-25).join('\n')}`);
  }
}

function commitMsg(ctx, file) {
  let text = fs.readFileSync(file, 'utf8');
  if (!ctx.project.coAuthor && AI_TRAILER.test(text)) {
    text = text.replace(AI_TRAILER, '').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
    fs.writeFileSync(file, text);
  }
  const header = text.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '';
  if (!GIT_MADE.test(header) && !HEADER.test(header)) {
    fail(`"${header}" is not a Conventional Commit. Use <type>(<scope>): <summary>, with type one of ${TYPES.join(', ')}.`);
  }
}

const [event, arg] = process.argv.slice(2);
const ctx = makeContext({ cwd: process.cwd() });
if (!ctx.configSource) process.exit(0);
if (event === 'pre-commit') preCommit(ctx);
else if (event === 'commit-msg') commitMsg(ctx, path.resolve(arg));
