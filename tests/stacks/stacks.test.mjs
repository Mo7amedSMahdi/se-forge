// Every stack sample through tests/stacks/run.sh: the gate, migrations up/down/up on a fresh database
// container, the production image starting on it. Opt-in (Docker, large downloads, minutes per stack):
// FORGE_TEST_STACKS=1, or FORGE_TEST_STACKS=fastapi,dotnet for some.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run.sh');
const want = process.env.FORGE_TEST_STACKS ?? '';
const all = ['fastapi', 'dotnet', 'nestjs', 'mongodb', 'react', 'flutter'];
const picked = want === '1' ? all : want.split(',').filter(Boolean);

for (const stack of all) {
  test(`stack ${stack}`, { skip: !picked.includes(stack) && 'set FORGE_TEST_STACKS=1', timeout: 3600000 }, () => {
    const r = spawnSync('bash', [RUN, stack], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stdout, /^FAIL/m);
  });
}
