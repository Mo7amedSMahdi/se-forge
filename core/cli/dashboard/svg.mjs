// The dashboard's charts as SVG, drawn here so the page needs no library and no network (decision 98).
// Colours come from CSS classes on the page, so light and dark follow the system.
import { day, hour, when } from './format.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (x) => Math.round(x * 10) / 10;

// A round axis step for a maximum: 1, 2 or 5 times a power of ten, about four steps.
export function step(max) {
  if (!(max > 0)) return 1;
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw);
}

// Horizontal stacked bars, one row each: rows [{ label, parts: { key: value }, right, title }],
// keys [{ key, label, cls }], fmt for the axis and the titles.
export function stackedBars({ rows, keys, fmt = String, width = 900, labelW = 190, rightW = 230, rowH = 24 }) {
  const plotW = width - labelW - rightW;
  const max = Math.max(1, ...rows.map((r) => keys.reduce((s, k) => s + (r.parts[k.key] || 0), 0)));
  const s = step(max);
  const top = Math.ceil(max / s) * s;
  const x = (v) => labelW + (v / top) * plotW;
  const height = 22 + rows.length * rowH + 4;
  const out = [`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`];
  for (let v = 0; v <= top + 1e-9; v += s) out.push(`<line class="grid" x1="${n(x(v))}" x2="${n(x(v))}" y1="16" y2="${height - 4}"/><text class="axis" x="${n(x(v))}" y="11" text-anchor="middle">${esc(fmt(v))}</text>`);
  rows.forEach((r, i) => {
    const y = 22 + i * rowH;
    out.push(`<text class="label" x="${labelW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(r.label)}</text>`);
    let at = 0;
    for (const k of keys) {
      const v = r.parts[k.key] || 0;
      if (v <= 0) continue;
      out.push(`<rect class="${k.cls}" x="${n(x(at))}" y="${y + 3}" width="${n(Math.max(1, x(at + v) - x(at)))}" height="${rowH - 6}" rx="2"><title>${esc(`${r.label} · ${k.label}: ${fmt(v)}`)}</title></rect>`);
      at += v;
    }
    if (r.right) out.push(`<text class="note" x="${n(x(at) + 6)}" y="${y + rowH / 2 + 4}">${esc(r.right)}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}

// Vertical stacked columns, one per period: cols [{ label, parts: { key: value }, title }].
export function columns({ cols, keys, fmt = String, width = 900, height = 230 }) {
  const left = 64;
  const top = 12;
  const bottom = 34;
  const plotW = width - left - 10;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...cols.map((c) => keys.reduce((s, k) => s + (c.parts[k.key] || 0), 0)));
  const s = step(max);
  const ceil = Math.ceil(max / s) * s;
  const y = (v) => top + plotH - (v / ceil) * plotH;
  const slot = plotW / Math.max(1, cols.length);
  const barW = Math.max(4, Math.min(48, slot * 0.7));
  const every = Math.max(1, Math.ceil(cols.length / 14));
  const out = [`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`];
  for (let v = 0; v <= ceil + 1e-9; v += s) out.push(`<line class="grid" x1="${left}" x2="${width - 10}" y1="${n(y(v))}" y2="${n(y(v))}"/><text class="axis" x="${left - 6}" y="${n(y(v) + 4)}" text-anchor="end">${esc(fmt(v))}</text>`);
  cols.forEach((c, i) => {
    const x = left + i * slot + (slot - barW) / 2;
    let at = 0;
    for (const k of keys) {
      const v = c.parts[k.key] || 0;
      if (v <= 0) continue;
      out.push(`<rect class="${k.cls}" x="${n(x)}" y="${n(y(at + v))}" width="${n(barW)}" height="${n(Math.max(1, y(at) - y(at + v)))}"><title>${esc(`${c.label} · ${k.label}: ${fmt(v)}`)}</title></rect>`);
      at += v;
    }
    if (i % every === 0) out.push(`<text class="axis" x="${n(x + barW / 2)}" y="${height - bottom + 16}" text-anchor="middle">${esc(c.label)}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}

// Time axis ticks: every day, or every few days on long spans; every few hours on a short one.
function timeTicks(from, to) {
  const H = 3600000;
  const span = to - from;
  const every = span <= 2 * 24 * H ? 6 * H : span <= 14 * 24 * H ? 24 * H : 7 * 24 * H;
  const first = new Date(from);
  first.setMinutes(0, 0, 0);
  if (every >= 24 * H) first.setHours(0);
  const out = [];
  for (let t = first.getTime(); t <= to; t += every) if (t >= from) out.push({ t, label: every < 24 * H ? `${day(t)}, ${hour(new Date(t).getHours())}` : day(t) });
  return out;
}

// Counts over time, stacked (a cumulative flow): points [{ at, n: { key: count } }] oldest first, keys bottom
// first [{ key, label, cls }]. Each band is a step area that changes only where a count changes; a thin gap in
// the card's colour separates the bands. Every stretch between two changes has a hover title with all the
// counts, and the right edge names each band that is tall enough with its count now.
export function flow({ points, keys, from, to, width = 900, height = 260, right = 110 }) {
  const left = 40;
  const plotW = width - left - right;
  const plotH = height - 50;
  const x = (t) => left + ((Math.min(Math.max(t, from), to) - from) / Math.max(1, to - from)) * plotW;
  const sum = (p, upto) => keys.slice(0, upto).reduce((a, k) => a + (p.n[k.key] || 0), 0);
  const shown = [];
  const before = points.filter((p) => p.at <= from).at(-1);
  if (before) shown.push({ at: from, n: before.n });
  shown.push(...points.filter((p) => p.at > from && p.at <= to));
  const max = Math.max(1, ...shown.map((p) => sum(p, keys.length)));
  const s = step(max);
  const top = Math.ceil(max / s) * s;
  const y = (v) => 24 + plotH - (v / top) * plotH;
  const out = [`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`];
  for (const { t, label } of timeTicks(from, to)) out.push(`<line class="grid" x1="${n(x(t))}" x2="${n(x(t))}" y1="24" y2="${24 + plotH}"/><text class="axis" x="${n(x(t))}" y="${height - 8}" text-anchor="middle">${esc(label)}</text>`);
  for (let v = 0; v <= top + 1e-9; v += s) out.push(`<line class="grid" x1="${left}" x2="${left + plotW}" y1="${n(y(v))}" y2="${n(y(v))}"/><text class="axis" x="${left - 6}" y="${n(y(v) + 4)}" text-anchor="end">${v}</text>`);
  if (!shown.length) { out.push('</svg>'); return out.join(''); }
  const last = shown.at(-1);
  keys.forEach((k, i) => {
    const lo = (p) => sum(p, i);
    const hi = (p) => sum(p, i + 1);
    let d = `M${n(x(shown[0].at))},${n(y(hi(shown[0])))}`;
    for (const p of shown.slice(1)) d += ` H${n(x(p.at))} V${n(y(hi(p)))}`;
    d += ` H${n(x(to))} V${n(y(lo(last)))}`;
    for (let j = shown.length - 1; j >= 1; j--) d += ` H${n(x(shown[j].at))} V${n(y(lo(shown[j - 1])))}`;
    d += ` H${n(x(shown[0].at))} Z`;
    out.push(`<path class="band ${k.cls}" d="${d}"/>`);
    const h = y(lo(last)) - y(hi(last));
    if (h >= 12) out.push(`<text class="label" x="${n(left + plotW + 6)}" y="${n((y(lo(last)) + y(hi(last))) / 2 + 4)}">${esc(`${k.label} ${last.n[k.key] || 0}`)}</text>`);
  });
  // The hover layer: one transparent column per stretch, with every count in it.
  const tip = (p) => keys.slice().reverse().map((k) => `${k.label}: ${p.n[k.key] || 0}`).join(' · ');
  shown.forEach((p, j) => {
    const a = x(p.at);
    const b = x(shown[j + 1]?.at ?? to);
    if (b - a >= 0.5) out.push(`<rect class="hit" x="${n(a)}" y="24" width="${n(b - a)}" height="${plotH}"><title>${esc(`From ${when(p.at)}: ${tip(p)}`)}</title></rect>`);
  });
  out.push(`<line class="now" x1="${n(x(to))}" x2="${n(x(to))}" y1="18" y2="${24 + plotH}"/><text class="axis" x="${n(x(to))}" y="14" text-anchor="middle">now</text>`);
  out.push('</svg>');
  return out.join('');
}

// Boxes and arrows in columns (the app's components as they run): nodes [{ id, label, sub, note }], edges
// [{ from, to, label }]. A node's column is one past the furthest node that points to it; nodes nothing points to
// start the first column.
export function components({ nodes, edges, width = 900, boxW = 190, boxH = 62, gapY = 26 }) {
  const level = Object.fromEntries(nodes.map((x) => [x.id, 0]));
  for (let k = 0; k < nodes.length; k++) for (const e of edges) if (level[e.to] !== undefined && level[e.from] !== undefined) level[e.to] = Math.max(level[e.to], level[e.from] + 1);
  const cols = Math.max(1, ...Object.values(level).map((v) => v + 1));
  const colW = cols > 1 ? Math.max(boxW + 60, (width - 40 - boxW) / (cols - 1)) : 0;
  const byCol = Array.from({ length: cols }, (_, c) => nodes.filter((x) => level[x.id] === c));
  const rows = Math.max(...byCol.map((c) => c.length));
  const height = 30 + rows * (boxH + gapY);
  const at = {};
  byCol.forEach((col, c) => col.forEach((x, r) => {
    const top = 20 + (height - 30 - col.length * (boxH + gapY) + gapY) / 2 + r * (boxH + gapY);
    at[x.id] = { x: 20 + c * colW, y: top };
  }));
  const out = [`<svg class="chart comp" viewBox="0 0 ${n(Math.max(width, 40 + (cols - 1) * colW + boxW))} ${height}" role="img"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>`];
  for (const e of edges) {
    const a = at[e.from];
    const b = at[e.to];
    if (!a || !b) continue;
    const x1 = a.x + boxW;
    const y1 = a.y + boxH / 2;
    const x2 = b.x;
    const y2 = b.y + boxH / 2;
    out.push(`<path class="edge" d="M${n(x1)},${n(y1)} C${n(x1 + 30)},${n(y1)} ${n(x2 - 30)},${n(y2)} ${n(x2 - 2)},${n(y2)}" marker-end="url(#arrow)"/>`);
    if (e.label) out.push(`<text class="axis" x="${n((x1 + x2) / 2)}" y="${n((y1 + y2) / 2 - 6)}" text-anchor="middle">${esc(e.label)}</text>`);
  }
  for (const x of nodes) {
    const p = at[x.id];
    out.push(`<g class="node${x.kind ? ` ${x.kind}` : ''}"><rect x="${n(p.x)}" y="${n(p.y)}" width="${boxW}" height="${boxH}" rx="8"/><text class="label" x="${n(p.x + 12)}" y="${n(p.y + 21)}"><tspan font-weight="600">${esc(x.label)}</tspan></text>${x.sub ? `<text class="axis" x="${n(p.x + 12)}" y="${n(p.y + 38)}">${esc(x.sub)}</text>` : ''}${x.note ? `<text class="axis" x="${n(p.x + 12)}" y="${n(p.y + 53)}">${esc(x.note)}</text>` : ''}${x.title ? `<title>${esc(x.title)}</title>` : ''}</g>`);
  }
  out.push('</svg>');
  return out.join('');
}

// One row per ticket from its start to its merge (or now), its agents as thin bars inside.
export function gantt({ rows, from, to, width = 900, labelW = 190, rowH = 22 }) {
  const plotW = width - labelW - 20;
  const x = (t) => labelW + ((t - from) / Math.max(1, to - from)) * plotW;
  const height = 24 + rows.length * rowH + 4;
  const out = [`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`];
  for (const { t, label } of timeTicks(from, to)) out.push(`<line class="grid" x1="${n(x(t))}" x2="${n(x(t))}" y1="18" y2="${height - 4}"/><text class="axis" x="${n(x(t))}" y="12" text-anchor="middle">${esc(label)}</text>`);
  rows.forEach((r, i) => {
    const y = 24 + i * rowH;
    out.push(`<text class="label" x="${labelW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(r.label)}</text>`);
    out.push(`<rect class="${r.open ? 'g-open' : 'g-ticket'}" x="${n(x(r.from))}" y="${y + 3}" width="${n(Math.max(2, x(r.to) - x(r.from)))}" height="${rowH - 6}" rx="3"><title>${esc(r.title)}</title></rect>`);
    for (const [a, b] of r.bars) out.push(`<rect class="g-agent" x="${n(x(a))}" y="${y + rowH / 2 - 2}" width="${n(Math.max(1, x(b) - x(a)))}" height="4"/>`);
  });
  out.push('</svg>');
  return out.join('');
}

// Lines that step up at each moment something was done, against their totals (dashed), with the forecast
// as a dotted line to the total and its range as a band.
export function burnup({ series, from, to, forecast = null, width = 900, height = 260 }) {
  const left = 40;
  const right = 20;
  const plotW = width - left - right;
  const plotH = height - 50;
  const end = Math.max(to, forecast?.hi ?? 0);
  const x = (t) => left + ((t - from) / Math.max(1, end - from)) * plotW;
  const max = Math.max(1, ...series.map((s) => s.total));
  const y = (v) => 24 + plotH - (v / max) * plotH;
  const out = [`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`];
  for (const { t, label } of timeTicks(from, end)) out.push(`<line class="grid" x1="${n(x(t))}" x2="${n(x(t))}" y1="24" y2="${24 + plotH}"/><text class="axis" x="${n(x(t))}" y="${height - 8}" text-anchor="middle">${esc(label)}</text>`);
  const s = step(max);
  for (let v = 0; v <= max + 1e-9; v += s) out.push(`<text class="axis" x="${left - 6}" y="${n(y(v) + 4)}" text-anchor="end">${v}</text>`);
  if (forecast) out.push(`<rect class="f-band" x="${n(x(forecast.lo))}" y="18" width="${n(Math.max(2, x(forecast.hi) - x(forecast.lo)))}" height="${plotH + 6}"><title>${esc(forecast.title)}</title></rect>`);
  for (const sr of series) {
    out.push(`<line class="total ${sr.cls}" x1="${left}" x2="${left + plotW}" y1="${n(y(sr.total))}" y2="${n(y(sr.total))}"/><text class="note ${sr.cls}-text" x="${left + 4}" y="${n(y(sr.total) - 4)}">${esc(`${sr.label}: ${sr.total}`)}</text>`);
    let d = `M${n(x(from))},${n(y(0))}`;
    sr.times.forEach((t, i) => { d += ` H${n(x(t))} V${n(y(i + 1))}`; });
    d += ` H${n(x(to))}`;
    out.push(`<path class="line ${sr.cls}" d="${d}"><title>${esc(`${sr.label}: ${sr.times.length} of ${sr.total} done`)}</title></path>`);
    if (forecast && sr.forecast) out.push(`<line class="forecast ${sr.cls}" x1="${n(x(to))}" y1="${n(y(sr.times.length))}" x2="${n(x(forecast.mid))}" y2="${n(y(sr.total))}"/>`);
  }
  out.push(`<line class="now" x1="${n(x(to))}" x2="${n(x(to))}" y1="18" y2="${24 + plotH}"/><text class="axis" x="${n(x(to))}" y="14" text-anchor="middle">now</text>`);
  out.push('</svg>');
  return out.join('');
}

// The project over time, one row per day: rows [{ label, day, from, to, right, lanes: [[{ from, to, cls, title }]],
// marks: [{ at, title }], shots: [{ at, title, href }] }], the hours lo..hi (milliseconds after midnight) across.
// Each lane is a thin band; a segment is at least 1.5 units wide, so a short wait still shows. Marks are small
// triangles above the row; shots are small cameras below it that link to the picture.
export function dayStrips({ rows, lo, hi, laneLabels = [], width = 900, labelW = 120, rightW = 210, laneH = 11, gap = 3 }) {
  const plotW = width - labelW - rightW;
  const x = (t, day) => labelW + ((t - day - lo) / Math.max(1, hi - lo)) * plotW;
  const lanes = Math.max(1, ...rows.map((r) => r.lanes.length));
  const rowH = 8 + lanes * laneH + (lanes - 1) * gap + 12;
  const height = 22 + rows.length * rowH;
  const H = 3600000;
  const every = hi - lo <= 8 * H ? H : hi - lo <= 16 * H ? 2 * H : 3 * H;
  const out = [`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`];
  for (let t = Math.ceil(lo / every) * every; t <= hi; t += every) {
    const at = labelW + ((t - lo) / Math.max(1, hi - lo)) * plotW;
    out.push(`<line class="grid" x1="${n(at)}" x2="${n(at)}" y1="16" y2="${height - 4}"/><text class="axis" x="${n(at)}" y="11" text-anchor="middle">${hour(Math.floor(t / H))}</text>`);
  }
  rows.forEach((r, i) => {
    const top = 22 + i * rowH + 8;
    out.push(`<text class="label" x="4" y="${top + (lanes * laneH + (lanes - 1) * gap) / 2 + 4}">${esc(r.label)}</text>`);
    r.lanes.forEach((segs, j) => {
      const y = top + j * (laneH + gap);
      if (laneLabels[j]) out.push(`<text class="axis" x="${labelW - 6}" y="${y + laneH - 2}" text-anchor="end">${esc(laneLabels[j])}</text>`);
      out.push(`<rect class="lane" x="${n(x(r.from, r.day))}" y="${y}" width="${n(Math.max(0, x(r.to, r.day) - x(r.from, r.day)))}" height="${laneH}"/>`);
      for (const s of segs) out.push(`<rect class="${s.cls}" x="${n(x(s.from, r.day))}" y="${y}" width="${n(Math.max(1.5, x(s.to, r.day) - x(s.from, r.day)))}" height="${laneH}"><title>${esc(s.title)}</title></rect>`);
    });
    for (const m of r.marks || []) {
      const at = x(m.at, r.day);
      out.push(`<path class="mark" d="M${n(at - 4)},${top - 7} H${n(at + 4)} L${n(at)},${top - 1} Z"><title>${esc(m.title)}</title></path>`);
    }
    // Pictures: a small camera under the lanes, a link to the picture.
    const bottom = top + lanes * laneH + (lanes - 1) * gap;
    for (const s of r.shots || []) {
      const at = x(s.at, r.day);
      out.push(`<a href="${esc(s.href)}" class="shot-mk"><title>${esc(s.title)}</title><rect x="${n(at - 5)}" y="${bottom + 3}" width="10" height="7" rx="1.5"/><rect x="${n(at - 2)}" y="${bottom + 1.5}" width="4" height="2" rx=".5"/><circle class="lens" cx="${n(at)}" cy="${bottom + 6.5}" r="2"/></a>`);
    }
    if (r.right) out.push(`<text class="note" x="${width - rightW + 8}" y="${top + (lanes * laneH + (lanes - 1) * gap) / 2 + 4}">${esc(r.right)}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}
