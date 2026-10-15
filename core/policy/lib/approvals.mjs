// Human approvals recorded per branch. A record is written only after a person approved
// an "ask" in a mode where asks reach a person; agents cannot write the state folder.
import { readState, writeState } from './context.mjs';

const FILE = 'approvals.json';

export function isApproved(ctx, gate, branch = ctx.branch()) {
  if (!branch) return false;
  const all = readState(ctx, FILE, {});
  return (all[branch]?.gates || []).includes(gate);
}

export function recordApproval(ctx, gate, branch, detail = {}) {
  if (!branch) return;
  const all = readState(ctx, FILE, {});
  const entry = all[branch] || { gates: [], history: [] };
  if (!entry.gates.includes(gate)) entry.gates.push(gate);
  entry.history.push({ gate, at: new Date().toISOString(), ...detail });
  all[branch] = entry;
  writeState(ctx, FILE, all);
}
