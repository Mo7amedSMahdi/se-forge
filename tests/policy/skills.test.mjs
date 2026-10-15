// Every skill follows the brief's shape: when to use it (description), steps, a definition of done,
// and one job per skill (split past about 150 lines).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/skills');

for (const name of fs.readdirSync(SKILLS).sort()) {
  test(`skill ${name}: name, description, done-when, size`, () => {
    const text = fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
    assert.match(front, new RegExp(`^name: ${name}$`, 'm'), 'name matches the folder');
    assert.match(front, /^description: .{40,}/m, 'a description that says when to use it');
    assert.match(text, /\n## Done when\n- /, 'a definition of done');
    assert.ok(text.split('\n').length <= 150, `${text.split('\n').length} lines: split it`);
  });
}

// The stack guides' examples are copies of the samples that tests/stacks/run.sh verifies; they must not drift.
const STACKS = path.resolve(SKILLS, '../../tests/stacks');
const COPIES = {
  'stack-fastapi/examples/problems.py': 'fastapi/app/problems.py',
  'stack-fastapi/examples/router.py': 'fastapi/app/users/router.py',
  'stack-fastapi/examples/service.py': 'fastapi/app/users/service.py',
  'stack-fastapi/examples/conftest.py': 'fastapi/tests/conftest.py',
  'stack-fastapi/examples/migration_create_users.py': 'fastapi/migrations/versions/20261007_0001_create_users.py',
  'stack-fastapi/examples/Dockerfile': 'fastapi/Dockerfile',
  'stack-fastapi/examples/compose.yaml': 'fastapi/compose.yaml',
  'stack-dotnet/examples/Program.cs': 'dotnet/src/Users.Api/Program.cs',
  'stack-dotnet/examples/Problems.cs': 'dotnet/src/Users.Api/Problems.cs',
  'stack-dotnet/examples/UserEndpoints.cs': 'dotnet/src/Users.Api/Users/UserEndpoints.cs',
  'stack-dotnet/examples/AppDb.cs': 'dotnet/src/Users.Api/Data/AppDb.cs',
  'stack-dotnet/examples/ApiFactory.cs': 'dotnet/tests/Users.Api.Tests/ApiFactory.cs',
  'stack-dotnet/examples/Dockerfile': 'dotnet/Dockerfile',
  'stack-dotnet/examples/compose.yaml': 'dotnet/compose.yaml',
  'stack-nestjs/examples/problems.ts': 'nestjs/src/problems.ts',
  'stack-nestjs/examples/data-source.ts': 'nestjs/src/data-source.ts',
  'stack-nestjs/examples/users.service.ts': 'nestjs/src/users/users.service.ts',
  'stack-nestjs/examples/users.controller.ts': 'nestjs/src/users/users.controller.ts',
  'stack-nestjs/examples/users.e2e-spec.ts': 'nestjs/test/users.e2e-spec.ts',
  'stack-nestjs/examples/migration-CreateUsers.ts': 'nestjs/src/migrations/1759795200000-CreateUsers.ts',
  'stack-nestjs/examples/Dockerfile': 'nestjs/Dockerfile',
  'stack-nestjs/examples/compose.yaml': 'nestjs/compose.yaml',
  'db-mongodb/examples/migrate-mongo-config.js': 'mongodb/migrate-mongo-config.js',
  'db-mongodb/examples/compose.yaml': 'mongodb/compose.yaml',
  'stack-react/examples/client.ts': 'react/src/api/client.ts',
  'stack-react/examples/api.ts': 'react/src/users/api.ts',
  'stack-react/examples/NewUserPage.tsx': 'react/src/users/NewUserPage.tsx',
  'stack-react/examples/i18n.ts': 'react/src/i18n/index.ts',
  'stack-react/examples/test-setup.ts': 'react/src/test-setup.ts',
  'stack-react/examples/test-utils.tsx': 'react/src/test-utils.tsx',
  'stack-react/examples/users.test.tsx': 'react/src/users/users.test.tsx',
  'stack-react/examples/users.e2e.spec.ts': 'react/e2e/users.spec.ts',
  'stack-react/examples/vite.config.ts': 'react/vite.config.ts',
  'stack-react/examples/playwright.config.ts': 'react/playwright.config.ts',
  'stack-react/examples/Caddyfile': 'react/Caddyfile',
  'stack-react/examples/Dockerfile': 'react/Dockerfile',
  'stack-react/examples/compose.yaml': 'react/compose.yaml',
  'stack-flutter/examples/Dockerfile': 'flutter/Dockerfile',
  'stack-flutter/examples/ci-bundle.sh': 'flutter/android/ci-bundle.sh',
  'stack-flutter/examples/compose.yaml': 'flutter/compose.yaml',
  'stack-flutter/examples/pubspec.yaml': 'flutter/pubspec.yaml',
  'stack-flutter/examples/analysis_options.yaml': 'flutter/analysis_options.yaml',
  'stack-flutter/examples/l10n.yaml': 'flutter/l10n.yaml',
  'stack-flutter/examples/swagger_parser.yaml': 'flutter/swagger_parser.yaml',
  'stack-flutter/examples/api.dart': 'flutter/lib/core/api.dart',
  'stack-flutter/examples/app.dart': 'flutter/lib/app.dart',
  'stack-flutter/examples/router.dart': 'flutter/lib/router.dart',
  'stack-flutter/examples/users_providers.dart': 'flutter/lib/users/users_providers.dart',
  'stack-flutter/examples/users_page.dart': 'flutter/lib/users/users_page.dart',
  'stack-flutter/examples/new_user_page.dart': 'flutter/lib/users/new_user_page.dart',
  'stack-flutter/examples/test_utils.dart': 'flutter/test/test_utils.dart',
  'stack-flutter/examples/users_test.dart': 'flutter/test/users_test.dart',
  'stack-flutter/examples/golden_test.dart': 'flutter/test/golden_test.dart',
  'stack-flutter/examples/forge_shots.dart': 'flutter/integration_test/forge_shots.dart',
  'stack-flutter/examples/users.integration_test.dart': 'flutter/integration_test/users_test.dart',
  'db-mongodb/examples/migration-create-users.js': 'mongodb/migrations/20261007160226-create-users.js',
  'db-mongodb/examples/users.repository.ts': 'mongodb/src/users.ts',
  'load-test/examples/users.js': 'fastapi/perf/users.js',
  'adr-writer/examples/0001-cursor-pagination-for-lists.md': '../architecture/docs/adr/0001-cursor-pagination-for-lists.md',
  'c4-diagrams/examples/context.md': '../architecture/docs/architecture/context.md',
  'c4-diagrams/examples/containers.md': '../architecture/docs/architecture/containers.md',
};

test('stack guide examples are exact copies of the verified samples', () => {
  const listed = new Set(Object.keys(COPIES));
  for (const name of fs.readdirSync(SKILLS)) {
    const dir = path.join(SKILLS, name, 'examples');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) assert.ok(listed.has(`${name}/examples/${f}`), `${name}/examples/${f} has no verified source`);
  }
  for (const [copy, source] of Object.entries(COPIES)) {
    assert.equal(fs.readFileSync(path.join(SKILLS, copy), 'utf8'), fs.readFileSync(path.join(STACKS, source), 'utf8'), `${copy} differs from tests/stacks/${source}`);
  }
});
