// forge shot (decision 100): pictures of the app at a moment, with when, which ticket and what they show, kept in
// the project's folder in the team repo (shots/) so the dashboard shows them on the project over time and in its
// Screens tab. The QA engineer records them when a UI ticket passes; anyone can add one.
//   forge shot <image> "<what>" [--ticket <n>]   one picture, PNG or JPEG; its time is the file's
//   forge shot --playwright <report.json> [--ticket <n>]
//                                       the last screen of each passed test in a Playwright JSON report: one per
//                                       test (Chromium's when it ran), named after the test, at the time it was taken
//   forge shot --dir <folder> [--ticket <n>]
//                                       each picture in a folder next to its record { what, at, test, file }: what the
//                                       Flutter integration tests keep in build/forge-shots/ (skill stack-flutter)
//   forge shot                          the project's pictures, oldest first
// Each picture sits next to a JSON file of the same name: at, what, ticket, branch, commit (and the test). The
// ticket is --ticket's, else the branch's (feat/12-…). A picture wider than 1280 px or over 300 KB becomes a JPEG
// at most 1280 px wide (macOS's sips); one still over 1 MB is refused. The same picture twice is recorded once.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git } from '../policy/lib/context.mjs';
import { when } from './dashboard/format.mjs';

export class ShotError extends Error {}

const MAX_WIDTH = 1280;
const SHRINK_OVER = 300 * 1024;
const LIMIT = 1024 * 1024;
const EXT = { png: 'png', jpeg: 'jpg' };
const USAGE = 'forge shot <image> "<what it shows>" [--ticket <n>] | forge shot --playwright <report.json> [--ticket <n>] | forge shot --dir <folder> [--ticket <n>] | forge shot';
const DIR_HINT = 'run the integration tests with --dart-define=FORGE_SHOTS=1: each flow keeps its picture and its record in build/forge-shots/ (skill stack-flutter)';
const CONFIG_HINT = 'run the tests with FORGE_SHOTS=1 and the JSON reporter, with `screenshot: process.env.FORGE_SHOTS ? \'on\' : \'off\'` under `use` in playwright.config.ts (skill write-e2e)';

// { type, width, height } of a PNG or a JPEG, else null.
export function imageInfo(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('latin1', 12, 16) === 'IHDR') return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  // JPEG: the size is in the start-of-frame segment (C0-CF, except C4, C8 and CC).
  let pos = 2;
  while (pos + 9 < buf.length) {
    if (buf[pos] !== 0xff) return null;
    const marker = buf[pos + 1];
    if (marker === 0xff) { pos++; continue; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpeg', width: buf.readUInt16BE(pos + 7), height: buf.readUInt16BE(pos + 5) };
    pos += 2 + buf.readUInt16BE(pos + 2);
  }
  return null;
}

// A JPEG at most 1280 px wide, through macOS's sips (transparency becomes white), or null without it.
function shrink(file, info) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-shot-'));
  const out = path.join(dir, 'shot.jpg');
  try {
    const r = spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', ...(info.width > MAX_WIDTH ? ['--resampleWidth', String(MAX_WIDTH)] : []), file, '--out', out], { encoding: 'utf8' });
    return r.status === 0 && fs.existsSync(out) ? fs.readFileSync(out) : null;
  } catch { return null; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// The picture as it will be kept: { buf, info }, made smaller when it is large.
export function prepare(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { throw new ShotError(`${file} does not exist.`); }
  let info = imageInfo(buf);
  if (!info) throw new ShotError(`${path.basename(file)} is not a PNG or a JPEG.`);
  if (info.width > MAX_WIDTH || buf.length > SHRINK_OVER) {
    const small = shrink(file, info);
    if (small && small.length < buf.length) { buf = small; info = imageInfo(small); }
  }
  if (buf.length > LIMIT) throw new ShotError(`${path.basename(file)} is ${Math.round(buf.length / 1024)} KB, over 1 MB even as a JPEG: take the visible screen, not the whole page.`);
  return { buf, info };
}

export const ticketOfBranch = (b) => { const m = /^[\w-]+\/(\d+)(?:-|$)/.exec(b || ''); return m ? Number(m[1]) : null; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'screen';
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

// Can the end-to-end tests keep pictures for the dashboard (decision 125)? A project whose tests were written before
// decision 100 has none of the switch: QA's run then records nothing. [{ level, msg }] for forge doctor.
const PW_DIRS = ['.', 'frontend', 'web', 'client', 'app'];
const PW_FILES = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs'];
export function screensCheck(main, folder = null) {
  const out = [];
  for (const d of PW_DIRS) {
    const f = PW_FILES.find((x) => fs.existsSync(path.join(main, d, x)));
    if (!f) continue;
    const rel = path.join(d, f).replace(/^\.\//, '');
    out.push(/FORGE_SHOTS/.test(fs.readFileSync(path.join(main, d, f), 'utf8'))
      ? { level: 'ok', msg: `${rel} keeps a picture of each test's last screen with FORGE_SHOTS=1 (the dashboard's screens)` }
      : { level: 'warn', msg: `${rel} keeps no pictures for the dashboard: it needs screenshot: process.env.FORGE_SHOTS ? 'on' : 'off' under use (skill write-e2e). The lead files it as a chore (decision 125)` });
  }
  const flutter = path.join(main, 'mobile', 'integration_test');
  if (fs.existsSync(path.join(main, 'mobile', 'pubspec.yaml')) && fs.existsSync(flutter)) {
    const has = fs.readdirSync(flutter).some((f) => f.endsWith('.dart') && /FORGE_SHOTS|keepScreen/.test(fs.readFileSync(path.join(flutter, f), 'utf8')));
    out.push(has ? { level: 'ok', msg: 'mobile/integration_test keeps pictures with --dart-define=FORGE_SHOTS=1' }
      : { level: 'warn', msg: 'mobile/integration_test keeps no pictures for the dashboard: it needs the Flutter starter\'s forge_shots.dart and keepScreen at the end of each flow (skill write-flutter-tests). The lead files it as a chore (decision 125)' });
  }
  if (out.length && folder) out.push({ level: 'info', msg: `${readShots(folder).length} pictures of the app for the dashboard (forge shot)` });
  return out;
}

// The project's pictures, oldest first, each with its path.
export function readShots(folder) {
  const dir = path.join(folder, 'shots');
  const shots = [];
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')) : []) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const at = Date.parse(s.at);
      if (!Number.isFinite(at) || !s.file || s.file.includes('/')) continue;
      shots.push({ ...s, at, path: path.join(dir, s.file) });
    } catch { /* a broken record is skipped */ }
  }
  return shots.sort((a, b) => a.at - b.at);
}

// Keep one picture: the image and its record, named by time, ticket and what it shows.
export function record({ buf, info, at, what, ticket, branch, commit, test }, folder) {
  const dir = path.join(folder, 'shots');
  const sha = hash(buf);
  const same = readShots(folder).find((s) => s.sha === sha && (s.ticket ?? null) === (ticket ?? null));
  if (same) return { ...same, existed: true };
  fs.mkdirSync(dir, { recursive: true });
  const stamp = `${new Date(at).toISOString().slice(0, 19).replace(/:/g, '')}Z`;
  const base = `${stamp}${ticket ? `-${ticket}` : ''}-${slug(what)}`;
  let name = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${name}.json`)); i++) name = `${base}-${i}`;
  const file = `${name}.${EXT[info.type]}`;
  const meta = { at: new Date(at).toISOString(), what, ticket: ticket ?? null, branch: branch ?? null, commit: commit ?? null, ...(test ? { test } : {}), file, width: info.width, height: info.height, sha };
  fs.writeFileSync(path.join(dir, file), buf);
  fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  return { ...meta, at, path: path.join(dir, file) };
}

// A path written inside a container (/app/test-results/…) found again from the report's folder upward.
function locate(p, reportFile) {
  if (fs.existsSync(p)) return p;
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  let dir = path.dirname(path.resolve(reportFile));
  for (let up = 0; up < 6; up++, dir = path.dirname(dir)) {
    for (let k = 1; k <= parts.length - 2; k++) {
      const c = path.join(dir, ...parts.slice(k));
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

// The last screenshot of each passed test in a Playwright JSON report: one per test, Chromium's first, else the
// first project in the config's order. { file, what, at, test } in time order.
export function fromPlaywright(reportFile) {
  let report;
  try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch (e) { throw new ShotError(`${reportFile} is not a Playwright JSON report (${e.code === 'ENOENT' ? 'no such file' : e.message}).`); }
  if (!Array.isArray(report?.suites)) throw new ShotError(`${reportFile} is not a Playwright JSON report (no suites).`);
  const order = (report.config?.projects || []).map((p) => p.name);
  const rank = (name) => (name === 'chromium' ? -1 : order.includes(name) ? order.indexOf(name) : order.length);
  const picks = new Map();
  const walk = (suite, titles) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const r = (t.results || []).at(-1);
        const shot = r?.status === 'passed' ? (r.attachments || []).filter((a) => a.name === 'screenshot' && a.path).at(-1) : null;
        if (!shot) continue;
        // The same test appears once per project.
        const key = `${spec.file}:${spec.line}:${spec.column}:${spec.title}`;
        const have = picks.get(key);
        if (have && rank(have.project) <= rank(t.projectName)) continue;
        picks.set(key, { project: t.projectName, path: shot.path, what: [...titles, spec.title].join(' › '), at: Date.parse(r.startTime) + (r.duration || 0), test: `${spec.file}:${spec.line}` });
      }
    }
    for (const s of suite.suites || []) walk(s, [...titles, s.title]);
  };
  // A file's suite is named after the file: left out of the names.
  for (const s of report.suites) walk(s, []);
  if (!picks.size) throw new ShotError(`no screenshots of passed tests in ${reportFile}: ${CONFIG_HINT}.`);
  const found = [...picks.values()].map((p) => ({ ...p, file: locate(p.path, reportFile) }));
  const missing = found.filter((p) => !p.file);
  if (missing.length) throw new ShotError(`${missing.length} of ${found.length} screenshots in the report are not on this Mac (${missing[0].path}): run forge shot where the tests wrote test-results/.`);
  return found.sort((a, b) => a.at - b.at);
}

// The pictures a test run kept in a folder, each next to its record { what, at, test?, file }: what the Flutter
// integration tests write with FORGE_SHOTS (skill stack-flutter). { file, what, at, test } in time order.
export function fromDir(dir) {
  let names;
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); } catch { throw new ShotError(`${dir} is not a folder: ${DIR_HINT}.`); }
  const found = names.map((f) => {
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { throw new ShotError(`${f} in ${dir} is not a picture's record (JSON).`); }
    const what = String(r?.what ?? '').replace(/\s+/g, ' ').trim();
    const at = Date.parse(r?.at);
    if (typeof r?.file !== 'string' || !r.file || /[\\/]/.test(r.file) || r.file.startsWith('.') || !what || what.length > 200 || !Number.isFinite(at)) {
      throw new ShotError(`${f} in ${dir} needs file (a picture in that folder), what (at most 200 characters) and at (a time).`);
    }
    return { file: path.join(dir, r.file), what, at, ...(typeof r.test === 'string' && r.test ? { test: r.test } : {}) };
  });
  if (!found.length) throw new ShotError(`no pictures in ${dir}: ${DIR_HINT}.`);
  return found.sort((a, b) => a.at - b.at);
}

const kb = (n) => `${Math.max(1, Math.round(n / 1024))} KB`;
const line = (s) => `${when(s.at)}  ${s.ticket ? `#${s.ticket}` : 'no ticket'}  ${s.what}  (shots/${s.file}, ${s.width}×${s.height})`;

export function shot(o, { folder, cwd, out }) {
  const ticketOpt = o.ticket;
  if (ticketOpt === true || (ticketOpt !== undefined && !/^#?\d+$/.test(String(ticketOpt)))) throw new ShotError(`--ticket takes a ticket number. ${USAGE}`);
  if (o.playwright === true) throw new ShotError(`--playwright takes the report's path. ${USAGE}`);
  if (o.dir === true) throw new ShotError(`--dir takes the folder with the pictures. ${USAGE}`);
  if (o.playwright !== undefined && o.dir !== undefined) throw new ShotError(`--playwright or --dir, not both. ${USAGE}`);
  const branchOut = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchOut.ok && branchOut.out !== 'HEAD' ? branchOut.out : null;
  const commitOut = git(cwd, ['rev-parse', 'HEAD']);
  const where = { branch, commit: commitOut.ok ? commitOut.out : null, ticket: ticketOpt !== undefined ? Number(String(ticketOpt).replace('#', '')) : ticketOfBranch(branch) };
  const said = (r) => `${r.existed ? 'already recorded' : 'recorded'}: ${line(r)}${r.existed ? '' : `, ${kb(r.size)}`}`;
  if (typeof o.playwright === 'string' || typeof o.dir === 'string') {
    if (o._.length) throw new ShotError(`--${o.dir ? 'dir' : 'playwright'} records the run's pictures; give no image with it. ${USAGE}`);
    const tests = o.dir ? fromDir(path.resolve(cwd, o.dir)) : fromPlaywright(path.resolve(cwd, o.playwright));
    let added = 0;
    for (const t of tests) {
      const { buf, info } = prepare(t.file);
      const r = record({ buf, info, at: t.at, what: t.what, test: t.test, ...where }, folder);
      if (!r.existed) added++;
      out(said({ ...r, size: buf.length }));
    }
    out(added ? `${added} new of ${tests.length}; forge save shares them` : `nothing new: all ${tests.length} were recorded before`);
    return 0;
  }
  if (!o._.length) {
    const all = readShots(folder);
    out(all.length ? all.map(line).join('\n') : `no screenshots yet. ${USAGE}`);
    return 0;
  }
  const [image, what, ...more] = o._;
  const text = String(what ?? '').replace(/\s+/g, ' ').trim();
  if (!text || more.length) throw new ShotError(`say what the picture shows, in quotes. ${USAGE}`);
  if (text.length > 200) throw new ShotError('what the picture shows: at most 200 characters.');
  const file = path.resolve(cwd, image);
  const { buf, info } = prepare(file);
  const r = record({ buf, info, at: fs.statSync(file).mtimeMs, what: text, ...where }, folder);
  out(`${said({ ...r, size: buf.length })}${r.existed ? '' : '; forge save shares it'}`);
  return 0;
}
