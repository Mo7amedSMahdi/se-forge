// Lanes in their own worktree cannot write the main checkout: Claude Code refuses it. So they write the
// kit's documents at the same path inside their worktree, and these are copied to the main checkout when
// the lane stops (decision 92). What a lane may hand over depends on its role:
//   every lane: its handover (.forge/handoffs/);
//   read-only roles (reviewers) and the QA engineer: their reports (.forge/project/reviews/), and the requirements
//   panel's (.forge/project/bootstrap/panel/, decision 114), which the docs-only seats hand over with their documents;
//   docs-only roles (the architect): .forge/project/, except the reports, the project settings and the kit
//   overrides, which a person approves.
// A file is copied only when the main checkout has no newer copy of it.
import fs from 'node:fs';
import path from 'node:path';
import { restrictedAccess } from './roles.mjs';

const REPORTERS = new Set(['qa-engineer']);
const KEPT = (rel) => rel === '.forge/project/project.json' || rel.startsWith('.forge/project/kit/');
const REPORT = (rel) => rel.startsWith('.forge/project/reviews/');

function files(root, tree) {
  const out = [];
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.isFile()) out.push(child);
    }
  };
  walk(tree);
  return out;
}

export function laneDocuments(ctx) {
  if (!ctx.agentId || ctx.root === ctx.mainRoot) return [];
  const access = restrictedAccess(ctx);
  const reporter = access === 'read-only' || REPORTERS.has(ctx.agentType);
  const trees = ['.forge/handoffs'];
  if (reporter) trees.push('.forge/project/reviews', '.forge/project/bootstrap/panel');
  if (access === 'docs') trees.push('.forge/project');
  const copied = [];
  for (const rel of new Set(trees.flatMap((t) => files(ctx.root, t)))) {
    if (KEPT(rel) || (REPORT(rel) && !reporter)) continue;
    const from = path.join(ctx.root, rel);
    const to = path.join(ctx.mainRoot, rel);
    try { if (fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) continue; } catch { /* not in the main checkout yet */ }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied.push(rel);
  }
  return copied;
}
