// forge new: the starter project (decisions 78-81, 101). Writes a working skeleton for the approved stack from
// the kit's templates (core/starter/<backend>-<db>, core/starter/react, core/starter/flutter): one part at the
// repository root, or backend/, frontend/ and mobile/ when the repository holds several. Also writes the CI file
// for the project's host and the project's settings as a proposal (.forge/project/bootstrap/project.starter.json),
// never into project.json itself: applying settings asks the owner, as for every project.json change.
//   forge new [--backend fastapi|nestjs|dotnet --db postgresql|mysql|sqlserver|mongodb] [--frontend react]
//             [--mobile flutter --app-id com.client.app] [--title "Users portal"] [--host gitlab|github]
//             [--backend-dir ../backend]
import fs from 'node:fs';
import path from 'node:path';

export class StarterError extends Error {}

const SKIP_IF_PRESENT = new Set(['README.md']);
// npm leaves every .gitignore out of an installed package, so the templates keep theirs as _gitignore.
const GITIGNORE = /(^|\/)_gitignore$/;
// A mobile app's identity in the stores (Android applicationId, iOS bundle id): reverse domain, lower case.
const APP_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
// A file with a NUL byte in its first 8000 bytes is binary (git's rule): copied as it is, never filled in.
const isBinary = (buf) => buf.subarray(0, 8000).includes(0);

export function starters(kitRoot) {
  const dir = path.join(kitRoot, 'core', 'starter');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'starter.json')))
    .map((id) => ({ id, dir: path.join(dir, id), ...JSON.parse(fs.readFileSync(path.join(dir, id, 'starter.json'), 'utf8')) }));
}

const listFiles = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))])).sort();

// The commands a project runs in its dev containers (decision 72), for the layout.
function settings(parts, several) {
  const run = (p, cmd) => `docker compose run --rm -T --no-deps ${p.service} ${cmd}`;
  const gate = (p) => `docker compose run --rm -T --no-deps ${p.service} sh -c '${p.gate}'`;
  const at = (p) => (several ? `${p.folder}/` : '');
  const rule = (p) => (r) => ({ glob: `${at(p)}${r.glob}`, ...(several ? { dir: p.folder } : {}), command: run(p, r.run) });
  const policy = {
    gates: { full: parts.map((p, i) => (several ? `${i ? 'cd ../' : 'cd '}${p.folder} && ` : '') + gate(p)).join(' && ') },
    tests: {
      sides: parts.map((p) => ({ name: p.tests.name, code: p.tests.code.map((g) => at(p) + g), tests: p.tests.tests.map((g) => at(p) + g), ...(p.tests.ignore ? { ignore: p.tests.ignore.map((g) => at(p) + g) } : {}) })),
      e2e: { tests: [], command: '' },
    },
    edits: { format: [], lint: [], typecheck: [] },
    commit: { checks: [] },
  };
  const project = { stack: {} };
  const clients = [];
  for (const p of parts) {
    for (const phase of ['format', 'lint', 'typecheck']) policy.edits[phase].push(...(p.edits?.[phase] || []).map(rule(p)));
    policy.commit.checks.push(...(p.commit || []).map(rule(p)));
    Object.assign(project.stack, p.project?.stack || {});
    const cd = several ? `cd ${p.folder} && ` : '';
    if (p.project?.db) project.db = { ...p.project.db, migrate: `${cd}docker compose run --rm ${p.service} ${p.project.db.migrate}`, rollback: `${cd}docker compose run --rm ${p.service} ${p.project.db.rollback}` };
    if (p.api) clients.push({ generate: `${p.api.inFolder ? cd : ''}${p.api.generate.replaceAll('{out}', p.api.inFolder ? p.api.out : `${at(p)}${p.api.out}`)}`, dir: `${at(p)}${p.api.out}` });
  }
  // The web app and the mobile app each have a client: forge api generate runs one command, so it runs both, each
  // in its own folder, and both are generated code that is never hand-edited.
  if (clients.length === 1) project.api = { generate: clients[0].generate, generatedDir: clients[0].dir };
  if (clients.length > 1) {
    project.api = { generate: clients.map((c) => `(${c.generate})`).join(' && ') };
    policy.paths = { generated: clients.map((c) => c.dir) };
  }
  // The end-to-end tests of the web app and the mobile app: one rule, each command in its own folder.
  const e2e = parts.filter((p) => p.e2e);
  if (e2e.length) {
    const cmd = (p) => `${several ? `cd ${p.folder} && ` : ''}${p.e2e.command}`;
    policy.tests.e2e = { tests: e2e.flatMap((p) => p.e2e.tests.map((g) => at(p) + g)), command: e2e.length === 1 ? cmd(e2e[0]) : e2e.map((p) => `(${cmd(p)})`).join(' && ') };
  }
  return { project, policy };
}

// The kit's CI template for the host (core/ci), filled in: one service, or a matrix entry per folder. A mobile app
// has a gate but no production image (decision 111): it gets no build-image entry.
function ciFile(kitRoot, host, parts, several) {
  const yq = (s) => JSON.stringify(s);
  const imaged = parts.filter((p) => p.kind !== 'mobile');
  const mobile = parts.find((p) => p.kind === 'mobile');
  if (host === 'github') {
    let t = fs.readFileSync(path.join(kitRoot, 'core/ci/github/checks.yml'), 'utf8');
    const matrix = (rows, env) => `    strategy:\n      matrix:\n        include:\n${rows.map((r) => `          - ${Object.entries(r).map(([k, v], i) => `${i ? '            ' : ''}${k}: ${yq(v)}`).join('\n')}`).join('\n')}\n    env:\n${Object.entries(env).map(([k, v]) => `      ${k}: \${{ matrix.${v} }}`).join('\n')}\n`;
    if (!several) {
      t = t.replace(/^ {2}GATE_COMMAND: .*$/m, `  GATE_COMMAND: ${yq(parts[0].gate)}`);
      if (imaged.length) t = t.replace(/^ {2}IMAGE_NAME: .*$/m, `  IMAGE_NAME: ${imaged[0].image}`);
    } else {
      t = t.replace('  gates:\n    runs-on: ubuntu-latest\n', `  gates:\n    runs-on: ubuntu-latest\n${matrix(parts.map((p) => ({ context: p.folder, gate: p.gate })), { CONTEXT: 'context', GATE_COMMAND: 'gate' })}`);
      if (imaged.length) t = t.replace('  build-image:\n    runs-on: ubuntu-latest\n', `  build-image:\n    runs-on: ubuntu-latest\n${matrix(imaged.map((p) => ({ context: p.folder, image: p.image })), { CONTEXT: 'context', IMAGE_NAME: 'image' })}`);
    }
    if (!imaged.length) t = t.replace(/\n {2}build-image:\n[\s\S]*$/, '\n  # No build-image job: a mobile app ships to the stores, not as an image (decision 111).\n');
    if (mobile) {
      t = t.replace('  push:\n    branches: [dev, staging, main]\n', "  push:\n    branches: [dev, staging, main]\n    tags: ['v*']\n");
      const job = fs.readFileSync(path.join(kitRoot, 'core/ci/github/android.yml'), 'utf8').replaceAll('      CONTEXT: "."', `      CONTEXT: ${yq(mobile.folder)}`);
      t = `${t.replace(/\n*$/, '\n')}\n${job}`;
    }
    return { file: '.github/workflows/checks.yml', text: `# Generated by forge new from the se-forge template${mobile ? 's' : ''} (core/ci/github/checks.yml${mobile ? ', android.yml' : ''}).\n${t}` };
  }
  let t = fs.readFileSync(path.join(kitRoot, 'core/ci/gitlab/checks.gitlab-ci.yml'), 'utf8');
  const matrix = (rows) => `  parallel:\n    matrix:\n${rows.map((r) => `      - ${Object.entries(r).map(([k, v], i) => `${i ? '        ' : ''}${k}: ${yq(v)}`).join('\n')}`).join('\n')}\n`;
  if (!several) {
    t = t.replace(/^ {2}GATE_COMMAND: .*$/m, `  GATE_COMMAND: ${yq(parts[0].gate)}`);
    if (imaged.length) t = t.replace(/^ {2}IMAGE_NAME: .*$/m, `  IMAGE_NAME: ${yq(imaged[0].image)}`);
  } else {
    t = t.replace('gates:\n  extends: .docker\n', `gates:\n  extends: .docker\n${matrix(parts.map((p) => ({ CONTEXT: p.folder, GATE_COMMAND: p.gate })))}`);
    if (imaged.length) t = t.replace('build-image:\n  extends: .docker\n', `build-image:\n  extends: .docker\n${matrix(imaged.map((p) => ({ CONTEXT: p.folder, IMAGE_NAME: p.image })))}`);
  }
  if (!imaged.length) t = t.replace(/\n# \(Not "image": that name[\s\S]*$/, '\n# No build-image job: a mobile app ships to the stores, not as an image (decision 111).\n');
  if (mobile) {
    t = t.replace('    - if: $CI_COMMIT_BRANCH =~ /^(dev|staging|main)$/\n', '    - if: $CI_COMMIT_BRANCH =~ /^(dev|staging|main)$/\n    - if: $CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/\n');
    let job = fs.readFileSync(path.join(kitRoot, 'core/ci/gitlab/android.gitlab-ci.yml'), 'utf8').replace('    CONTEXT: "."', `    CONTEXT: ${yq(mobile.folder)}`);
    // In a repository with several parts, a merge request builds the app only when it changes.
    if (several) job = job.replace('    - if: $CI_PIPELINE_SOURCE == "merge_request_event"\n', `    - if: $CI_PIPELINE_SOURCE == "merge_request_event"\n      changes: [${yq(`${mobile.folder}/**/*`)}]\n`);
    t = `${t.replace(/\n*$/, '\n')}\n${job}`;
  }
  return { file: '.gitlab-ci.yml', text: `# Generated by forge new from the se-forge template${mobile ? 's' : ''} (core/ci/gitlab/checks.gitlab-ci.yml${mobile ? ', android.gitlab-ci.yml' : ''}).\n${t}` };
}

// The repository's README: how to run and check it, for people and agents.
function readme(title, parts, several) {
  const where = (p) => (several ? ` (in \`${p.folder}/\`)` : '');
  const app = parts.find((p) => p.kind !== 'backend');
  const upIn = several && app ? ` in \`${app.folder}/\` (it includes the backend's compose file)` : '';
  const served = parts.filter((p) => p.kind !== 'mobile').map((p) => (p.kind === 'backend' ? 'the API at http://localhost:8080 (health: `/health`)' : 'the web app at http://localhost:5173'));
  const mobile = parts.find((p) => p.kind === 'mobile');
  return `# ${title}

Started with \`forge new\` from the se-forge starter: ${parts.map((p) => p.title).join(' and ')}.${several ? ` ${parts.map((p) => `The ${p.kind === 'mobile' ? 'mobile app' : p.kind} is in \`${p.folder}/\`.`).join(' ')}` : ''}

## Run it
- \`docker compose up -d --build --wait\`${upIn}: ${served.length ? `${served.join(' and ')}, reloading on every saved change` : 'the API the app talks to'}.${mobile ? `
- The mobile app on a phone simulator${where(mobile)}: \`flutter run --dart-define=API_URL=http://localhost:8080\` on the Mac (Flutter 3.47.7, with Xcode's simulator or an Android emulator open; an Android emulator reaches the Mac at \`http://10.0.2.2:8080\`).` : ''}
- Your settings: copy \`.env.example\` to \`.env\`${several ? ' in each folder that has one' : ''} (never committed).
- After a dependency change: \`docker compose up -d --build --renew-anon-volumes --wait\`. Stop: \`docker compose down\` (\`-v\` also deletes the database).

## Check it
The gate, as CI runs it, inside the dev container:
${parts.map((p) => `- ${p.title}${where(p)}: \`docker compose run --rm -T --no-deps ${p.service} sh -c '${p.gate}'\``).join('\n')}

## Work on it
Branches: tickets on \`feat|fix|chore/<ticket>-<slug>\` from \`dev\`; \`dev\` → \`staging\` → \`main\` by merge requests. Conventional Commits.
Guides (se-forge skills): ${[...new Set(parts.flatMap((p) => p.guides))].map((g) => `\`${g}\``).join(', ')}, \`dev-environment\`.
`;
}

export function newProject(o, { kitRoot, root, out, writeProposal = true }) {
  const all = starters(kitRoot);
  const parts = [];
  if (o.backend || o.db) {
    const b = all.find((s) => s.kind === 'backend' && s.backend === o.backend && s.db === o.db);
    if (!b) throw new StarterError(`no starter for --backend ${o.backend} --db ${o.db}. Available: ${all.filter((s) => s.kind === 'backend').map((s) => `--backend ${s.backend} --db ${s.db}`).join('; ')} (decision 80: other pairs are added, verified, when a project needs one)`);
    parts.push(b);
  }
  if (o.frontend) {
    const f = all.find((s) => s.kind === 'frontend' && s.frontend === o.frontend);
    if (!f) throw new StarterError(`no frontend starter "${o.frontend}". Available: ${all.filter((s) => s.kind === 'frontend').map((s) => s.frontend).join(', ')}`);
    parts.push(f);
  }
  if (o.mobile) {
    const m = all.find((s) => s.kind === 'mobile' && s.mobile === o.mobile);
    if (!m) throw new StarterError(`no mobile starter "${o.mobile}". Available: ${all.filter((s) => s.kind === 'mobile').map((s) => s.mobile).join(', ')}`);
    if (!APP_ID.test(o.appId || '')) throw new StarterError('--mobile needs --app-id: the app\'s identity in Google Play and the App Store, in reverse domain form (com.client.app; lower case, no hyphens). It cannot change after the first upload, so there is no default.');
    parts.push(m);
  }
  if (!parts.length) throw new StarterError('forge new needs --backend and --db, --frontend, --mobile, or several of them');
  const several = parts.length > 1;
  for (const p of parts) p.folder = several ? p.kind : '.';
  const hasBackend = parts.some((p) => p.kind === 'backend');
  const backendDir = (o.backendDir || '../backend').replace(/\/$/, '');
  const backendCompose = several && hasBackend ? '../backend/compose.yaml' : `${several ? '../' : ''}${backendDir}/compose.yaml`;
  const vars = { title: o.title || 'App', backend_compose: backendCompose, app_id: o.appId || '' };
  const fill = (text) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  // In one repository, every folder's compose.yaml names the same Compose project, so the web app, the mobile
  // app and the backend's own commands (migrations) share one API and one database. Unnamed, each folder would
  // be its own project, named after the folder (backend, frontend), which every other such repository shares.
  const composeName = (path.basename(root).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z0-9]+|-+$/g, '')) || 'app';
  const named = (text) => text.replace(/^(?!#)/m, `# One Compose project for the repository: never the folder's name, which other repositories share.\nname: ${composeName}\n`);

  // Everything to write, checked before anything is written.
  const writes = [];
  for (const p of parts) {
    for (const rel of listFiles(path.join(p.dir, 'files'))) {
      const buf = fs.readFileSync(path.join(p.dir, 'files', rel));
      const text = isBinary(buf) ? buf : fill(buf.toString('utf8'));
      writes.push({ rel: path.join(p.folder, rel.replace(GITIGNORE, '$1.gitignore')), text: several && rel === 'compose.yaml' ? named(text) : text });
    }
  }
  const ci = ciFile(kitRoot, o.host || 'gitlab', parts, several);
  writes.push({ rel: ci.file, text: ci.text });
  writes.push({ rel: 'README.md', text: readme(vars.title, parts, several) });
  const skipped = writes.filter((w) => SKIP_IF_PRESENT.has(w.rel) && fs.existsSync(path.join(root, w.rel)));
  const clash = writes.filter((w) => !skipped.includes(w) && fs.existsSync(path.join(root, w.rel)));
  if (clash.length) throw new StarterError(`these files already exist, so nothing was written: ${clash.slice(0, 8).map((w) => w.rel).join(', ')}${clash.length > 8 ? ', …' : ''}. forge new starts a repository; it never overwrites.`);
  for (const w of writes.filter((x) => !skipped.includes(x))) {
    fs.mkdirSync(path.dirname(path.join(root, w.rel)), { recursive: true });
    fs.writeFileSync(path.join(root, w.rel), w.text);
  }
  out(`wrote ${writes.length - skipped.length} files: ${parts.map((p) => `${p.title}${several ? ` in ${p.folder}/` : ''}`).join(' and ')}, ${ci.file}${skipped.length ? `; kept your ${skipped.map((w) => w.rel).join(', ')}` : ''}`);

  const proposal = settings(parts, several);
  const proposalFile = path.join(root, '.forge', 'project', 'bootstrap', 'project.starter.json');
  if (writeProposal && fs.existsSync(path.join(root, '.forge', 'project'))) {
    fs.mkdirSync(path.dirname(proposalFile), { recursive: true });
    fs.writeFileSync(proposalFile, `${JSON.stringify(proposal, null, 2)}\n`);
    out(`the project's settings for this starter: .forge/project/bootstrap/project.starter.json (merge them into project.json: a person approves; forge config check first)`);
  }
  const app = parts.find((p) => p.kind !== 'backend');
  out(`next: docker compose up -d --build --wait${several && app ? ` (in ${app.folder}/)` : ''}, then commit on a branch and run forge gates. Guides: ${[...new Set(parts.flatMap((p) => p.guides))].join(', ')}.`);
  return { files: writes.filter((x) => !skipped.includes(x)).map((w) => w.rel), proposal };
}
