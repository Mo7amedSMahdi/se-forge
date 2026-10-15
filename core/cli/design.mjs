// forge design sample: exact colours from a provided screen (decisions 49, 68). Read-only.
//   forge design sample <image> [--at x,y ...] [--region x,y,w,h] [--top N]
// PNG is decoded here (zlib, no dependencies). JPEG, PDF and other formats are converted to PNG first
// with macOS's sips, or ImageMagick (magick) where installed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

export class DesignError extends Error {}

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// { width, height, rgb(x, y) -> [r, g, b] } for an 8-bit, non-interlaced PNG.
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new DesignError('not a PNG file');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    if (kind === 'PLTE') palette = data;
    if (kind === 'IDAT') idat.push(data);
    if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !(type in CHANNELS)) throw new DesignError(`unsupported PNG (bit depth ${depth}, colour type ${type}, interlace ${interlace}): convert it to an 8-bit PNG`);
  const bpp = CHANNELS[type];
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[y * stride + i - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= bpp && y > 0 ? px[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + i] = v & 0xff;
    }
  }
  const rgb = (x, y) => {
    const o = y * stride + x * bpp;
    if (type === 2 || type === 6) return [px[o], px[o + 1], px[o + 2]];
    if (type === 3) return [palette[px[o] * 3], palette[px[o] * 3 + 1], palette[px[o] * 3 + 2]];
    return [px[o], px[o], px[o]];
  };
  return { width, height, rgb };
}

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

// Any image as PNG bytes: PNG as is, anything else through sips (macOS) or ImageMagick.
function pngBytes(file) {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8).equals(SIG)) return buf;
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-design-')), 'page.png');
  const tries = [['sips', ['-s', 'format', 'png', file, '--out', out]], ['magick', [`${file}[0]`, out]]];
  for (const [cmd, args] of tries) {
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    if (r.status === 0 && fs.existsSync(out)) return fs.readFileSync(out);
  }
  throw new DesignError(`${path.basename(file)} is not a PNG and neither sips (macOS) nor ImageMagick could convert it`);
}

export function sample(file, { at = [], region = null, top = 12 } = {}) {
  const img = decodePng(pngBytes(file));
  const lines = [`${path.basename(file)}: ${img.width} x ${img.height}`];
  for (const p of at) {
    const [x, y] = p.split(',').map(Number);
    if (!(x >= 0 && y >= 0 && x < img.width && y < img.height)) throw new DesignError(`--at ${p} is outside the image`);
    lines.push(`at ${x},${y}: ${hex(img.rgb(x, y))}`);
  }
  if (!at.length) {
    const [rx, ry, rw, rh] = region ? region.split(',').map(Number) : [0, 0, img.width, img.height];
    const counts = new Map();
    for (let y = ry; y < Math.min(ry + rh, img.height); y++) {
      for (let x = rx; x < Math.min(rx + rw, img.width); x++) {
        const k = hex(img.rgb(x, y));
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    const total = [...counts.values()].reduce((s, n) => s + n, 0);
    lines.push(`palette${region ? ` of ${region}` : ''} (most used first):`);
    for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, top)) lines.push(`  ${k}  ${((100 * n) / total).toFixed(1)}%`);
  }
  return lines.join('\n');
}
