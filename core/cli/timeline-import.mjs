// forge timeline import (decision 98): the timeline before the hooks wrote one, rebuilt from Claude Code's
// session logs for this checkout (~/.claude/projects/<checkout>/<session>.jsonl, each agent's log under
// <session>/subagents/ with its role and description in agent-<id>.meta.json) and the recorded gate results.
// - Writes .forge/state/timeline-import.jsonl (replaced on every run), for the time before the first line the
//   hooks wrote, so nothing is counted twice; after it, only the tokens of replies no hook line names (the
//   hooks wrote tokens from 0.2.7, the timeline from 0.2.6).
// - Every line has source: "import". A call's ms runs from the call to its result, so it includes any
//   permission prompt (the logs do not split them); gate runs have no duration.
// - Same privacy as the hooks: no prompt text, contents or output; commands cut and secrets masked.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clip, ticketIn, usageFields, describe } from '../policy/lib/timeline.mjs';
import { readTimeline } from './timeline.mjs';

const T = (s) => Date.parse(s);
const slug = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const ticketOfBranch = (b) => { const m = /^[\w-]+\/(\d+)(?:-|$)/.exec(b || ''); return m ? `#${m[1]}` : undefined; };
const textOf = (c) => (Array.isArray(c) ? c.map((x) => x.text || '').join(' ') : String(c ?? ''));
// A lane's paths without its worktree folder, as the hooks write them.
const short = (s) => s?.replace(/(^|\s)\.claude\/worktrees\/[^/\s]+\//g, '$1');

// Why a call was refused, from its error text: the kit's [rule], Claude Code's worktree isolation, auto mode
// or a person saying no. Anything else is a failure, not a refusal.
export function refusalRule(text) {
  const m = /^(?:PreToolUse:\w+ hook error: )?\[([\w-]+:[\w-]+)\]/.exec(text);
  if (m) return m[1];
  if (/^(?:<tool_use_error>)?This agent is isolated in the worktree/.test(text)) return 'claude:worktree';
  if (/^Permission for this action was denied/.test(text)) return 'permission';
  if (/^The user doesn't want to proceed/.test(text)) return 'permission';
  return null;
}

// One session log (the lead's or an agent's) as timeline lines.
function sessionLines(entries, base, ctx) {
  const out = [];
  const line = (at, event, fields) => out.push({ at, event, ...base.line, ...fields });
  const ticketAt = (e) => base.ticket ?? ticketOfBranch(e.gitBranch);
  const results = new Map();
  for (const e of entries) {
    if (e.type !== 'user' || !Array.isArray(e.message?.content)) continue;
    for (const c of e.message.content) if (c.type === 'tool_result') results.set(c.tool_use_id, { at: e.timestamp, error: Boolean(c.is_error), text: textOf(c.content), result: e.toolUseResult });
  }
  // Each reply once: its model and tokens on its first tool call, else on a reply line of its own.
  const replies = new Map();
  for (const e of entries) {
    const m = e.message;
    if (e.type !== 'assistant' || !m?.id || m.model === '<synthetic>') continue;
    const r = replies.get(m.id) ?? { at: e.timestamp, model: m.model, usage: m.usage, stop: null, tools: [], branch: e.gitBranch, entry: e };
    for (const c of m.content || []) if (c.type === 'tool_use') r.tools.push({ id: c.id, name: c.name, input: c.input, at: e.timestamp });
    // The line with the stop reason has the final output count; earlier lines of a streamed reply do not.
    if (m.stop_reason || !r.stop) r.usage = m.usage;
    r.stop = m.stop_reason ?? r.stop;
    replies.set(m.id, r);
  }
  for (const [id, r] of replies) {
    const tokens = { model: r.model, reply: id, ...usageFields({ usage: r.usage }) };
    const ticket = ticketAt(r.entry);
    if (!r.tools.length) {
      line(r.at, base.lead && r.stop === 'end_turn' ? 'turn.end' : 'reply', { ticket, branch: r.branch, ...tokens });
      continue;
    }
    r.tools.forEach((t, i) => {
      const what = short(clip(describe({ tool_name: t.name, tool_input: t.input }, ctx), 120));
      const res = results.get(t.id);
      const rule = res?.error ? refusalRule(res.text) : null;
      const common = { id: t.id, tool: t.name, what, ticket, branch: r.branch, ...(i === 0 ? tokens : { model: r.model, reply: id }) };
      if (rule) { line(t.at, 'tool.refused', { ...common, rule, why: clip(res.text) }); return; }
      line(t.at, 'tool.start', common);
      if (!res) return;
      const end = { id: t.id, tool: t.name, what, ticket, branch: r.branch, ms: Math.max(0, T(res.at) - T(t.at)) };
      if (res.error || res.result?.interrupted) line(res.at, 'tool.fail', { ...end, why: clip(res.text), interrupted: res.result?.interrupted ? true : undefined });
      else line(res.at, 'tool.done', { ...end, spawned: res.result?.agentId, agentModel: res.result?.resolvedModel });
    });
  }
  for (const e of entries) {
    if (e.isApiErrorMessage) line(e.timestamp, 'turn.fail', { ticket: ticketAt(e), why: clip(textOf(e.message?.content).replace(/^API Error: /, '')) });
    if (e.type === 'system' && /compact/.test(e.subtype || '')) line(e.timestamp, 'compact.start', { ticket: ticketAt(e), trigger: e.compactMetadata?.trigger });
    if (!base.lead || e.type !== 'user' || typeof e.message?.content !== 'string' || e.isMeta) continue;
    const text = e.message.content.trim();
    if (/^<task-notification>/.test(text)) line(e.timestamp, 'agent.notify', { ticket: ticketAt(e) });
    else if (/^<(local-command|bash-)/.test(text)) continue;
    else line(e.timestamp, 'prompt', { who: 'human', ticket: ticketAt(e), what: /^<command-name>(\/[\w:-]+)/.exec(text)?.[1] ?? /^\/[\w:-]+/.exec(text)?.[0], chars: text.length });
  }
  return out;
}

// The checkout's session folders: its path and its real path, as Claude Code names them.
function sessionDirs(main, projectsDir) {
  const names = new Set([slug(main)]);
  try { names.add(slug(fs.realpathSync(main))); } catch { /* gone */ }
  return [...names].map((n) => path.join(projectsDir, n)).filter((d) => fs.existsSync(d));
}

export function importHistory({ main, stateDir, env = process.env }) {
  const projectsDir = env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
  const live = readTimeline(stateDir, { imported: false }).lines;
  const cutoff = live.length ? T(live[0].at) : Infinity;
  const ctx = { root: main, mainRoot: main, home: os.homedir() };
  const lines = [];
  let sessions = 0;
  let agents = 0;
  for (const dir of sessionDirs(main, projectsDir)) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
      const id = f.slice(0, -6);
      const entries = readLines(path.join(dir, f));
      if (!entries.some((e) => e.timestamp)) continue;
      sessions++;
      const session = id.slice(0, 8);
      const lead = { lead: true, line: { who: 'lead', session, source: 'import' } };
      const first = entries.find((e) => e.timestamp);
      lines.push({ at: first.timestamp, event: 'session.start', who: 'lead', session, source: 'import', ticket: ticketOfBranch(first.gitBranch), branch: first.gitBranch });
      lines.push(...sessionLines(entries, lead, ctx));
      const sub = path.join(dir, id, 'subagents');
      for (const a of fs.existsSync(sub) ? fs.readdirSync(sub).filter((n) => /^agent-.*\.jsonl$/.test(n)) : []) {
        const agent = a.slice(6, -6);
        const log = readLines(path.join(sub, a)).filter((e) => e.timestamp);
        if (!log.length) continue;
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(path.join(sub, a.replace(/\.jsonl$/, '.meta.json')), 'utf8')); } catch { /* none */ }
        const counts = {};
        for (const e of log) if (e.gitBranch) counts[e.gitBranch] = (counts[e.gitBranch] || 0) + 1;
        const ticket = ticketIn(meta.description) ?? ticketOfBranch(Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0]);
        const who = (meta.agentType || 'agent').replace(/^.*:/, '');
        const base = { lead: false, ticket, line: { who, agent, session, source: 'import' } };
        agents++;
        lines.push({ at: log[0].timestamp, event: 'agent.start', ...base.line, ticket, what: clip(meta.description, 120) });
        lines.push(...sessionLines(log, base, ctx));
        lines.push({ at: log.at(-1).timestamp, event: 'agent.stop', ...base.line, ticket });
      }
    }
  }
  // Gate results the policy recorded: pass or fail and when, without a duration.
  let gates = {};
  try { gates = JSON.parse(fs.readFileSync(path.join(stateDir, 'gates.json'), 'utf8')); } catch { /* none */ }
  for (const g of Object.values(gates)) {
    if (g?.at) lines.push({ at: g.at, event: g.ok ? 'gates.pass' : 'gates.fail', who: 'kit', source: 'import', ticket: ticketOfBranch(g.branch), branch: g.branch, what: clip(g.cmd, 120) });
  }
  // Replies whose tokens a hook recorded; any other reply's tokens come from the logs.
  const named = new Set(live.filter((e) => e.tokens).map((e) => e.reply).filter(Boolean));
  const tokensOnly = ({ at, who, agent, session, source, ticket, branch, model, reply, input, cacheWrite5m, cacheWrite1h, cacheRead, output, tokens }) => ({ at, event: 'reply', who, agent, session, source, ticket, branch, model, reply, input, cacheWrite5m, cacheWrite1h, cacheRead, output, tokens });
  const kept = [
    ...lines.filter((e) => T(e.at) < cutoff),
    ...lines.filter((e) => T(e.at) >= cutoff && e.tokens && !named.has(e.reply)).map(tokensOnly),
  ].sort((a, b) => T(a.at) - T(b.at));
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'timeline-import.jsonl'), kept.map((e) => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''));
  return { lines: kept.length, sessions, agents, replies: new Set(kept.filter((e) => e.tokens).map((e) => e.reply)).size, from: kept[0]?.at, to: kept.at(-1)?.at, cutoff: Number.isFinite(cutoff) ? new Date(cutoff).toISOString() : null };
}
