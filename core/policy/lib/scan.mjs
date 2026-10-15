// Secret scan before `git commit`: the lines the commit would add, including files that a
// `git add` earlier in the same command is about to stage. gitleaks when installed, else
// built-in high-confidence patterns.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git } from './context.mjs';
import { deny } from './decision.mjs';

export const PATTERNS = [
  ['aws-access-key-id', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['private-key', /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/],
  ['github-token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['gitlab-token', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['stripe-live-key', /\b(sk|rk)_live_[A-Za-z0-9]{24,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['anthropic-api-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['openai-api-key', /\bsk-(proj-)?[A-Za-z0-9_-]{40,}\b/],
];

// Added lines per file from a unified diff.
function addedLines(diff, into) {
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) { file = line === '+++ /dev/null' ? null : line.slice(4).replace(/^b\//, ''); continue; }
    if (file && line.startsWith('+')) (into[file] ??= []).push(line.slice(1));
  }
  return into;
}

// What the commit would add: staged changes plus the paths staged in the same command.
export function commitContent(cwd, extraPaths = []) {
  const files = {};
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!top.ok) return { root: cwd, files };
  const root = top.out;
  addedLines(git(root, ['diff', '--cached', '-U0', '--no-color', '--no-ext-diff']).out, files);
  if (extraPaths.length) {
    const abs = extraPaths.map((p) => path.resolve(cwd, p));
    addedLines(git(root, ['diff', '-U0', '--no-color', '--no-ext-diff', '--', ...abs]).out, files);
    const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...abs]).out.split('\0').filter(Boolean);
    for (const rel of untracked) {
      try {
        const st = fs.statSync(path.join(root, rel));
        if (st.isFile() && st.size < 1e6) files[rel] = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
      } catch { /* vanished */ }
    }
  }
  return { root, files };
}

const gitleaksAvailable = () => spawnSync('gitleaks', ['version'], { encoding: 'utf8' }).status === 0;

function scanWithGitleaks(root, files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-scan-'));
  try {
    for (const [rel, lines] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      fs.writeFileSync(path.join(tmp, rel), lines.join('\n'));
    }
    const args = ['dir', tmp, '--no-banner', '--redact', '--report-format', 'json', '--report-path', '-'];
    const cfg = path.join(root, '.gitleaks.toml');
    if (fs.existsSync(cfg)) args.push('--config', cfg);
    const r = spawnSync('gitleaks', args, { encoding: 'utf8', timeout: 60000 });
    if (r.status === 0) return [];
    let report = [];
    try { report = JSON.parse(r.stdout || '[]'); } catch { return [{ file: '(scan)', rule: `gitleaks failed: ${(r.stderr || '').trim().split('\n').pop()}` }]; }
    return report.map((f) => ({ file: path.relative(tmp, f.File), rule: f.RuleID }));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function scanBuiltin(files) {
  const out = [];
  for (const [file, lines] of Object.entries(files)) {
    for (const line of lines) for (const [rule, rx] of PATTERNS) if (rx.test(line)) out.push({ file, rule });
  }
  return out;
}

export function scanCommit(ctx, cwd, extraPaths) {
  const { root, files } = commitContent(cwd, extraPaths);
  if (!Object.keys(files).length) return [];
  const mode = ctx.config.secrets.scanner;
  let found;
  if (mode === 'builtin' || (mode === 'auto' && !gitleaksAvailable())) found = scanBuiltin(files);
  else if (gitleaksAvailable()) found = scanWithGitleaks(root, files);
  else return [deny('secrets:scanner', 'secrets.scanner is "gitleaks" but gitleaks is not installed (brew install gitleaks). Commits are blocked until it is.')];
  if (!found.length) return [];
  const list = [...new Set(found.map((f) => `${f.file} (${f.rule})`))].slice(0, 10).join(', ');
  return [deny('secrets:commit', `This commit would add what looks like a secret: ${list}. Remove it and load the value from an environment variable by name. A false positive is for a human to allow (.gitleaksignore).`)];
}
