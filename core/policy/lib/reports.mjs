// Review and QA reports (.forge/project/reviews/<ticket>/<name>.md): their "Verdict:" and "Commit:" lines.
// forge merge and the done check read them the same way.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './context.mjs';

export const PASSING = new Set(['APPROVE', 'APPROVED', 'PASS', 'PASSED']);
// A verdict a review round counts as passed (APPROVE WITH NOTES included).
export const passing = (v) => /^(APPROVE|PASS)/.test(v || '');

// "Verdict: APPROVE" and "Commit: <sha>" lines, with or without Markdown emphasis.
export function readReport(text) {
  const verdict = /^\W*verdict\W*:?\W*([A-Za-z][A-Za-z ]*?)\W*$/mi.exec(text)?.[1]?.toUpperCase().trim() ?? null;
  const commit = /^\W*commit\W*:?\W*([0-9a-f]{7,40})\b/mi.exec(text)?.[1] ?? null;
  return { verdict, commit };
}

// Every report of a ticket as { name, verdict, commit }; [] when it has none.
export function ticketReports(mainRoot, ticket) {
  const dir = path.join(mainRoot, '.forge', 'project', 'reviews', String(ticket));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => ({ name: f.slice(0, -3), ...readReport(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

// Review rounds from the team repo's history of reviews/<id>/ (rel: that folder, from the team repo's root): a
// reviewer's report saved again, or saved as a round file of its own (code-r2.md), starts a new round. A round with
// a verdict that is not APPROVE or PASS had a blocker. disk: the reports as they are now count as one more save,
// so a round written but not yet saved counts (the per-ticket limits, decision 127).
export function reviewRounds(teamRoot, rel, { disk = false } = {}) {
  const log = git(teamRoot, ['log', '--reverse', '--format=%H%x09%cI', '--', `${rel}/`]);
  const rows = log.ok && log.out ? log.out.split('\n') : [];
  const rounds = [];
  const last = new Map();
  let round = null;
  const see = (file, text, at) => {
    const file0 = path.basename(file, '.md');
    const name = file0.replace(/-r\d+[a-z]*$/, '');
    const r = readReport(text);
    if (!r.verdict) return;
    const key = `${r.verdict}@${r.commit}`;
    if (last.get(file0) === key) return;
    last.set(file0, key);
    if (!round || round.reports[name]) { round = { at, reports: {} }; rounds.push(round); }
    round.reports[name] = r.verdict;
  };
  for (const row of rows) {
    const [sha, at] = row.split('\t');
    const ls = git(teamRoot, ['ls-tree', '--name-only', sha, `${rel}/`]);
    for (const file of ls.ok ? ls.out.split('\n').filter((f) => f.endsWith('.md')) : []) see(file, git(teamRoot, ['show', `${sha}:${file}`]).out, Date.parse(at));
  }
  const dir = path.join(teamRoot, rel);
  if (disk && fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) see(f, fs.readFileSync(path.join(dir, f), 'utf8'), Date.now());
  }
  return rounds.map((r) => ({ ...r, blocker: Object.values(r.reports).some((v) => !passing(v)) }));
}
