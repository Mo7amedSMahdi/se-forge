// The Architecture tab's HTML (decision 124), from architectureModel: sections that open and close, each document
// readable in the page with its source and a download of its Markdown; the SRS put together for download.
import { pathToFileURL } from 'node:url';
import { esc, components } from './svg.mjs';
import { renderMarkdown, frontMatter } from './markdown.mjs';

const ext = (name) => (name.match(/\.(\w+)$/)?.[1] ?? 'md').toLowerCase();
const TYPES = { md: 'text/markdown', yaml: 'application/yaml', yml: 'application/yaml', json: 'application/json', txt: 'text/plain' };
// A download of the text as a file, from the page itself (a data: link: no server, works offline).
export const download = (name, text, label = `Download .${ext(name)}`) => `<a class="dl" download="${esc(name)}" title="${esc(name)}" href="data:${TYPES[ext(name)] ?? 'text/plain'};charset=utf-8,${encodeURIComponent(text)}">${esc(label)}</a>`;

// The body without its first heading (the section's title says it) and its front matter.
const bodyOf = (text) => frontMatter(text).body.replace(/^\s*#\s+.+\n/, '');

export function renderArchitecture(a) {
  if (!a) return '<p class="empty">Not available in this view.</p>';
  const figure = (code) => {
    const svg = a.diagrams.svg(code);
    return svg ? `<figure class="diagram">${svg}</figure>` : null;
  };
  const md = (text, shift = 2) => `<div class="md">${renderMarkdown(bodyOf(text), { diagram: figure, shift })}</div>`;
  const src = (d) => `<span class="src">${esc(d.source)}${d.newerDraft ? ` · <b class="note">the team repo has a newer draft (${esc(d.newerDraft)}): not approved yet</b>` : ''}</span>`;
  const section = (id, title, head, body, open = false) => `<details class="doc" id="arch-${id}"${open ? ' open' : ''}><summary><span class="t">${esc(title)}</span>${head}</summary><div class="body">${body}</div></details>`;
  const docSection = (id, title, d) => (d ? section(id, title, `${src(d)}${download(d.file, d.text)}`, md(d.text)) : '');
  const toc = [];
  const parts = [];
  const add = (id, label, html) => { if (html) { toc.push(`<a href="#arch-${id}">${esc(label)}</a>`); parts.push(html); } };

  // Components: as designed (the overview's C4 diagrams), and as they run (the Compose file).
  const designed = a.designed.map((c) => figure(c) ?? `<pre class="src"><code>${esc(c)}</code></pre>`).join('');
  let running = '<p class="empty">No Compose file in this project yet: forge new adds one.</p>';
  if (a.runs?.error) running = `<p class="empty">${esc(a.runs.error)}</p>`;
  else if (a.runs?.services) {
    const web = a.runs.services.filter((s) => s.ports.some((p) => p.url));
    const nodes = [
      ...(web.length ? [{ id: ' browser', label: 'Browser', sub: 'on this Mac', kind: 'outside' }] : []),
      ...a.runs.services.map((s) => ({ id: s.name, label: s.name, sub: s.image ? s.image : s.build ? `built from ${s.build}` : '', note: s.ports.map((p) => p.address).join(', '), title: `${s.name}${s.dependsOn.length ? `, needs ${s.dependsOn.join(', ')}` : ''}` })),
    ];
    const edges = [
      ...web.map((s) => ({ from: ' browser', to: s.name, label: 'opens' })),
      ...a.runs.services.flatMap((s) => s.dependsOn.map((d) => ({ from: s.name, to: d, label: '' }))),
    ];
    running = components({ nodes, edges });
  }
  add('components', 'Components', section('components', 'Components', '<span class="src">as designed, and as they run</span>',
    `<h4>As designed</h4><p class="dim">The architecture overview's C4 diagrams: who uses the app, its containers and how they talk.</p>${designed || '<p class="empty">The architecture overview has no C4 diagram yet (skill c4-diagrams).</p>'}
<h4>As it runs</h4><p class="dim">The services of ${esc(a.runs?.where ?? 'the Compose file')} (from docker compose config): an arrow is what a service needs, or where the browser opens it. A component in one picture and not the other is worth a look.</p>${running}`, true));

  // Requirements: the client's, the roles, the stories; the SRS from every part.
  const inputs = a.inputs.map((i) => (i.text ? `<h4>${esc(i.name)} ${download(i.name, i.text)}</h4>${md(i.text, 3)}` : `<h4>${esc(i.name)}</h4><p><a href="${esc(pathToFileURL(i.path).href)}">Open the ${esc(i.kind)}</a> <span class="dim">(in the team repo, bootstrap/inputs/)</span></p>`)).join('');
  const reqDoc = (title, d) => (d ? `<h4>${esc(title)} ${download(d.file, d.text)}</h4><p class="src">${esc(d.source)}</p>${md(d.text, 3)}` : '');
  add('requirements', 'Requirements', section('requirements', 'Requirements', `<span class="src">the client's requirements, users and roles, the stories</span>${download(`${a.name}-srs.md`, a.srs, 'Download the SRS')}`,
    `<p class="dim">The SRS download puts every part into one document in the usual order (the client's requirements, users and roles, functional requirements, interfaces, non-functional requirements, constraints), each naming its source.</p>${inputs ? `<h4 class="part">The client's requirements</h4>${inputs}` : ''}${reqDoc('Users and roles', a.roles)}${reqDoc('User stories', a.stories)}`));

  add('overview', 'Overview', docSection('overview', a.overview?.title ?? 'Architecture overview', a.overview));

  if (a.adrs.length) {
    const rows = a.adrs.map((d) => `<tr><td><a href="#arch-adr-${esc(d.number)}">${esc(d.number)}</a></td><td>${esc(d.title)}</td><td>${esc(d.meta.status ?? (d.draft ? 'draft' : ''))}</td><td>${esc(d.meta.date ?? '')}</td><td>${esc(d.meta['decision-makers'] ?? '')}</td></tr>`).join('');
    const each = a.adrs.map((d) => section(`adr-${d.number}`, `${d.number} ${d.title}`, `${src(d)}${download(d.file, d.text)}`, md(d.text, 3))).join('');
    add('decisions', `Decisions (${a.adrs.length})`, section('decisions', 'Decision records', `<span class="src">${a.adrs.length} records (MADR), docs/adr/</span>`, `<div class="scroll"><table><thead><tr><th>Record</th><th>Decision</th><th>Status</th><th>Date</th><th>Decided by</th></tr></thead><tbody>${rows}</tbody></table></div>${each}`));
  }

  add('nfr', 'Non-functional', docSection('nfr', a.nfr?.title ?? 'Non-functional requirements', a.nfr));

  if (a.api) {
    const rows = a.api.operations.map((o) => `<tr><td><span class="verb v-${esc(o.method.toLowerCase())}">${esc(o.method)}</span></td><td><code>${esc(o.path)}</code></td><td>${esc(o.id)}</td><td>${esc(o.summary)}</td><td>${esc(o.responses.join(', '))}</td></tr>`).join('');
    add('api', `API (${a.api.operations.length})`, section('api', 'API endpoints', `<span class="src">${esc(a.api.source)}</span>${download(a.api.file, a.api.text)}`, a.api.operations.length ? `<div class="scroll"><table><thead><tr><th>Method</th><th>Path</th><th>Operation</th><th>What it does</th><th>Answers</th></tr></thead><tbody>${rows}</tbody></table></div><p class="dim">The contract's description has the rules every operation follows; the download is the whole contract.</p>` : '<p class="empty">The contract has no operations yet.</p>'));
  }

  add('standards', 'Standards', section('standards', 'Standards', '<span class="src">what every change follows: the project\'s settings and decisions, and the kit\'s rules</span>' + download(`${a.name}-standards.md`, a.standardsText), md(a.standardsText)));

  if (a.evaluations.length) add('evaluations', 'Evaluations', section('evaluations', 'Evaluations', '<span class="src">docs/architecture/evaluations/</span>', a.evaluations.map((d) => section(`eval-${d.file}`, d.title, `${src(d)}${download(d.file, d.text)}`, md(d.text, 3))).join('')));

  const note = a.diagrams.error ? `<p class="hint">Diagrams are shown as their text: ${esc(a.diagrams.error)}. They are drawn with Docker when the dashboard is built.</p>` : '';
  return `<nav class="toc">${toc.join('')}</nav>${note}${parts.join('\n')}`;
}
