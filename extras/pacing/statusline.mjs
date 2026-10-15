#!/usr/bin/env node
// Claude Code status line for se-forge (pacing on): folder, model, context %, plan usage (5-hour and
// weekly, coloured by pacing level). Records the usage to <checkout>/.forge/state/usage.json, where the
// safety hooks read it. Installed by forge sync as: node "<checkout>/.forge/kit/extras/pacing/statusline.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THRESHOLDS, usageRecord, clock } from '../../core/policy/lib/pacing.mjs';

const STATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../state');
const COLOUR = { green: '\x1b[32m', amber: '\x1b[33m', red: '\x1b[31m' };

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* print what we can */ }
const rec = usageRecord(input.rate_limits);
// Only from an installed kit (<checkout>/.forge/kit/extras/pacing): never write next to a kit source tree.
if ((rec.five_hour || rec.seven_day) && path.basename(path.dirname(STATE)) === '.forge') {
  try {
    fs.mkdirSync(STATE, { recursive: true });
    const tmp = path.join(STATE, `usage.json.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(rec));
    fs.renameSync(tmp, path.join(STATE, 'usage.json'));
  } catch { /* the status line never fails */ }
}

const dir = input.workspace?.project_dir || input.cwd || process.cwd();
const out = [path.basename(dir), input.model?.display_name || '?'];
const ctx = input.context_window?.used_percentage;
if (Number.isFinite(Number(ctx)) && ctx !== null) out.push(`ctx ${Math.round(Number(ctx))}%`);
for (const [w, label] of [['five_hour', '5h'], ['seven_day', 'week']]) {
  const u = rec[w];
  if (!u) continue;
  const t = THRESHOLDS[w];
  const c = u.used >= t.red ? COLOUR.red : u.used >= t.amber ? COLOUR.amber : COLOUR.green;
  out.push(`${c}${label} ${u.used}%\x1b[0m (resets ${clock(u.resets_at, w === 'seven_day')})`);
}
process.stdout.write(`${out.join(' · ')}\n`);
