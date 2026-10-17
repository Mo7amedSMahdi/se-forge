// The team's guide skills for a project's stack (decision 137). A role's `skills:` line names `@backend`,
// `@frontend`, `@mobile` or `@database` for "the guide of what this project uses"; forge sync puts the matching
// guide in its place, read from the stack's own words ("NestJS 11", "React 19 + TypeScript", "MongoDB 7"), and
// none when the stack names nothing it knows. A system passes each repository's stack too, so its agents get
// every guide the system uses.
const GUIDES = [
  ['backend', /nest/i, 'stack-nestjs'],
  ['backend', /fastapi/i, 'stack-fastapi'],
  ['backend', /\.net\b|dotnet|asp\.net|c#/i, 'stack-dotnet'],
  ['frontend', /react/i, 'stack-react'],
  ['mobile', /flutter/i, 'stack-flutter'],
  ['database', /mongo/i, 'db-mongodb'],
  ['database', /postgres/i, 'db-postgresql'],
  ['database', /mysql|maria/i, 'db-mysql'],
  ['database', /sql ?server|mssql/i, 'db-sqlserver'],
];
export const KINDS = ['backend', 'frontend', 'mobile', 'database'];

// { backend: ['stack-nestjs'], frontend: ['stack-react'], mobile: [], database: ['db-mongodb'] } from free text.
export function stackGuides(texts = []) {
  const text = texts.filter(Boolean).join(' · ');
  const out = Object.fromEntries(KINDS.map((k) => [k, []]));
  for (const [kind, re, skill] of GUIDES) if (re.test(text)) out[kind].push(skill);
  return out;
}

// Every guide skill the kit has, whatever the stack: the ones a project may not need.
export const ALL_GUIDES = GUIDES.map(([, , skill]) => skill);

// A role's `skills:` value with each placeholder replaced by the project's guides, in order, once each.
// An unknown placeholder throws: a typo would otherwise drop a guide without a word.
export function resolveSkills(value, guides) {
  const out = [];
  for (const item of String(value || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!item.startsWith('@')) { out.push(item); continue; }
    const kind = item.slice(1);
    if (!KINDS.includes(kind)) throw new Error(`skills: ${item} is not one of ${KINDS.map((k) => `@${k}`).join(', ')}`);
    out.push(...guides[kind]);
  }
  return [...new Set(out)];
}
