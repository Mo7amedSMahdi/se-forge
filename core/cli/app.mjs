// forge app (decision 123): the project's app on this Mac, from its Compose file.
//   forge app              what runs, and where to open it
//   forge app up [--fresh] [--no-open]   build, start, wait until healthy, open the app (--fresh renews the
//                          containers' own node_modules and the like, after a dependency change)
//   forge app down         stop it (the data volumes stay)
// The Compose file is the one no other includes: at the root, or in frontend/ (which includes ../backend, decisions
// 71 and 72), web/, client/, backend/, api/, server/ or mobile/. Its services and ports come from
// `docker compose config`, which reads the files without starting anything.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { git } from '../policy/lib/context.mjs';

export class AppError extends Error {}

const FILES = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml'];
const DIRS = ['.', 'frontend', 'web', 'client', 'backend', 'api', 'server', 'mobile'];
// Ports a browser has nothing to open on: databases, caches, brokers.
const NOT_WEB = new Set([27017, 5432, 3306, 1433, 6379, 5672, 9200, 11211]);
const WEB_NAME = /^(web|frontend|front|app|ui|client|caddy|proxy|nginx)$/i;

// The folder of the app's top Compose file, relative to main, or null.
export function findApp(main) {
  const found = DIRS.map((d) => ({ dir: d, file: FILES.find((f) => fs.existsSync(path.join(main, d, f))) })).filter((x) => x.file);
  const included = new Set();
  for (const f of found) {
    const text = fs.readFileSync(path.join(main, f.dir, f.file), 'utf8');
    const block = /^include:[ \t]*\n((?:[ \t]+\S.*\n?|[ \t]*\n)*)/m.exec(text)?.[1] ?? '';
    for (const m of block.matchAll(/(?:path:[ \t]*|-[ \t]+)["']?([^\s"']+\.ya?ml)/g)) included.add(path.resolve(main, f.dir, m[1]));
  }
  const top = found.find((f) => !included.has(path.resolve(main, f.dir, f.file)));
  return top ? { dir: top.dir === '.' ? '' : top.dir, file: top.file } : null;
}

function docker(args, cwd, env, inherit = false) {
  const r = spawnSync('docker', args, { cwd, env, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new AppError(r.error.code === 'ENOENT' ? 'Docker is not installed: install Docker Desktop (the guide, part B).' : `docker: ${r.error.code}`);
  return { ok: r.status === 0, status: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

// Each service the app starts (profiles left out, as `up` leaves them out), with its addresses on this Mac.
// root: the folder build contexts are named from (the repository's root; the Compose folder by default).
export function appServices(dir, env, root = dir) {
  const r = docker(['compose', 'config', '--format', 'json'], dir, env);
  if (!r.ok) throw new AppError(`docker compose config: ${r.err.split('\n').pop() || `exit ${r.status}`}`);
  const c = JSON.parse(r.out);
  const services = Object.entries(c.services || {}).map(([name, s]) => ({
    name,
    dependsOn: Object.keys(s.depends_on || {}),
    image: s.image && !s.build ? s.image : null,
    build: s.build ? `${path.relative(root, s.build.context || dir) || '.'}${s.build.target ? ` (${s.build.target})` : ''}` : null,
    ports: (s.ports || []).filter((p) => p.published).map((p) => {
      const port = Number(p.published);
      const web = !NOT_WEB.has(Number(p.target)) && !NOT_WEB.has(port);
      return { port, target: Number(p.target), url: web ? `http://localhost:${port}` : null, address: `localhost:${port}` };
    }),
  }));
  const withWeb = services.filter((s) => s.ports.some((p) => p.url));
  const app = withWeb.find((s) => WEB_NAME.test(s.name)) ?? withWeb[0];
  return { project: c.name, services, url: app?.ports.find((p) => p.url)?.url ?? null };
}

// What runs now: [{ service, state, health }].
export function appState(dir, env) {
  const r = docker(['compose', 'ps', '--all', '--format', 'json'], dir, env);
  if (!r.ok) return [];
  const rows = r.out.startsWith('[') ? JSON.parse(r.out) : r.out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return rows.map((x) => ({ service: x.Service, state: x.State, health: x.Health || '' }));
}

// The code the app is built from: the checkout's branch and commit, and how far it is behind its upstream.
export function appCode(main) {
  const branch = git(main, ['symbolic-ref', '--short', '-q', 'HEAD']).out || null;
  const sha = git(main, ['rev-parse', '--short', 'HEAD']).out || null;
  const up = branch ? git(main, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).out : '';
  const behind = up ? Number(git(main, ['rev-list', '--count', 'HEAD..@{u}']).out || 0) : 0;
  return { branch, sha, upstream: up || null, behind };
}

// Everything the dashboard's "Run the app" tab shows. Never starts anything.
export function appInfo(main, env) {
  const found = findApp(main);
  const mobile = fs.existsSync(path.join(main, 'mobile', 'pubspec.yaml'));
  if (!found) return { found: null, main, mobile, code: appCode(main) };
  let services = null;
  let error = null;
  try { services = appServices(path.join(main, found.dir), env); } catch (e) { error = e.message; }
  return { found, main, mobile, code: appCode(main), services, error };
}

const codeLine = (c, dir) => `the code checked out in ${dir}${c.branch ? `: ${c.branch} at ${c.sha}` : c.sha ? `: ${c.sha} (no branch)` : ''}${c.behind ? `, ${c.behind} commit${c.behind === 1 ? '' : 's'} behind ${c.upstream} (git pull there first for the latest)` : ''}`;

export function app(o, { main, env, out }) {
  const verb = o._[0] ?? 'status';
  if (!['status', 'up', 'down'].includes(verb)) throw new AppError('forge app [up [--fresh] [--no-open] | down]');
  const found = findApp(main);
  if (!found) throw new AppError(`No Compose file in this project (${DIRS.map((d) => (d === '.' ? 'the root' : `${d}/`)).join(', ')}): forge new adds one (skill dev-environment).`);
  const dir = path.join(main, found.dir);
  const where = `${found.dir ? `${found.dir}/` : ''}${found.file}`;
  if (verb === 'status') {
    const s = appServices(dir, env);
    const state = appState(dir, env);
    const of = (name) => state.find((x) => x.service === name);
    out(`${s.project} (${where}):`);
    for (const sv of s.services) {
      const st = of(sv.name);
      out(`  ${sv.name}: ${st ? `${st.state}${st.health ? ` (${st.health})` : ''}` : 'not running'}${sv.ports.length ? ` · ${sv.ports.map((p) => p.url ?? p.address).join(', ')}` : ''}`);
    }
    const running = s.services.some((sv) => of(sv.name)?.state === 'running');
    out(running ? `Open ${s.url ?? 'it'}.` : 'Not running: forge app up.');
    return 0;
  }
  if (!docker(['info', '--format', '{{.ServerVersion}}'], dir, env).ok) throw new AppError('Docker is not running: open Docker Desktop, wait until it says it is running, then run this again.');
  if (verb === 'down') return docker(['compose', 'down'], dir, env, true).ok ? 0 : 1;
  const s = appServices(dir, env);
  out(`Building and starting ${s.services.map((x) => x.name).join(', ')} (${where}) from ${codeLine(appCode(main), path.basename(main))}. The first build takes a few minutes.`);
  const r = docker(['compose', 'up', '-d', '--build', '--wait', ...(o.fresh === true ? ['--renew-anon-volumes'] : [])], dir, env, true);
  if (!r.ok) { out('It did not start: the lines above say which service failed. forge app shows what runs; docker compose logs <service> (in that folder) shows why.'); return 1; }
  out(`Running. Open ${s.url ?? 'it'}${s.url ? '' : ' (no service publishes a web port)'}. Stop it with forge app down.`);
  if (s.url && o['no-open'] !== true && process.platform === 'darwin') spawnSync('open', [s.url], { stdio: 'ignore' });
  return 0;
}
