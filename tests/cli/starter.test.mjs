// forge new (decisions 78-81): which files go where, the CI file, and the settings proposal. Running the
// generated starters is tests/starter/run.sh (Docker).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newProject, starters, StarterError } from '../../core/cli/starter.mjs';
import { makeRepo, ctxFor, decideBash } from '../policy/helpers.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fresh = (withProject = true) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-new-')));
  if (withProject) fs.mkdirSync(path.join(root, '.forge/project'), { recursive: true });
  return root;
};
const run = (o, root) => { const lines = []; const r = newProject(o, { kitRoot: KIT, root, out: (l) => lines.push(l) }); return { ...r, out: lines.join('\n') }; };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('every starter has its metadata and files', () => {
  const all = starters(KIT);
  assert.ok(all.some((s) => s.kind === 'backend' && s.backend === 'fastapi' && s.db === 'postgresql'));
  assert.ok(all.some((s) => s.kind === 'frontend' && s.frontend === 'react'));
  for (const s of all) {
    for (const k of ['kind', 'title', 'service', 'image', 'gate', 'tests', 'guides']) assert.ok(s[k], `${s.id}: ${k}`);
    assert.ok(fs.existsSync(path.join(s.dir, 'files', 'Dockerfile')) && fs.existsSync(path.join(s.dir, 'files', 'compose.yaml')), s.id);
    assert.ok(fs.existsSync(path.join(s.dir, 'files', '_gitignore')) && !fs.existsSync(path.join(s.dir, 'files', '.gitignore')), `${s.id}: npm drops .gitignore from an installed kit, so the template is _gitignore`);
    assert.ok(!s.gate.includes("'"), `${s.id}: the gate is wrapped in sh -c '…', so it has no single quote`);
  }
});

test('one backend: files at the root, the CI gate filled, settings as a proposal', () => {
  const root = fresh();
  const r = run({ backend: 'fastapi', db: 'postgresql', title: 'Demo portal', host: 'gitlab' }, root);
  for (const f of ['app/main.py', 'app/health.py', 'tests/test_style.py', 'uv.lock', 'Dockerfile', 'compose.yaml', '.gitignore', '.gitlab-ci.yml']) assert.ok(r.files.includes(f), f);
  assert.ok(!r.files.includes('_gitignore'));
  assert.match(read(root, '.gitignore'), /^\.env$/m);
  assert.match(read(root, 'app/main.py'), /FastAPI\(title="Demo portal API"\)/);
  assert.doesNotMatch(read(root, 'compose.yaml'), /^name:/m, 'alone, the folder is the repository: Compose names the project after it');
  assert.match(read(root, '.gitlab-ci.yml'), /^ {2}GATE_COMMAND: "uv run --frozen ruff format --check \. && .*pytest -q"$/m);
  assert.match(read(root, '.gitlab-ci.yml'), /^ {2}IMAGE_NAME: "api"$/m);
  const p = JSON.parse(read(root, '.forge/project/bootstrap/project.starter.json'));
  assert.equal(p.policy.gates.full, "docker compose run --rm -T --no-deps api sh -c 'uv run --frozen ruff format --check . && uv run --frozen ruff check . && uv run --frozen mypy app && uv run --frozen pytest -q'");
  assert.deepEqual(p.policy.edits.format, [{ glob: '**/*.py', command: 'docker compose run --rm -T --no-deps api uv run --frozen ruff format {file}' }]);
  assert.equal(p.project.db.migrate, 'docker compose run --rm api uv run --frozen alembic upgrade head');
  assert.deepEqual(p.policy.tests.sides[0].code, ['app/**/*.py']);
  assert.ok(!fs.existsSync(path.join(root, '.forge/project/project.json')), 'project.json itself is never written');
  assert.match(read(root, 'README.md'), /^# Demo portal\n[\s\S]*docker compose run --rm -T --no-deps api sh -c 'uv run/);
});

test('backend and frontend: two folders, the frontend includes the backend, rules carry their folder', () => {
  const root = fresh();
  run({ backend: 'fastapi', db: 'postgresql', frontend: 'react', title: 'Portal', host: 'github' }, root);
  assert.ok(fs.existsSync(path.join(root, 'backend/app/main.py')) && fs.existsSync(path.join(root, 'frontend/src/App.tsx')));
  assert.ok(fs.existsSync(path.join(root, 'backend/.gitignore')) && fs.existsSync(path.join(root, 'frontend/.gitignore')));
  assert.match(read(root, 'frontend/compose.yaml'), /^ {2}- path: \.\.\/backend\/compose\.yaml$/m);
  assert.match(read(root, 'frontend/src/i18n/en.json'), /"title": "Portal"/);
  const p = JSON.parse(read(root, '.forge/project/bootstrap/project.starter.json'));
  assert.match(p.policy.gates.full, /^cd backend && docker compose run --rm -T --no-deps api sh -c '.*' && cd \.\.\/frontend && docker compose run --rm -T --no-deps web sh -c 'npm run typecheck && npm run lint && npm test'$/);
  assert.deepEqual(p.policy.edits.format[0], { glob: 'backend/**/*.py', dir: 'backend', command: 'docker compose run --rm -T --no-deps api uv run --frozen ruff format {file}' });
  assert.deepEqual(p.policy.edits.lint.at(-1), { glob: 'frontend/src/**/*.{ts,tsx}', dir: 'frontend', command: 'docker compose run --rm -T --no-deps web npx oxlint {file}' });
  assert.deepEqual(p.policy.tests.e2e, { tests: ['frontend/e2e/**'], command: 'cd frontend && docker compose --profile e2e run --rm -T e2e' });
  assert.deepEqual(p.policy.tests.sides.map((s) => s.name), ['backend', 'frontend']);
  assert.equal(p.project.api.generatedDir, 'frontend/src/api/schema.d.ts');
  assert.equal(p.policy.paths, undefined, 'one client: project.api.generatedDir is enough');
  for (const f of ['backend', 'frontend']) assert.match(read(root, `${f}/compose.yaml`), new RegExp(`^name: ${path.basename(root).toLowerCase()}$`, 'm'), `${f}: one Compose project for the repository`);
  assert.equal(p.project.db.migrate, 'cd backend && docker compose run --rm api uv run --frozen alembic upgrade head');
  const ci = read(root, '.github/workflows/checks.yml');
  assert.match(ci, /strategy:\n {6}matrix:\n {8}include:\n {10}- context: "backend"\n {12}gate: "uv run/);
  assert.match(ci, /- context: "frontend"\n {12}image: "web"/);
  assert.match(ci, /GATE_COMMAND: \$\{\{ matrix\.gate \}\}/);
});

test('GitLab: one matrix entry per folder', () => {
  const root = fresh();
  run({ backend: 'fastapi', db: 'postgresql', frontend: 'react', host: 'gitlab' }, root);
  const ci = read(root, '.gitlab-ci.yml');
  assert.match(ci, /gates:\n {2}extends: \.docker\n {2}parallel:\n {4}matrix:\n {6}- CONTEXT: "backend"\n {8}GATE_COMMAND: "uv run/);
  assert.match(ci, /build-image:\n {2}extends: \.docker\n {2}parallel:\n {4}matrix:\n {6}- CONTEXT: "backend"\n {8}IMAGE_NAME: "api"\n {6}- CONTEXT: "frontend"\n {8}IMAGE_NAME: "web"/);
});

test('a frontend alone includes the backend checkout next to it', () => {
  const root = fresh(false);
  const r = run({ frontend: 'react', backendDir: '../users-api/' }, root);
  assert.match(read(root, 'compose.yaml'), /^ {2}- path: \.\.\/users-api\/compose\.yaml$/m);
  assert.doesNotMatch(r.out, /project\.starter\.json/, 'no proposal without a linked project folder');
});

test('it never overwrites, keeps an existing README, and names the pairs it has', () => {
  const kept = fresh();
  fs.writeFileSync(path.join(kept, 'README.md'), '# Theirs\n');
  const r = run({ backend: 'fastapi', db: 'postgresql' }, kept);
  assert.equal(read(kept, 'README.md'), '# Theirs\n');
  assert.match(r.out, /kept your README\.md/);
  const root = fresh();
  fs.writeFileSync(path.join(root, 'compose.yaml'), 'mine\n');
  assert.throws(() => run({ backend: 'fastapi', db: 'postgresql' }, root), (e) => e instanceof StarterError && /already exist, so nothing was written: compose\.yaml/.test(e.message));
  assert.equal(read(root, 'compose.yaml'), 'mine\n');
  assert.ok(!fs.existsSync(path.join(root, 'Dockerfile')), 'nothing written');
  assert.throws(() => run({ backend: 'fastapi', db: 'oracle' }, root), /no starter for --backend fastapi --db oracle\. Available: .*--backend fastapi --db postgresql/);
  assert.throws(() => run({}, root), /needs --backend and --db, --frontend, --mobile, or several of them/);
});

test('a mobile app alone: the app id and title filled in, pictures copied byte for byte, no image to build', () => {
  const root = fresh();
  const r = run({ mobile: 'flutter', appId: 'com.acme.portal', title: 'Acme Portal', host: 'gitlab' }, root);
  for (const f of ['lib/main.dart', 'lib/home/home_page.dart', 'test/home_test.dart', 'integration_test/app_test.dart', 'pubspec.lock', 'Dockerfile', 'compose.yaml', '.gitignore', 'android/.gitignore', 'ios/.gitignore', '.gitlab-ci.yml']) assert.ok(r.files.includes(f), f);
  assert.match(read(root, 'android/app/build.gradle.kts'), /applicationId = "com\.acme\.portal"/);
  assert.match(read(root, 'android/app/build.gradle.kts'), /rootProject\.file\("key\.properties"\)/);
  assert.equal((read(root, 'ios/Runner.xcodeproj/project.pbxproj').match(/PRODUCT_BUNDLE_IDENTIFIER = com\.acme\.portal(\.RunnerTests)?;/g) || []).length, 6);
  assert.match(read(root, 'linux/CMakeLists.txt'), /set\(APPLICATION_ID "com\.acme\.portal"\)/);
  assert.match(read(root, 'lib/l10n/app_en.arb'), /"appTitle": "Acme Portal"/);
  assert.match(read(root, 'lib/l10n/app_localizations_ar.dart'), /String get appTitle => 'Acme Portal';/);
  assert.match(read(root, 'compose.yaml'), /^ {2}- path: \.\.\/backend\/compose\.yaml$/m);
  assert.doesNotMatch(r.files.map((f) => read(root, f.endsWith('.png') ? 'pubspec.yaml' : f)).join('\n'), /\{\{\w+\}\}/, 'every placeholder filled in');
  for (const png of ['test/goldens/home_en.png', 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', 'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png']) {
    assert.ok(fs.readFileSync(path.join(root, png)).equals(fs.readFileSync(path.join(KIT, 'core/starter/flutter/files', png))), png);
  }
  const ci = read(root, '.gitlab-ci.yml');
  assert.match(ci, /^ {2}GATE_COMMAND: "dart format --output=none --set-exit-if-changed lib test integration_test && flutter analyze --fatal-infos && flutter test"$/m);
  assert.doesNotMatch(ci, /^build-image:/m, 'a mobile app ships to the stores, not as an image');
  assert.match(ci, /^# No build-image job: a mobile app ships to the stores/m);
  // The Android bundle: on merge requests, and signed on release tags, which now start pipelines.
  assert.match(ci, /^ {4}- if: \$CI_COMMIT_TAG =~ \/\^v\\d\+\\\.\\d\+\\\.\\d\+\$\/$/m);
  assert.match(ci, /^android:\n {2}extends: \.docker\n {2}variables:\n {4}CONTEXT: "\."\n {2}rules:\n {4}- if: \$CI_PIPELINE_SOURCE == "merge_request_event"\n {4}- if: \$CI_COMMIT_TAG/m);
  assert.match(ci, /docker build --platform linux\/amd64 --target android -t android "\$CONTEXT"/);
  assert.match(ci, /^# Generated by forge new from the se-forge templates \(core\/ci\/gitlab\/checks\.gitlab-ci\.yml, android\.gitlab-ci\.yml\)\.$/m);
  const p = JSON.parse(read(root, '.forge/project/bootstrap/project.starter.json'));
  assert.deepEqual(p.project.stack, { mobile: 'Flutter (Dart)' });
  assert.equal(p.policy.gates.full, "docker compose run --rm -T --no-deps mobile sh -c 'dart format --output=none --set-exit-if-changed lib test integration_test && flutter analyze --fatal-infos && flutter test'");
  assert.deepEqual(p.policy.tests.e2e, { tests: ['integration_test/**'], command: 'docker compose --profile e2e run --rm -T integration' });
  assert.match(p.project.api.generate, /^docker compose run --rm -T -v \{spec\}:\/contract\/openapi\.yaml:ro mobile sh -c 'rm -rf lib\/api && /);
  assert.equal(p.project.api.generatedDir, 'lib/api');
  assert.deepEqual(p.policy.edits.format, [{ glob: '{lib,test,integration_test}/**/*.dart', command: 'docker compose run --rm -T --no-deps mobile dart format {file}' }]);
  assert.match(read(root, 'README.md'), /flutter run --dart-define=API_URL=http:\/\/localhost:8080/);
  const gh = fresh();
  run({ mobile: 'flutter', appId: 'com.acme.portal', host: 'github' }, gh);
  assert.doesNotMatch(read(gh, '.github/workflows/checks.yml'), /^ {2}build-image:/m);
  const wf = read(gh, '.github/workflows/checks.yml');
  assert.match(wf, /GATE_COMMAND: "dart format/);
  assert.match(wf, /^ {2}push:\n {4}branches: \[dev, staging, main\]\n {4}tags: \['v\*'\]$/m);
  assert.match(wf, /^ {2}android:\n {4}if: github\.event_name == 'pull_request'\n {4}runs-on: ubuntu-latest\n {4}env:\n {6}CONTEXT: "\."$/m);
  // The upload key lives in the release environment, which only the tag job uses.
  const pr = wf.slice(wf.indexOf('  android:\n'), wf.indexOf('  android-release:\n'));
  assert.doesNotMatch(pr, /secrets\./, 'pull requests never see the upload key');
  assert.match(wf, /^ {2}android-release:\n {4}if: startsWith\(github\.ref, 'refs\/tags\/v'\)\n {4}runs-on: ubuntu-latest\n {4}environment: release\n {4}env:\n {6}CONTEXT: "\."$/m);
});

test('a backend, a web app and a mobile app: three folders, three gates, two images, both end-to-end suites', () => {
  const root = fresh();
  run({ backend: 'fastapi', db: 'postgresql', frontend: 'react', mobile: 'flutter', appId: 'com.acme.portal', host: 'gitlab' }, root);
  assert.ok(fs.existsSync(path.join(root, 'backend/app/main.py')) && fs.existsSync(path.join(root, 'frontend/src/App.tsx')) && fs.existsSync(path.join(root, 'mobile/lib/main.dart')));
  assert.match(read(root, 'mobile/compose.yaml'), /^ {2}- path: \.\.\/backend\/compose\.yaml$/m);
  const p = JSON.parse(read(root, '.forge/project/bootstrap/project.starter.json'));
  assert.match(p.policy.gates.full, /^cd backend && .* && cd \.\.\/frontend && .* && cd \.\.\/mobile && docker compose run --rm -T --no-deps mobile sh -c 'dart format/);
  assert.deepEqual(p.policy.tests.sides.map((s) => s.name), ['backend', 'frontend', 'mobile']);
  assert.deepEqual(p.policy.tests.e2e, { tests: ['frontend/e2e/**', 'mobile/integration_test/**'], command: '(cd frontend && docker compose --profile e2e run --rm -T e2e) && (cd mobile && docker compose --profile e2e run --rm -T integration)' });
  assert.deepEqual(p.policy.edits.format.at(-1), { glob: 'mobile/{lib,test,integration_test}/**/*.dart', dir: 'mobile', command: 'docker compose run --rm -T --no-deps mobile dart format {file}' });
  // Both apps have a client: one generate command runs both, each in its own folder, and both are generated code.
  assert.equal(p.project.api.generate, "(npx --yes openapi-typescript@7.13.0 {spec} -o frontend/src/api/schema.d.ts) && (cd mobile && docker compose run --rm -T -v {spec}:/contract/openapi.yaml:ro mobile sh -c 'rm -rf lib/api && dart run swagger_parser && dart run build_runner build -d && dart format lib/api')");
  assert.equal(p.project.api.generatedDir, undefined);
  assert.deepEqual(p.policy.paths, { generated: ['frontend/src/api/schema.d.ts', 'mobile/lib/api'] });
  // One Compose project for the repository, named after it, in every folder: one API and one database.
  const name = path.basename(root).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  for (const f of ['backend', 'frontend', 'mobile']) assert.match(read(root, `${f}/compose.yaml`), new RegExp(`^# One Compose project for the repository: never the folder's name, which other repositories share\\.\\nname: ${name}\\n(include|services):`, 'm'), f);
  const ci = read(root, '.gitlab-ci.yml');
  assert.match(ci, /gates:\n {2}extends: \.docker\n {2}parallel:\n {4}matrix:\n {6}- CONTEXT: "backend"[\s\S]*- CONTEXT: "frontend"[\s\S]*- CONTEXT: "mobile"\n {8}GATE_COMMAND: "dart format/);
  assert.match(ci, /build-image:\n {2}extends: \.docker\n {2}parallel:\n {4}matrix:\n {6}- CONTEXT: "backend"\n {8}IMAGE_NAME: "api"\n {6}- CONTEXT: "frontend"\n {8}IMAGE_NAME: "web"\n {2}script:/);
  assert.match(read(root, 'README.md'), /The mobile app is in `mobile\/`[\s\S]*in `frontend\/` \(it includes the backend's compose file\)/);
  assert.match(ci, /^android:\n {2}extends: \.docker\n {2}variables:\n {4}CONTEXT: "mobile"\n {2}rules:\n {4}- if: \$CI_PIPELINE_SOURCE == "merge_request_event"\n {6}changes: \["mobile\/\*\*\/\*"\]$/m, 'a merge request builds the app only when it changes');
});

test('a mobile app needs its store id, in reverse domain form', () => {
  const root = fresh();
  assert.throws(() => run({ mobile: 'flutter' }, root), /--mobile needs --app-id/);
  assert.throws(() => run({ mobile: 'flutter', appId: 'com.acme-portal.app' }, root), /--mobile needs --app-id/);
  assert.throws(() => run({ mobile: 'flutter', appId: 'portal' }, root), /--mobile needs --app-id/);
  assert.throws(() => run({ mobile: 'kotlin', appId: 'com.acme.app' }, root), /no mobile starter "kotlin"\. Available: flutter/);
  assert.ok(!fs.existsSync(path.join(root, 'pubspec.yaml')), 'nothing written');
});

test('the policy: the lead is asked before forge new; lanes never run it', () => {
  const { dir } = makeRepo();
  assert.equal(decideBash('forge new --backend fastapi --db postgresql', ctxFor(dir)).decision, 'ask');
  assert.equal(decideBash('forge new --frontend react', ctxFor(dir, { agent_id: 'a1', agent_type: 'devops-engineer' })).decision, 'deny');
});
