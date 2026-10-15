// The dashboard's Architecture tab (decision 124): the project's architecture and requirements documents, its
// standards, and its components as designed and as they run. Read only.
//   - the approved documents, from the app repo's base branch: docs/architecture/overview.md and nfr.md,
//     docs/architecture/evaluations/, docs/adr/ (the team repo's architecture/ holds the drafts; a draft that
//     differs from the approved copy is noted, and one never approved is shown as a draft);
//   - the requirements, from the team folder: bootstrap/inputs/ (the client's), user-stories.md,
//     authorization-matrix.md; with them, one SRS put together from every part;
//   - the API contract at its pinned tag (project.api.spec at project.api.pin), its operations listed;
//   - the standards: the project's stack, gates, tests, branches and paths, the kit's rules, and the register's
//     decisions where they override the kit (the ASVS level);
//   - the components as they run: the Compose file's services (forge app).
// Mermaid diagrams become pictures with mermaid-cli in Docker, all new ones in one run, kept in
// .forge/state/diagrams/ by their text, so a later build draws only what changed.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git } from '../../policy/lib/context.mjs';
import { MERMAID_IMAGE, mermaidBlocks } from '../docs.mjs';
import { findApp, appServices } from '../app.mjs';
import { frontMatter, demote } from './markdown.mjs';

const GUIDES = [[/react/i, 'stack-react'], [/nest/i, 'stack-nestjs'], [/\.net|dotnet|asp\.net/i, 'stack-dotnet'], [/fastapi/i, 'stack-fastapi'], [/flutter/i, 'stack-flutter'], [/mongo/i, 'db-mongodb'], [/postgres/i, 'db-postgresql'], [/mysql|mariadb/i, 'db-mysql'], [/sql ?server|mssql/i, 'db-sqlserver']];
const STACK_PARTS = [['frontend', 'Frontend'], ['mobile', 'Mobile'], ['backend', 'Backend'], ['database', 'Database'], ['cloud', 'Hosting'], ['other', 'Other']];
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

const read = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const titleOf = (text, fallback) => /^#\s+(.+)$/m.exec(frontMatter(text).body)?.[1].trim() ?? fallback;

// A file on the app repo's base branch (origin/<base> first), and the files in a folder there.
function atBase(main, base, rel) {
  for (const ref of [`origin/${base}`, base]) {
    const r = spawnSync('git', ['show', `${ref}:${rel}`], { cwd: main, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (r.status === 0) return { text: r.stdout, ref };
  }
  return null;
}
function listAtBase(main, base, dir) {
  for (const ref of [`origin/${base}`, base]) {
    const r = git(main, ['ls-tree', '--name-only', `${ref}:${dir}`]);
    if (r.ok) return r.out.split('\n').filter(Boolean);
  }
  return [];
}

// One document: the approved copy on the base branch, else the team repo's draft. A draft changed after the
// approved copy was committed is a newer one (approving it changes its status line, so a different text alone is not).
function doc(main, base, folder, approvedPath, draftPath, id) {
  const approved = atBase(main, base, approvedPath);
  const draft = draftPath ? read(path.join(folder, draftPath)) : null;
  if (!approved && !draft) return null;
  const text = approved?.text ?? draft;
  let newer = null;
  if (approved && draft && draft.trim() !== approved.text.trim()) {
    const approvedAt = Number(git(main, ['log', '-1', '--format=%ct', approved.ref, '--', approvedPath]).out || 0) * 1000;
    const committed = Number(git(folder, ['log', '-1', '--format=%ct', '--', draftPath]).out || 0) * 1000;
    const dirty = git(folder, ['status', '--porcelain', '--', draftPath]).out;
    const draftAt = dirty || !committed ? fs.statSync(path.join(folder, draftPath)).mtimeMs : committed;
    if (draftAt > approvedAt) newer = draftPath;
  }
  return {
    id, title: titleOf(text, path.basename(approvedPath)), text, file: path.basename(approvedPath),
    source: approved ? `${approvedPath} on ${approved.ref}` : `the team repo's ${draftPath} (a draft, not yet approved)`,
    draft: !approved,
    newerDraft: newer,
  };
}

// The contract's operations, from its indentation (the kit's contracts are block-style YAML).
export function operations(yaml) {
  const out = [];
  let inPaths = false;
  let p = null;
  let op = null;
  let inResponses = false;
  for (const line of String(yaml).split('\n')) {
    if (/^\S/.test(line)) { inPaths = /^paths:\s*$/.test(line); continue; }
    if (!inPaths) continue;
    let m;
    if ((m = /^ {2}(\/\S*):\s*$/.exec(line))) { p = m[1]; op = null; continue; }
    if ((m = /^ {4}(\w+):\s*$/.exec(line)) && METHODS.includes(m[1])) { op = { method: m[1].toUpperCase(), path: p, id: '', summary: '', responses: [] }; out.push(op); inResponses = false; continue; }
    if (!op) continue;
    if ((m = /^ {6}operationId:\s*(\S+)/.exec(line))) op.id = m[1];
    else if ((m = /^ {6}summary:\s*(.+)$/.exec(line))) op.summary = m[1].replace(/^["']|["']$/g, '');
    else if (/^ {6}responses:\s*$/.test(line)) inResponses = true;
    else if (/^ {6}\S/.test(line)) inResponses = false;
    else if (inResponses && (m = /^ {8}['"]?(\d{3}|default)['"]?:/.exec(line))) op.responses.push(m[1]);
  }
  return out;
}

// The ASVS level the register sets (the first decision naming one; a later one naming another level replaces it).
export function asvsLevel(register) {
  let found = null;
  for (const line of String(register ?? '').split('\n')) {
    const m = /^\|\s*(D-\d+)\s*\|.*?ASVS[^|]*?Level\s*\**\s*([1-3])/i.exec(line);
    if (m && (!found || found.level !== Number(m[2]))) found = { level: Number(m[2]), source: m[1] };
  }
  return found;
}

function standards({ project, config, base, folder, register, contract }) {
  const guided = ['frontend', 'mobile', 'backend', 'database'];
  const stack = STACK_PARTS.filter(([k]) => project.stack?.[k]).map(([k, label]) => ({ label, value: project.stack[k], guide: guided.includes(k) ? GUIDES.find(([re]) => re.test(project.stack[k]))?.[1] ?? null : null }));
  const asvs = asvsLevel(register);
  const rules = read(path.join(folder, 'kit', 'rules.md'));
  return {
    stack,
    api: project.api?.spec || project.api?.contractRepo ? { spec: project.api.spec, pin: project.api.pin, repo: project.api.contractRepo, openapi: /^openapi:\s*(\S+)/m.exec(contract ?? '')?.[1] ?? null } : null,
    asvs: asvs ? { ...asvs, why: `the register's ${asvs.source}` } : { level: 2, why: 'the kit\'s default (decision 31)' },
    sensitive: config.paths.sensitive || [],
    gate: config.gates.full || null,
    sides: config.tests.sides || [],
    e2e: config.tests.e2e?.tests?.length ? config.tests.e2e : null,
    base,
    promote: config.branches.promote,
    deps: config.deps?.approved?.length ?? 0,
    rules,
  };
}

// The standards as a document (the same words as the card), for its download.
export function standardsMarkdown(name, s) {
  const out = [`# Standards: ${name}`, '', 'What every change in this project follows: the project\'s own settings (`project.json`) and decisions, and the se-forge kit\'s rules. Put together by `forge dashboard` (decision 124).', ''];
  out.push('## Stack', '', ...s.stack.map((x) => `- **${x.label}:** ${x.value}${x.guide ? ` (kit guide: skill \`${x.guide}\`)` : ''}`), '');
  if (s.api) out.push('## API', '', `- OpenAPI ${s.api.openapi ?? '3.1'}; contract-first: the contract is approved and tagged before the code that serves or calls it changes (decisions 27-30).`, `- The contract: ${s.api.repo ? `in ${s.api.repo}, ` : ''}\`${s.api.spec}\`${s.api.pin ? `, pinned to \`${s.api.pin}\`` : ''}.`, '- The style: skill `api-contract-design` (its `style.md`); the contract\'s own description lists where this project deviates.', '');
  out.push('## Security', '', `- Reviews against **OWASP ASVS Level ${s.asvs.level}** (${s.asvs.why}); threat models use STRIDE (skill \`threat-model\`).`, '- A security reviewer reads every merge request.');
  if (s.sensitive.length) out.push(`- Changes to these paths need a person's approval first: ${s.sensitive.map((p) => `\`${p}\``).join(', ')}.`);
  out.push('', '## Quality gates', '');
  if (s.gate) out.push(`- The gate command, which must pass before a ticket is done:`, '', '```', s.gate, '```', '');
  for (const side of s.sides) out.push(`- ${side.name}: a change to ${side.code.map((c) => `\`${c}\``).join(', ')} needs a test in ${side.tests.map((t) => `\`${t}\``).join(', ')}.`);
  if (s.e2e) out.push(`- End-to-end tests (${s.e2e.tests.map((t) => `\`${t}\``).join(', ')}) when a plan names a user flow.`);
  out.push('- Every merge request is reviewed by separate agents: code, security and the API contract, and more when the plan calls for them (skill `review-pass`).', '');
  out.push('## Ways of working', '', `- A ticket's branch is \`feat|fix|chore/<ticket>-<slug>\` from \`${s.base}\`, merged back with \`forge merge\` once the gates and every review pass; ${s.promote.join(' then ')} are a person's merges.`, '- Commits follow Conventional Commits and name their ticket (skill `commit-pr`).');
  if (s.deps) out.push(`- New dependencies need a person's approval; ${s.deps} are approved for this project.`);
  if (s.rules) out.push('', '## The project\'s own rules', '', demote(s.rules, 2));
  return `${out.join('\n')}\n`;
}

// The SRS: every part, in the usual order, each naming its source.
export function srsMarkdown(name, a, now) {
  const part = (title, d) => (d ? [`## ${title}`, '', `Source: ${d.source}.`, '', demote(frontMatter(d.text).body, 2).trim(), ''] : [`## ${title}`, '', 'Not written for this project yet.', '']);
  const out = [`# Software requirements specification: ${name}`, '', `Put together by \`forge dashboard\` on ${new Date(now).toISOString().slice(0, 10)} from the project's own documents (decision 124); each part names its source. The documents stay the source of truth.`, ''];
  out.push('## 1. The client\'s requirements', '');
  for (const i of a.inputs) out.push(...(i.text ? [`### ${i.name}`, '', `Source: the team repo's bootstrap/inputs/${i.name}.`, '', demote(i.text, 3).trim(), ''] : [`- \`bootstrap/inputs/${i.name}\` (${i.kind}: open it from the team repo)`]));
  if (!a.inputs.length) out.push('Not in the team repo.', '');
  out.push(...part('2. Users and roles', a.roles), ...part('3. Functional requirements', a.stories));
  out.push('## 4. External interfaces', '');
  if (a.api?.operations.length) out.push(`Source: ${a.api.source}.`, '', '| Method | Path | Operation | What it does | Answers |', '|---|---|---|---|---|', ...a.api.operations.map((o) => `| ${o.method} | \`${o.path}\` | ${o.id} | ${o.summary} | ${o.responses.join(', ')} |`), '');
  else out.push('No API contract yet.', '');
  out.push(...part('5. Non-functional requirements', a.nfr));
  out.push('## 6. Constraints and design decisions', '', ...(a.adrs.length ? ['| Record | Decision | Status | Date |', '|---|---|---|---|', ...a.adrs.map((d) => `| ${d.number} | ${d.title} | ${d.meta.status ?? ''} | ${d.meta.date ?? ''} |`)] : ['No decision records yet.']), '', `The decision register (the team repo's bootstrap/decisions.md) holds ${a.registerCount} decisions; the architecture overview (docs/architecture/overview.md) explains the design.`, '');
  return `${out.join('\n')}\n`;
}

// mermaid-cli names every picture my-svg, its ids and its styles after it: each gets its own name inside the page.
// Nothing that runs comes along (scripts, event attributes, javascript: links).
export function inlineSvg(svg, id) {
  return String(svg).replace(/<\?xml[^>]*>/, '').replaceAll('my-svg', id)
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, '$1#');
}

// Mermaid text → the picture's SVG for the page (or null), every new diagram in one Docker run, the rest from the cache.
export function renderDiagrams(codes, stateDir, env = process.env) {
  const dir = path.join(stateDir, 'diagrams');
  const key = (c) => crypto.createHash('sha256').update(c).digest('hex').slice(0, 24);
  const pictures = new Map();
  const todo = [...new Set(codes)].filter((c) => {
    const svg = read(path.join(dir, `${key(c)}.svg`));
    if (svg) pictures.set(c, svg);
    return !svg;
  });
  let error = null;
  const run = (batch) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-diagrams-'));
    try {
      fs.writeFileSync(path.join(tmp, 'all.md'), batch.map((c) => `\`\`\`mermaid\n${c}\n\`\`\`\n`).join('\n'));
      const user = typeof process.getuid === 'function' ? ['-u', `${process.getuid()}:${process.getgid()}`] : [];
      const r = spawnSync('docker', ['run', '--rm', ...user, '-v', `${tmp}:/data`, MERMAID_IMAGE, '-q', '-b', 'white', '-i', '/data/all.md', '-o', '/data/out.md'], { encoding: 'utf8', env, timeout: 180000 });
      if (r.error) { error = r.error.code === 'ENOENT' ? 'Docker is not installed' : `docker: ${r.error.code}`; return false; }
      if (r.status !== 0) { error = (r.stderr || r.stdout || '').trim().split('\n').filter(Boolean).slice(-1)[0] || `exit ${r.status}`; return false; }
      fs.mkdirSync(dir, { recursive: true });
      batch.forEach((c, i) => {
        const svg = read(path.join(tmp, `out-${i + 1}.svg`));
        if (svg) { fs.writeFileSync(path.join(dir, `${key(c)}.svg`), svg); pictures.set(c, svg); }
      });
      return true;
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  };
  // One diagram that does not render must not cost the others theirs: then each goes on its own.
  if (todo.length && !run(todo) && !/not installed|ENOENT|Cannot connect|daemon/i.test(error || '') && todo.length > 1) {
    for (const c of todo) run([c]);
  }
  let n = 0;
  return { svg: (c) => (pictures.has(c) ? inlineSvg(pictures.get(c), `dg${++n}`) : null), error: todo.some((c) => !pictures.has(c)) ? error : null };
}

// Everything the tab shows. render: false leaves the diagrams as their text (no Docker).
export function architectureModel({ main, folder, base, project, config, env = process.env, stateDir, render = true, now = Date.now() }) {
  const overview = doc(main, base, folder, 'docs/architecture/overview.md', 'architecture/overview.md', 'overview');
  const nfr = doc(main, base, folder, 'docs/architecture/nfr.md', 'architecture/nfr.md', 'nfr');
  const approvedAdrs = listAtBase(main, base, 'docs/adr').filter((f) => f.endsWith('.md'));
  const draftAdrs = fs.existsSync(path.join(folder, 'architecture', 'adr')) ? fs.readdirSync(path.join(folder, 'architecture', 'adr')).filter((f) => f.endsWith('.md')) : [];
  const adrs = [...new Set([...approvedAdrs, ...draftAdrs])].sort().map((f) => {
    const d = doc(main, base, folder, `docs/adr/${f}`, `architecture/adr/${f}`, `adr-${f}`);
    const { meta } = frontMatter(d.text);
    return { ...d, number: /^(\d+)/.exec(f)?.[1] ?? f, meta };
  });
  const evaluations = listAtBase(main, base, 'docs/architecture/evaluations').filter((f) => f.endsWith('.md'))
    .map((f) => doc(main, base, folder, `docs/architecture/evaluations/${f}`, `architecture/evaluations/${f}`, `eval-${f}`));
  const boot = path.join(folder, 'bootstrap');
  const inputsDir = path.join(boot, 'inputs');
  const inputs = fs.existsSync(inputsDir) ? fs.readdirSync(inputsDir).filter((f) => !f.startsWith('.')).sort().map((f) => {
    const text = /\.(md|txt)$/i.test(f) ? read(path.join(inputsDir, f)) : null;
    return { name: f, text, path: path.join(inputsDir, f), kind: path.extname(f).slice(1).toUpperCase() || 'file' };
  }) : [];
  const team = (rel, id) => { const text = read(path.join(boot, rel)); return text ? { id, title: titleOf(text, rel), text, file: rel, source: `the team repo's bootstrap/${rel}`, draft: false, newerDraft: null } : null; };
  const stories = team('user-stories.md', 'stories');
  const roles = team('authorization-matrix.md', 'roles');
  const register = read(path.join(boot, 'decisions.md'));
  const registerCount = (register?.match(/^\|\s*D-\d+\s*\|/gm) || []).length;

  let contract = null;
  let api = null;
  if (project.api?.spec && !project.api?.contractRepo) {
    const pinned = project.api.pin ? spawnSync('git', ['show', `${project.api.pin}:${project.api.spec}`], { cwd: main, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }) : null;
    const at = pinned?.status === 0 ? { text: pinned.stdout, ref: project.api.pin } : atBase(main, base, project.api.spec);
    if (at) { contract = at.text; api = { source: `${project.api.spec} at ${at.ref}`, file: path.basename(project.api.spec), text: at.text, operations: operations(at.text) }; }
  }
  if (!api && read(path.join(boot, 'contract.yaml'))) {
    contract = read(path.join(boot, 'contract.yaml'));
    api = { source: 'the team repo\'s bootstrap/contract.yaml (the draft)', file: 'contract.yaml', text: contract, operations: operations(contract) };
  }
  const std = standards({ project, config, base, folder, register, contract });

  let runs = null;
  const found = findApp(main);
  if (found) { try { runs = { ...appServices(path.join(main, found.dir), env, main), where: `${found.dir ? `${found.dir}/` : ''}${found.file}` }; } catch (e) { runs = { error: e.message }; } }

  const documents = [overview, nfr, ...adrs, ...evaluations, stories, roles, ...inputs.filter((i) => i.text).map((i) => ({ text: i.text }))].filter(Boolean);
  const codes = documents.flatMap((d) => mermaidBlocks(d.text).map((b) => b.code));
  const diagrams = render ? renderDiagrams(codes, stateDir, env) : { svg: () => null, error: codes.length ? 'not drawn in this view' : null };
  const designed = overview ? mermaidBlocks(overview.text).map((b) => b.code).filter((c) => /^\s*(C4Context|C4Container|C4Component|flowchart|graph)\b/m.test(c)).slice(0, 2) : [];

  const name = project.name || path.basename(main);
  const model = { name, overview, nfr, adrs, evaluations, inputs, stories, roles, registerCount, api, standards: std, runs, diagrams, designed };
  model.srs = srsMarkdown(name, model, now);
  model.standardsText = standardsMarkdown(name, std);
  return model;
}
