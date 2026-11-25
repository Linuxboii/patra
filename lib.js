// PDF operations on top of pdf-lib. No DOM, so they run under node --test.
import { PDFDocument, degrees } from './vendor/pdf-lib.esm.min.js';

/** "1-3, 5, 8-" to zero-based page indexes, in the order written. */
export function parseRanges(spec, count) {
  const s = String(spec).trim().toLowerCase();
  if (!s) throw new Error('Enter which pages, like 1-3, 5');
  if (s === 'all') return [...Array(count).keys()];
  const out = [];
  for (const raw of s.split(',')) {
    const part = raw.trim().replace(/last/g, String(count));
    if (!part) continue;
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    let a, b;
    if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : count; }
    else if (/^\d+$/.test(part)) { a = b = +part; }
    else throw new Error(`"${raw.trim()}" is not a page or range`);
    if (a < 1 || b < 1 || a > count || b > count) throw new Error(`Pages go from 1 to ${count}`);
    const step = a <= b ? 1 : -1;
    for (let i = a; i !== b + step; i += step) out.push(i - 1);
  }
  if (!out.length) throw new Error('No pages selected');
  return out;
}

export const chunks = (count, size) => Array.from({ length: Math.ceil(count / size) }, (_, i) => [...Array(Math.min(size, count - i * size)).keys()].map((k) => k + i * size));

const load = (bytes) => PDFDocument.load(bytes, { ignoreEncryption: true });

/** items: [{ kind: 'pdf' | 'jpg' | 'png', bytes }] -> merged PDF bytes. Images get their own page. */
export async function merge(items, { a4Images = true } = {}) {
  const out = await PDFDocument.create();
  for (const it of items) {
    if (it.kind === 'pdf') {
      const src = await load(it.bytes);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else {
      const img = it.kind === 'png' ? await out.embedPng(it.bytes) : await out.embedJpg(it.bytes);
      if (a4Images) {
        const landscape = img.width > img.height;
        const [W, H] = landscape ? [841.89, 595.28] : [595.28, 841.89];
        const m = 28;
        const k = Math.min((W - 2 * m) / img.width, (H - 2 * m) / img.height);
        const w = img.width * k, h = img.height * k;
        out.addPage([W, H]).drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
      } else {
        out.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
    }
  }
  return out.save();
}

export async function pageCount(bytes) {
  return (await load(bytes)).getPageCount();
}

export async function extract(bytes, indexes) {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indexes);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function rotate(bytes, indexes, angle) {
  const d = await load(bytes);
  for (const i of indexes) {
    const p = d.getPage(i);
    p.setRotation(degrees((p.getRotation().angle + angle + 360) % 360));
  }
  return d.save();
}
