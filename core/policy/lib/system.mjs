// System mode (decisions 130-133): one system of several member repositories, one team folder, one board.
//   - system.json, in the system's team folder: the machine-readable part of the system description (the repositories,
//     their branches and deploys, the databases, the services, the environment variable names), checked here;
//   - .forge/repo.json, local in each checkout of the system: which member repository it is ({ system, repo }), or
//     the workspace root ({ system, repo: null }) where the lead runs;
//   - repos/<repo>/project.json, in the team folder: a member repository's own settings (gates, tests, paths,
//     branches, stack), laid over the system's project.json by loadConfig.
import fs from 'node:fs';
import path from 'node:path';

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;
const BRANCH = /^[\w./-]+$/;
const ROLES = ['backend', 'frontend', 'mobile', 'worker', 'infra', 'library', 'service'];
const HOSTS = ['gitlab', 'github'];
const TOP = new Set(['$schema', 'name', 'description', 'board', 'workspace', 'repos', 'databases', 'services', 'environments', 'env']);
const REPO_KEYS = new Set(['name', 'url', 'role', 'host', 'base', 'release', 'deploys', 'stack', 'owner', 'path']);
// A value never goes into the system description: names and who provides them only.
const VALUE_KEYS = /^(value|default|secret_value|password|token|key_value)$/i;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// The checkout's place in a system, from its local marker, or null.
export function memberOf(mainRoot) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(mainRoot, '.forge', 'repo.json'), 'utf8'));
    return isObj(m) && typeof m.system === 'string' ? { system: m.system, repo: typeof m.repo === 'string' ? m.repo : null } : null;
  } catch { return null; }
}

// Objects merged key by key; anything else from b replaces a.
export function deepMerge(a, b) {
  if (!isObj(a) || !isObj(b)) return structuredClone(b);
  const out = structuredClone(a);
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : structuredClone(v);
  return out;
}

// system.json's problems, as plain sentences; [] when it is fine.
export function checkSystem(sys) {
  const errors = [];
  if (!isObj(sys)) return ['system.json must be a JSON object'];
  for (const k of Object.keys(sys)) if (!TOP.has(k)) errors.push(`unknown key ${k}`);
  if (typeof sys.name !== 'string' || !SLUG.test(sys.name)) errors.push('name must be the system\'s slug (lowercase letters, digits, . _ -)');
  if (!isObj(sys.board) || !HOSTS.includes(sys.board.host) || typeof sys.board.project !== 'string' || !/^[\w.-]+(\/[\w.-]+)+$/.test(sys.board.project)) errors.push('board must be { "host": "gitlab" or "github", "project": "group/board-project" }: the one board for every ticket (decision 131)');
  const repos = Array.isArray(sys.repos) ? sys.repos : [];
  if (!repos.length) errors.push('repos must list the member repositories');
  const names = new Set();
  repos.forEach((r, i) => {
    const at = `repos[${i}]${isObj(r) && r.name ? ` (${r.name})` : ''}`;
    if (!isObj(r)) { errors.push(`${at} must be an object`); return; }
    for (const k of Object.keys(r)) if (!REPO_KEYS.has(k)) errors.push(`${at}: unknown key ${k}`);
    if (typeof r.name !== 'string' || !SLUG.test(r.name)) errors.push(`${at}: name must be a slug`);
    else if (names.has(r.name)) errors.push(`${at}: the name ${r.name} is used twice`);
    else names.add(r.name);
    if (typeof r.url !== 'string' || !r.url.trim()) errors.push(`${at}: url is the repository's Git address`);
    if (!ROLES.includes(r.role)) errors.push(`${at}: role must be one of ${ROLES.join(', ')}`);
    if (r.host !== undefined && !HOSTS.includes(r.host)) errors.push(`${at}: host must be gitlab or github`);
    if (typeof r.base !== 'string' || !BRANCH.test(r.base)) errors.push(`${at}: base is the branch tickets start from and merge into (the repository's own, e.g. develop)`);
    if (r.release !== undefined && (!Array.isArray(r.release) || r.release.some((b) => typeof b !== 'string' || !BRANCH.test(b)))) errors.push(`${at}: release must be a list of branch names`);
    if (r.deploys !== undefined && (!Array.isArray(r.deploys) || r.deploys.some((d) => !isObj(d) || typeof d.branch !== 'string' || typeof d.to !== 'string' || ![undefined, 'person', 'lead'].includes(d.merge)))) errors.push(`${at}: deploys must be a list of { "branch": "...", "to": "where it deploys", "merge": "person" (the default, decision 133) or "lead" }`);
  });
  const known = (repo) => names.has(repo);
  for (const [list, label] of [[sys.databases, 'databases'], [sys.services, 'services'], [sys.environments, 'environments'], [sys.env, 'env']]) {
    if (list !== undefined && !Array.isArray(list)) errors.push(`${label} must be a list`);
  }
  (sys.databases ?? []).forEach((d, i) => {
    if (!isObj(d) || typeof d.name !== 'string' || typeof d.engine !== 'string') errors.push(`databases[${i}] must be { "name", "engine", "repos": [...] }`);
    else for (const r of d.repos ?? []) if (!known(r)) errors.push(`databases[${i}] (${d.name}): no repository named ${r}`);
  });
  (sys.services ?? []).forEach((s, i) => {
    if (!isObj(s) || typeof s.name !== 'string') errors.push(`services[${i}] must be { "name", "kind", "used": [{ "repo", "for" }] }`);
    else for (const u of s.used ?? []) if (!isObj(u) || !known(u.repo)) errors.push(`services[${i}] (${s.name}): used names no known repository (${isObj(u) ? u.repo : u})`);
  });
  (sys.env ?? []).forEach((v, i) => {
    if (!isObj(v) || typeof v.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name)) { errors.push(`env[${i}] must be { "repo", "name", "purpose", "secret", "from" } with a variable name`); return; }
    if (!known(v.repo)) errors.push(`env[${i}] (${v.name}): no repository named ${v.repo}`);
    const leak = Object.keys(v).filter((k) => VALUE_KEYS.test(k));
    if (leak.length) errors.push(`env[${i}] (${v.name}): ${leak.join(', ')} looks like a value. The system description names each variable and who provides it, never its value`);
  });
  return errors;
}

// A repository's place on the board and in the branches, from system.json.
export const repoOf = (sys, name) => (sys?.repos ?? []).find((r) => r.name === name) ?? null;

// The member repository's first settings: its branches (decision 133: none is created or renamed) and its host.
export function memberSettings(sys, repo) {
  const release = repo.release ?? [];
  return {
    project: { host: repo.host ?? sys.board.host, stack: { other: repo.stack ?? '' } },
    policy: { branches: { base: repo.base, promote: release, protected: [...new Set([repo.base, ...release])] }, gates: { full: '' } },
  };
}

// Whether merging into a branch deploys somewhere (decision 133), and where.
export const deploysOn = (sys, repoName, branch) => (repoOf(sys, repoName)?.deploys ?? []).filter((d) => d.branch === branch).map((d) => d.to);

// The plan of a ticket and the member repository its Repo: line names, from the workspace root or a member:
// { ws, sys, repo, dir, branch, plan }, or { error } in plain words. One ticket changes one repository (decision 131).
export function ticketTarget(main, ticket) {
  const me = memberOf(main);
  if (!me) return { error: 'not a system (forge system init); a single repository uses its own worktrees.' };
  const ws = me.repo === null ? main : path.dirname(main);
  const sys = systemOf(main);
  if (!sys) return { error: 'no system.json in the system\'s team folder.' };
  const plans = path.join(main, '.forge', 'project', 'plans');
  const file = (fs.existsSync(plans) ? fs.readdirSync(plans) : []).find((f) => f.startsWith(`${ticket}-`) && f.endsWith('.md'));
  if (!file) return { error: `No plan .forge/project/plans/${ticket}-*.md.` };
  const text = fs.readFileSync(path.join(plans, file), 'utf8');
  const field = (name) => new RegExp(`^${name}:\\s*\`?([^\\s\`]+)\`?`, 'mi').exec(text)?.[1] ?? null;
  const repo = repoOf(sys, field('Repo'));
  if (!repo) return { error: `${file} needs a Repo: line naming one of the system's repositories (${sys.repos.map((r) => r.name).join(', ')}); one ticket changes one repository (decision 131).` };
  const branch = field('Branch');
  if (!branch) return { error: `${file} has no Branch: line.` };
  return { ws, sys, repo, dir: path.join(ws, repo.path || repo.name), branch, plan: path.join(plans, file) };
}

// The system's description from the checkout's team folder, or null.
export function systemOf(mainRoot) {
  try { return JSON.parse(fs.readFileSync(path.join(mainRoot, '.forge', 'project', 'system.json'), 'utf8')); } catch { return null; }
}

// The lane worktrees (`<workspace>/<repo>/.claude/worktrees/<name>`) a text names, in order, that exist in the
// workspace: the lead names an agent's lane in its prompt (decision 130).
const LANE_PATH = /(\/[^\s'"`<>()]*?\/\.claude\/worktrees\/[\w.-]+)/g;
export function lanesIn(text, workspace) {
  const out = [];
  for (const m of String(text ?? '').matchAll(LANE_PATH)) {
    let p;
    try { p = fs.realpathSync(m[1]); } catch { continue; }
    const rel = path.relative(fs.realpathSync(workspace), p);
    if (rel.startsWith('..') || path.isAbsolute(rel) || out.includes(p)) continue;
    out.push(p);
  }
  return out;
}

// The lane an agent of the workspace root worked in: the first one its transcript names (the lead's prompt comes
// first). Read from the transcript, since the root's agents all start at the root (no worktree isolation there).
export function agentLane(transcript, workspace) {
  if (!transcript) return null;
  let fd;
  try {
    fd = fs.openSync(transcript, 'r');
    const buf = Buffer.alloc(Math.min(fs.fstatSync(fd).size, 256 * 1024));
    fs.readSync(fd, buf, 0, buf.length, 0);
    return lanesIn(buf.toString('utf8').replace(/\\\//g, '/'), workspace)[0] ?? null;
  } catch { return null; } finally { if (fd !== undefined) fs.closeSync(fd); }
}
