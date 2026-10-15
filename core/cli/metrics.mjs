// forge metrics <ticket> [--branch <b>] [--record]: the tokens a ticket used (decision 84), from Claude Code's
// local session logs (~/.claude/projects/<the checkout's path>/), by model and by agent.
// - A lane (a subagent log) belongs to the ticket the lead's description of it names ("QA ticket #2",
//   subagents/<id>.meta.json); a description naming no ticket falls back to the branch most of its messages
//   ran on (gitBranch). The description comes first: a new worktree starts on the lead's current branch, so
//   a lane's first messages can carry another ticket's branch, and reviewers read a detached checkout.
// - The lead's share is its own messages while the ticket's agents ran (from the first one's start to the
//   last one's end), so tickets that run one after the other do not share tokens.
// Each reply is counted once, from its line with the stop reason (the logs write a reply as it streams).
// --record writes the total into the ticket's row of metrics.md in the team repo ("AI cost" column).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class MetricsError extends Error {}

const slug = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const empty = () => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
const add = (a, u) => { a.input += u.input_tokens || 0; a.cacheWrite += u.cache_creation_input_tokens || 0; a.cacheRead += u.cache_read_input_tokens || 0; a.output += u.output_tokens || 0; return a; };
const total = (a) => a.input + a.cacheWrite + a.cacheRead + a.output;
export const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const family = (model) => /opus/.test(model) ? 'opus' : /sonnet/.test(model) ? 'sonnet' : /haiku/.test(model) ? 'haiku' : /fable/.test(model) ? 'fable' : model;

// Usage per model of the replies in `entries` (optionally only those `keep` accepts), each reply once, from
// its line with the stop reason: a streamed reply's earlier lines have a partial output count.
function usage(entries, keep = () => true) {
  const replies = new Map();
  for (const e of entries) {
    const m = e.message;
    if (!m || typeof m !== 'object' || !m.usage || !keep(e)) continue;
    const id = m.id || e.requestId || e.uuid;
    const r = replies.get(id);
    if (!r || (m.stop_reason && !r.stop)) replies.set(id, { model: m.model, usage: m.usage, stop: Boolean(m.stop_reason) });
  }
  const byModel = {};
  for (const r of replies.values()) add(byModel[r.model || 'unknown'] ??= empty(), r.usage);
  return byModel;
}

export function ticketTokens({ ticket, branch, checkoutDirs, projectsDir }) {
  const want = String(ticket).replace(/^#/, '');
  const named = (text) => [...String(text).matchAll(/(?:#|\bticket\s+#?)(\d+)\b/gi)].map((m) => m[1]);
  const dirs = [...new Set(checkoutDirs.map((d) => path.join(projectsDir, slug(d))))].filter((d) => fs.existsSync(d));
  const agents = [];
  const lead = {};
  for (const dir of dirs) {
    for (const session of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
      const sub = path.join(dir, session.slice(0, -6), 'subagents');
      const mine = [];
      for (const f of fs.existsSync(sub) ? fs.readdirSync(sub).filter((n) => n.endsWith('.jsonl')) : []) {
        const entries = readLines(path.join(sub, f));
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(path.join(sub, f.replace(/\.jsonl$/, '.meta.json')), 'utf8')); } catch { /* none */ }
        const refs = named(meta.description || '');
        const counts = {};
        for (const e of entries) if (e.gitBranch) counts[e.gitBranch] = (counts[e.gitBranch] || 0) + 1;
        const mostly = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0];
        if (refs.length ? !refs.includes(want) : !(branch && mostly === branch)) continue;
        const times = entries.map((e) => Date.parse(e.timestamp)).filter(Number.isFinite);
        const a = { agent: meta.agentType || f.replace(/\.jsonl$/, ''), description: meta.description || '', byModel: usage(entries), start: Math.min(...times), end: Math.max(...times) };
        agents.push(a);
        mine.push(a);
      }
      if (!mine.length) continue;
      const from = Math.min(...mine.map((a) => a.start));
      const to = Math.max(...mine.map((a) => a.end));
      const leadUse = usage(readLines(path.join(dir, session)), (e) => { const t = Date.parse(e.timestamp); return t >= from && t <= to; });
      for (const [model, u] of Object.entries(leadUse)) { const t = lead[model] ??= empty(); for (const k of Object.keys(u)) t[k] += u[k]; }
    }
  }
  const byModel = {};
  for (const src of [lead, ...agents.map((a) => a.byModel)]) {
    for (const [model, u] of Object.entries(src)) { const t = byModel[model] ??= empty(); for (const k of Object.keys(u)) t[k] += u[k]; }
  }
  const all = Object.values(byModel).reduce((s, u) => s + total(u), 0);
  const families = {};
  for (const [model, u] of Object.entries(byModel)) families[family(model)] = (families[family(model)] || 0) + total(u);
  const cell = all ? `${fmt(all)} tokens (${Object.entries(families).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${fmt(n)}`).join(', ')})` : '';
  return { agents, lead, byModel, total: all, cell, dirs };
}

export function report(r, ticket, branch) {
  if (!r.agents.length) return `#${ticket}${branch ? ` (${branch})` : ''}: no agent work found in ${r.dirs.length ? r.dirs.join(', ') : 'the session logs'}`;
  const rows = Object.entries(r.byModel).map(([m, u]) => `  ${m.padEnd(22)} ${fmt(u.input + u.cacheWrite).padStart(8)} ${fmt(u.cacheRead).padStart(9)} ${fmt(u.output).padStart(8)} ${fmt(total(u)).padStart(8)}`);
  const per = r.agents.map((a) => `  ${a.agent.padEnd(22)} ${fmt(Object.values(a.byModel).reduce((s, u) => s + total(u), 0)).padStart(8)}  ${a.description}`);
  const leadTotal = Object.values(r.lead).reduce((s, u) => s + total(u), 0);
  return [
    `#${ticket}${branch ? ` (${branch})` : ''}: ${r.agents.length} agent(s) and the lead`,
    `  ${'model'.padEnd(22)} ${'input'.padStart(8)} ${'cache read'.padStart(9)} ${'output'.padStart(8)} ${'total'.padStart(8)}`,
    ...rows,
    'by agent:',
    ...per,
    `  ${'lead (while they ran)'.padEnd(22)} ${fmt(leadTotal).padStart(8)}`,
    `AI cost: ${r.cell}`,
  ].join('\n');
}

// The ticket's row in metrics.md (| Ticket | Estimate | Actual | Bugs after release | Rework | AI cost |):
// its AI cost cell is set, the other cells kept; a missing row is added with them empty.
export function recordRow(file, ticket, cell) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const lines = text.split('\n');
  const header = lines.findIndex((l) => /^\|\s*Ticket\s*\|/i.test(l));
  if (header < 0) throw new MetricsError(`${file} has no metrics table (| Ticket | Estimate | Actual | Bugs after release | Rework | AI cost |)`);
  const cols = lines[header].split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
  const at = cols.indexOf('ai cost');
  if (at < 0) throw new MetricsError(`${file}: the metrics table has no "AI cost" column`);
  const id = `#${String(ticket).replace(/^#/, '')}`;
  const row = lines.findIndex((l, i) => i > header + 1 && l.startsWith('|') && l.split('|')[1]?.trim() === id);
  if (row >= 0) {
    const cells = lines[row].split('|').slice(1, -1).map((c) => c.trim());
    cells[at] = cell;
    lines[row] = `| ${cells.join(' | ')} |`;
  } else {
    let end = header + 2;
    while (end < lines.length && lines[end].startsWith('|')) end++;
    const cells = cols.map((c, i) => (i === 0 ? id : i === at ? cell : ''));
    lines.splice(end, 0, `| ${cells.join(' | ')} |`);
  }
  fs.writeFileSync(file, lines.join('\n'));
}

export function metrics({ ticket, branch, record }, { main, env, out, branchOf }) {
  if (!ticket || !/^#?[\w.-]+$/.test(String(ticket))) throw new MetricsError('forge metrics <ticket> [--branch <name>] [--record]');
  const t = String(ticket).replace(/^#/, '');
  const b = branch || branchOf(t);
  const projectsDir = env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
  let real = main;
  try { real = fs.realpathSync(main); } catch { /* keep */ }
  const r = ticketTokens({ ticket: t, branch: b, checkoutDirs: [main, real], projectsDir });
  out(report(r, t, b));
  if (record && r.total) {
    const file = path.join(main, '.forge', 'project', 'metrics.md');
    recordRow(file, t, r.cell);
    out(`recorded in .forge/project/metrics.md (forge save to share it)`);
  }
  return r;
}
