// The Markdown the kit's documents are written in, as HTML for the dashboard (decision 124): headings, paragraphs,
// lists (nested by indentation), tables, fenced code, block quotes, rules, and inline code, emphasis and links.
// Everything is escaped: a document never adds markup of its own. A ```mermaid block goes to diagram(code), which
// returns the picture's HTML, or null for the code itself.
import { esc } from './svg.mjs';

// YAML front matter (a decision record's status, date, deciders) as { meta, body }.
export function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

// Inline: `code`, **bold**, *em* or _em_, [text](http… link). Other links keep their text only.
export function inline(s) {
  const parts = [];
  let rest = String(s);
  const code = /`([^`]+)`/;
  while (rest) {
    const m = code.exec(rest);
    if (!m) { parts.push(spans(rest)); break; }
    parts.push(spans(rest.slice(0, m.index)), `<code>${esc(m[1])}</code>`);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts.join('');
}

function spans(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => (/^https?:\/\//.test(href.replace(/&amp;/g, '&')) ? `<a href="${href}" target="_blank" rel="noopener">${text}</a>` : text))
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
}

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// shift: added to each heading's level (a document's # becomes <h3> with shift 2), at most h6.
export function renderMarkdown(text, { diagram = () => null, shift = 0 } = {}) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    const fence = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (fence) {
      flush();
      const body = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[2]); i++) body.push(lines[i]);
      i++;
      const code = body.join('\n');
      const pic = fence[3] === 'mermaid' ? diagram(code) : null;
      out.push(pic ?? `<pre class="src"><code>${esc(code)}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { flush(); const n = Math.min(6, h[1].length + shift); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      flush();
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      out.push(`<div class="scroll"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const body = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) body.push(lines[i].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(body.join('\n'), { diagram, shift })}</blockquote>`);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      const block = [];
      const top = /^\s*/.exec(line)[0].length;
      const numbered = (l) => /^\s*\d+[.)]\s/.test(l);
      for (; i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && block.length)); i++) {
        // A bullet list and a numbered one next to each other are two lists.
        if (block.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && /^\s*/.exec(lines[i])[0].length <= top && numbered(lines[i]) !== numbered(line)) break;
        block.push(lines[i]);
      }
      out.push(list(block));
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

// A list block: items at the smallest indentation, deeper lines belong to the item above (a nested list, or more
// text of the same item).
function list(block) {
  const indent = (l) => /^\s*/.exec(l)[0].length;
  const base = Math.min(...block.filter((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l)).map(indent));
  const ordered = /^\s*\d+[.)]/.test(block[0]);
  const items = [];
  for (const l of block) {
    if (indent(l) === base && /^\s*([-*+]|\d+[.)])\s+/.test(l)) items.push({ text: l.replace(/^\s*([-*+]|\d+[.)])\s+/, ''), sub: [] });
    else if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) items.at(-1)?.sub.push(l);
    else if (items.length) items.at(-1).text += ` ${l.trim()}`;
  }
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((it) => `<li>${inline(it.text)}${it.sub.length ? list(it.sub) : ''}</li>`).join('')}</${tag}>`;
}

// A document's headings one or more levels down, outside code fences (to put one document inside another).
export function demote(text, by) {
  let fenced = false;
  return String(text).split('\n').map((l) => {
    if (/^\s*(`{3,}|~{3,})/.test(l)) fenced = !fenced;
    return !fenced && /^#{1,6}\s/.test(l) ? `${'#'.repeat(by)}${l}`.replace(/^#{7,}/, '######') : l;
  }).join('\n');
}
