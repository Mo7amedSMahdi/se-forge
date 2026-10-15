// Tracker writes the policy cares about, whether through `forge tracker …`, the tracker script, or gh/glab:
// a done status needs green gates (on the ticket's own branch when the lead moves it from the base branch,
// decision 116), and the ai::ready label (the leader's queue) is set only by the leader
// (the person's session) or the project-manager agent (decision 47).
import { deny } from '../decision.mjs';

const READY = /(^|[,\s])ai::?ready($|[,\s])/;
const base = (w) => String(w ?? '').split('/').pop();

// The tracker script's arguments, from `forge tracker <args>` or `[bash] …/tracker.sh <args>`.
function trackerArgs(c) {
  const [a0, ...rest] = c.argv;
  if (base(a0) === 'forge' && rest[0] === 'tracker') return rest.slice(1);
  if (/tracker\.sh$/.test(a0 ?? '')) return rest;
  return null;
}

export function checkTracker(c, a0, ctx) {
  const out = [];
  const t = trackerArgs(c);
  if (t && t[0] === 'status' && ctx.config.gates.doneStatuses.some((s) => s.toLowerCase() === String(t[2] ?? '').toLowerCase())) {
    const ticket = /^#?(\d+)$/.exec(String(t[1] ?? ''))?.[1] ?? null;
    out.push({ decision: 'done', rule: 'gates:done', reason: `Moving the ticket to "${t[2]}" means the work is done.`, branch: null, ticket });
  }
  // The same claim straight through the host's CLI: `glab issue close 12`, or a done status label on an issue.
  const issue = (a0 === 'gh' || a0 === 'glab') && c.argv[1] === 'issue' ? c.argv[2] : null;
  if (issue) {
    const isDone = (name) => ctx.config.gates.doneStatuses.some((s) => s.toLowerCase() === name.toLowerCase());
    const status = c.argv.flatMap((x) => String(x).split(',')).map((x) => /^status::?(.+)$/.exec(x.trim())?.[1]).find((x) => x && isDone(x));
    if (issue === 'close' || (['update', 'edit'].includes(issue) && status)) {
      const ticket = /^#?(\d+)$/.exec(String(c.argv[3] ?? ''))?.[1] ?? null;
      out.push({ decision: 'done', rule: 'gates:done', reason: issue === 'close' ? 'Closing the issue means the work is done.' : `Moving the issue to "${status}" means the work is done.`, branch: null, ticket });
    }
  }
  const marksReady = (t && (t[0] === 'ready' || (t[0] === 'create' && t.includes('--ready'))))
    || ((a0 === 'gh' || a0 === 'glab') && c.argv.some((x) => READY.test(x)));
  if (marksReady && ctx.agentId && ctx.agentType !== 'project-manager') {
    out.push(deny('tracker:ready', 'Only the project-manager (for a bug that breaks an approved acceptance criterion or contract) or a person marks an issue ai::ready. File the issue without it; the project-manager triages it.'));
  }
  return out;
}
