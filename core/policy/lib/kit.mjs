// The kit itself: where it is installed, its version, and the text it injects into sessions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function readKitFile(rel) {
  try {
    return fs.readFileSync(path.join(KIT_ROOT, rel), 'utf8');
  } catch {
    return '';
  }
}

export const kitVersion = () => readKitFile('VERSION').trim() || '0.0.0';

// a < b for dotted versions; a pre-release suffix sorts before its release.
export function versionLess(a, b) {
  const parse = (v) => {
    const [main, pre] = String(v).split('-');
    return { n: main.split('.').map((x) => Number(x) || 0), pre: pre ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.n[i] ?? 0) !== (y.n[i] ?? 0)) return (x.n[i] ?? 0) < (y.n[i] ?? 0);
  return x.pre !== null && y.pre === null;
}

// The project's facts as a short block the agents can rely on instead of guessing.
export function projectFacts(ctx) {
  const p = ctx.project;
  const c = ctx.config;
  const stack = Object.entries(p.stack).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'not decided yet';
  const lines = [
    `Project facts (from ${c.kit.configPath}; kit se-forge ${kitVersion()}):`,
    `- Project ${p.name || '(unnamed)'}${p.client ? ` for ${p.client}` : ''}; Git host ${p.host}; tracker ${p.tracker}; default mode ${p.mode}.`,
    `- Branches: tickets start from ${c.branches.base} on feat|fix|chore/<ticket>-<slug> and merge back into it (\`forge merge\`, the lead only); ${c.branches.promote.join(' then ')} receive promotions a person merges. Never push to ${[c.branches.base, ...c.branches.promote].join(', ')}.`,
    `- Gate command: ${c.gates.full ? `\`${c.gates.full}\`; run it as \`forge gates\`, which checks the pushed commit and records the result` : 'NOT SET: no work can be marked done until a human sets policy.gates.full'}.`,
    `- Stack: ${stack}.`,
  ];
  if (p.storiesPath) lines.push(`- User stories: ${p.storiesPath} (read only the story a ticket cites).`);
  if (p.figma.fileKey) lines.push(`- Figma: file ${p.figma.fileKey}, root node ${p.figma.rootNode}; Figma tools are named ${p.figma.toolPrefix}*.`);
  if (p.design.source) lines.push(`- Design: ${p.design.source === 'kit' ? 'designed in Figma by the designer agent' : `provided by the client as ${p.design.source}, built in its exact style`}; tokens and the story-to-screen map in .forge/project/bootstrap/ (design-system.md, design-map.md).`);
  if (p.api.spec) lines.push(`- API contract: ${p.api.contractRepo ? `${p.api.spec} in ${p.api.contractRepo}` : `${p.api.spec} in this repo`}; approved versions are api-v<semver> tags${p.api.pin ? `; this project builds on ${p.api.pin}` : ''}. Contract changes: skill api-contract-design; checks: \`forge api check\`.`);
  if (p.api.generate) lines.push(`- API client: \`forge api generate\` regenerates ${p.api.generatedDir || c.paths.generated.join(', ') || 'the generated client'} from the pinned contract; never hand-edit it.`);
  if (p.db.image || p.db.migrate) lines.push(`- Database: local containers from ${p.db.image || '(image not set)'}; migrate \`${p.db.migrate || 'not set'}\`, roll back \`${p.db.rollback || 'not set'}\` (connection in $${p.db.urlEnv}).`);
  lines.push('- Specs: .forge/project/specs/ · plans: .forge/project/plans/ · contract drafts: .forge/project/contracts/ · reviews and QA reports: .forge/project/reviews/<ticket>/ · handovers: .forge/handoffs/ (all outside the client repo).');
  lines.push(`- Commits ${p.coAuthor ? 'end with' : 'do NOT carry'} a Co-Authored-By line for the model.`);
  return lines.join('\n');
}
