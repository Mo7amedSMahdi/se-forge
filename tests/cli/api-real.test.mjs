// forge api check with the real, pinned Redocly CLI (npx) and oasdiff (installed or Docker), on a
// two-file YAML spec. Opt-in: FORGE_TEST_REAL_TOOLS=1 (needs the npm registry and oasdiff or Docker).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sh, writeProjectConfig } from '../policy/helpers.mjs';

const FORGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/cli/forge.mjs');
const skip = process.env.FORGE_TEST_REAL_TOOLS !== '1' && 'set FORGE_TEST_REAL_TOOLS=1';
const { FORGE_REDOCLY: _r, FORGE_OASDIFF: _o, ...ENV } = process.env;

const main = (version, email = true) => `openapi: 3.1.0
info:
  title: Users
  version: ${version}
  license: { name: MIT, identifier: MIT }
servers:
  - url: https://api.example.com/v1
security: []
paths:
  /users/{userId}:
    get:
      operationId: getUser
      summary: Get one user
      parameters:
        - { name: userId, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: The user
          content:
            application/json:
              schema: { $ref: './schemas.yaml#/User' }
        '404':
          description: Not found
          content:
            application/problem+json:
              schema: { $ref: './schemas.yaml#/Problem' }
`;
const schemas = (email = true) => `User:
  type: object
  required: [id${email ? ', email' : ''}]
  properties:
    id: { type: string }
${email ? '    email: { type: string }\n' : ''}Problem:
  type: object
  properties:
    type: { type: string }
    title: { type: string }
    status: { type: integer }
`;

test('real tools: a removed required field is breaking and needs a new major version', { skip, timeout: 600000 }, () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-api-real-')));
  sh(dir, 'git', 'init', '-q', '-b', 'main');
  sh(dir, 'git', 'config', 'user.email', 't@e'); sh(dir, 'git', 'config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'api'));
  fs.writeFileSync(path.join(dir, 'api/openapi.yaml'), main('1.0.0'));
  fs.writeFileSync(path.join(dir, 'api/schemas.yaml'), schemas());
  sh(dir, 'git', 'add', 'api'); sh(dir, 'git', 'commit', '-q', '-m', 'feat: api'); sh(dir, 'git', 'tag', 'api-v1.0.0');
  writeProjectConfig(dir, { project: { api: { spec: 'api/openapi.yaml' } } });
  const forge = () => { const r = spawnSync('node', [FORGE, 'api', 'check'], { cwd: dir, env: ENV, encoding: 'utf8' }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };

  let r = forge();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /lint: ok\nbreaking changes against api-v1\.0\.0 \(1\.0\.0\): none/);

  fs.writeFileSync(path.join(dir, 'api/openapi.yaml'), main('1.1.0'));
  fs.writeFileSync(path.join(dir, 'api/schemas.yaml'), schemas(false));
  r = forge();
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /: YES\n[\s\S]*response-required-property-removed[\s\S]*NOT OK: a breaking change needs a new major version: 2\.0\.0/);

  fs.writeFileSync(path.join(dir, 'api/openapi.yaml'), main('2.0.0'));
  r = forge();
  assert.equal(r.code, 0, r.out);
});
