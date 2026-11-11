// Extracts questions, options, answers and images from the roadpolice.am exam PDFs.
// Usage: node extract.mjs <rawPdfDir> <outDir>
//   rawPdfDir: contains {abc,dt}/{hy,ru,en}/{1..10}.pdf
//   outDir:    app/public/data  (writes <set>.<lang>.json + img/<hash>.webp)
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [rawDir, outDir] = process.argv.slice(2);
if (!rawDir || !outDir) throw new Error('usage: node extract.mjs <rawPdfDir> <outDir>');
const SETS = ['abc', 'dt'];
const LANGS = ['hy', 'ru', 'en'];
const GROUPS = 10;
const ANSWER_RE = /^(Պատ\.\s*[`՝']?|Ответ:|Answer:)\s*(\d+)\s*$/;
const imgDir = path.join(outDir, 'img');
fs.mkdirSync(imgDir, { recursive: true });

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

const getObj = (objs, name) => new Promise((res) => objs.get(name, res));
const written = new Set(fs.readdirSync(imgDir));

async function imageToWebp(img) {
  const { width, height, data, kind } = img;
  let channels, buf;
  if (kind === 3) { channels = 4; buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength); }
  else if (kind === 2) { channels = 3; buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength); }
  else if (kind === 1) { // 1bpp grayscale -> 8bit
    channels = 1; buf = Buffer.alloc(width * height);
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
      buf[y * width + x] = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
  } else throw new Error('unknown image kind ' + kind);
  let s = sharp(buf, { raw: { width, height, channels } });
  if (width > 1000) s = s.resize({ width: 1000 });
  return s.webp({ quality: 78, effort: 5 }).toBuffer();
}

async function pageImages(page) {
  const ops = await page.getOperatorList();
  const out = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject) {
      const name = args[0];
      const img = name.startsWith('g_') ? await getObj(page.commonObjs, name) : await getObj(page.objs, name);
      const xs = [ctm[4], ctm[4] + ctm[0] + ctm[2]], ys = [ctm[5], ctm[5] + ctm[1] + ctm[3]];
      out.push({ img, top: Math.max(...ys), bottom: Math.min(...ys), left: Math.min(...xs), w: Math.abs(xs[1] - xs[0]) });
    }
  }
  return out;
}

async function parsePdf(file) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0, isOffscreenCanvasSupported: false }).promise;
  // Build a flat stream of events in reading order.
  const events = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const H = page.getViewport({ scale: 1 }).height;
    for (const it of tc.items) {
      const s = it.str.trim();
      if (!s) continue;
      const x = Math.round(it.transform[4]), y = it.transform[5];
      if (y < 35 || (p > 1 && y > H - 40) || (p === 1 && y > 720)) continue; // headers/footers
      events.push({ p, y, x, type: 'text', s, font: it.fontName });
    }
    for (const im of await pageImages(page)) {
      if (im.w < 20) continue;
      events.push({ p, y: im.top, x: im.left, type: 'img', im });
    }
    page.cleanup();
  }
  events.sort((a, b) => a.p - b.p || b.y - a.y || a.x - b.x);

  const qs = [];
  let q = null, cur = null; // cur = 'q' | option index
  for (const e of events) {
    if (e.type === 'img') { if (q) q.imgs.push(e.im); continue; }
    if (e.x < 60 && /^\d+\.$/.test(e.s)) {
      q = { n: +e.s.slice(0, -1), text: '', opts: [], ans: 0, imgs: [], bold: [] };
      qs.push(q); cur = 'q'; continue;
    }
    if (!q) continue;
    const m = e.s.match(ANSWER_RE);
    if (m && e.x < 85) { q.ans = +m[2]; cur = null; continue; }
    if (e.x >= 60 && e.x < 85 && /^\d+\.$/.test(e.s)) {
      q.opts.push(''); q.bold.push(e.font); cur = q.opts.length - 1; continue;
    }
    if (cur === 'q') q.text = (q.text + ' ' + e.s).trim();
    else if (typeof cur === 'number') q.opts[cur] = (q.opts[cur] + ' ' + e.s).trim();
  }
  await doc.destroy();
  return qs;
}

async function saveImg(im) {
  const webp = await imageToWebp(im.img);
  const hash = crypto.createHash('sha1').update(webp).digest('hex').slice(0, 12);
  const name = hash + '.webp';
  if (!written.has(name)) { fs.writeFileSync(path.join(imgDir, name), webp); written.add(name); }
  return name;
}

const report = [];
for (const set of SETS) {
  for (const lang of LANGS) {
    const groups = [];
    for (let g = 1; g <= GROUPS; g++) {
      const file = path.join(rawDir, set, lang, `${g}.pdf`);
      const qs = await parsePdf(file);
      const out = [];
      for (const q of qs) {
        const imgs = [];
        for (const im of q.imgs) imgs.push(await saveImg(im));
        out.push({ n: q.n, q: q.text, o: q.opts, a: q.ans, ...(imgs.length ? { i: imgs } : {}) });
        if (!q.ans || q.ans > q.opts.length || !q.text || q.opts.some((o) => !o))
          report.push(`${set}/${lang}/${g} #${q.n}: ans=${q.ans} opts=${q.opts.length} text=${!!q.text}`);
      }
      groups.push({ g, qs: out });
      console.log(set, lang, g, out.length, 'questions', out.filter((x) => x.i).length, 'with images');
    }
    fs.writeFileSync(path.join(outDir, `${set}.${lang}.json`), JSON.stringify(groups));
  }
}
console.log('issues:', report.length);
for (const r of report.slice(0, 50)) console.log('  ' + r);
