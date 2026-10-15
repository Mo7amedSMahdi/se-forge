// forge limits (decision 127): each open ticket's use of its limits, and a person's lift.
//   forge limits                 the open tickets with what they used of their engineer lanes, review rounds with
//                                blockers and QA fails; a parked one says so
//   forge limits lift <ticket>   one more allowance of each for that ticket (a person's decision; the hook refuses it
//                                from Claude)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ticketUsage, ticketLimits, reached, teamPaths, LANE_TYPES } from '../policy/lib/limits.mjs';
import { readMerges } from './dashboard/data.mjs';

export class LimitsError extends Error {}

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

// The tickets with a lane or a review so far.
function ticketsSeen(stateDir, folder) {
  const nums = new Set();
  const spawns = path.join(stateDir, 'spawns');
  for (const f of fs.existsSync(spawns) ? fs.readdirSync(spawns).filter((x) => x.endsWith('.json')) : []) {
    const s = readJson(path.join(spawns, f));
    if (s?.ticket && LANE_TYPES.includes(String(s.type ?? '').replace(/^.*:/, ''))) nums.add(s.ticket.slice(1));
  }
  const reviews = path.join(folder, 'reviews');
  for (const d of fs.existsSync(reviews) ? fs.readdirSync(reviews) : []) if (/^\d+$/.test(d)) nums.add(d);
  return [...nums].sort((a, b) => Number(a) - Number(b));
}

export function limits(o, { main, folder, config, out }) {
  const stateDir = path.join(main, '.forge', 'state');
  const base = config.limits;
  if (o._[0] === 'lift') {
    const num = String(o._[1] ?? '').replace(/^#/, '');
    if (!/^\d+$/.test(num)) throw new LimitsError('forge limits lift <ticket>');
    const file = path.join(stateDir, 'limits.json');
    const all = readJson(file) ?? {};
    all[num] = { lifts: (all[num]?.lifts ?? 0) + 1, at: new Date().toISOString(), by: os.userInfo().username };
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`);
    const lim = ticketLimits(base, stateDir, num);
    out(`#${num} has one more allowance: now ${lim.lanes} engineer lanes, ${lim.blockerRounds} review rounds with blockers, ${lim.qaFails} QA fails. Tell the lead to take it again (it is Blocked on the board).`);
    return 0;
  }
  if (o._.length) throw new LimitsError('forge limits [lift <ticket>]');
  const merged = readMerges(main, config.branches.base);
  const team = teamPaths(folder);
  out(`Limits per ticket (policy.limits): ${base.lanes} engineer lanes, ${base.blockerRounds} review rounds with blockers, ${base.qaFails} QA fails. Past one, the next engineer lane is refused and the ticket is parked until a person lifts it: forge limits lift <ticket>.`);
  const seen = ticketsSeen(stateDir, folder);
  const open = seen.filter((n) => !merged.has(Number(n)));
  for (const num of open) {
    const used = ticketUsage({ stateDir, ...team }, num);
    const lim = ticketLimits(base, stateDir, num);
    const over = reached(used, lim);
    out(`#${num}: lanes ${used.lanes} of ${lim.lanes} · rounds with blockers ${used.blockerRounds} of ${lim.blockerRounds} · QA fails ${used.qaFails} of ${lim.qaFails}${lim.lifts ? ` (lifted ${lim.lifts}×)` : ''}${over.length ? ` · at its limit: no more engineer lanes until a person lifts it (forge limits lift ${num})` : ''}`);
  }
  if (!open.length) out('No open ticket has used any yet.');
  if (seen.length > open.length) out(`${seen.length - open.length} merged ticket(s) not shown.`);
  return 0;
}
