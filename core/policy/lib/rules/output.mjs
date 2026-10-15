// Long test/build output must not flood an agent's context (kept from the original output-guard).
import { deny } from '../decision.mjs';

const HEAVY = /^((npm|pnpm|yarn|bun|npx)( run)? (test|build|typecheck|lint|e2e|visual|generate|api:generate)\b|(vitest|jest|tsc|eslint|playwright test|openapi-ts|pytest|gradle|mvn)\b|vite build\b|(cargo|go|dotnet) (test|build)\b)/;
const FILTERS = new Set(['tail', 'head', 'grep', 'egrep', 'rg', 'wc', 'sed', 'awk', 'jq']);
const QUIET = /^(--silent|-s|-q|--quiet|--reporter[= ](dot|json|github-actions|junit)|--reporter=\w+|--verbosity[= ]q(uiet)?)$/;

export function checkOutput(cmds, i, ctx) {
  const c = cmds[i];
  const line = c.argv.join(' ');
  const extra = ctx.config.output.heavy;
  if (!HEAVY.test(line) && !extra.some((p) => line.startsWith(p))) return [];
  if (c.argv.some((a) => a === '--version' || a === '--help' || a === '-h')) return [];
  const toFile = c.redirects.some((r) => (r.op === '>' || r.op === '>>') && (r.fd === null || r.fd === '1' || r.fd === '&'));
  const next = c.pipeTo ? cmds.slice(i + 1).find((x) => x.pipeFrom && x.nested === c.nested) : null;
  const filtered = next && FILTERS.has(String(next.argv[0]).split('/').pop());
  const quiet = c.argv.some((a) => QUIET.test(a));
  if (toFile || filtered || quiet) return [];
  return [deny('output:heavy', `Heavy command without output control. Redirect and read a summary, e.g.\n  ${line} > /tmp/run.log 2>&1; grep -E 'error|FAIL|failed|passed' /tmp/run.log | tail -20`)];
}
