// Merges generated explanations (raw/explain/out/*.json: id -> {hy, ru, en}) into the
// question files as field `x` (explanation in that file's language).
// Usage: node merge-explain.mjs <explainOutDir> <dataDir>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [outDir, dataDir] = process.argv.slice(2);
const ex = {};
let bad = 0;
for (const f of fs.readdirSync(outDir).filter((f) => f.endsWith('.json')).sort()) {
  try { Object.assign(ex, JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'))); }
  catch (e) { bad++; console.error('invalid JSON:', f, e.message); }
}
const key = (q) => q.q + '|' + q.o.join('|') + '|' + (q.i || '') + '|' + q.a;
const id = (q) => crypto.createHash('sha1').update(key(q)).digest('hex').slice(0, 10);
const clean = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');

const missing = new Set();
for (const set of ['abc', 'dt']) {
  const hy = JSON.parse(fs.readFileSync(path.join(dataDir, `${set}.hy.json`), 'utf8'));
  const ids = hy.map((g) => g.qs.map((q) => id(q)));
  for (const lang of ['hy', 'ru', 'en']) {
    const file = path.join(dataDir, `${set}.${lang}.json`);
    const data = lang === 'hy' ? hy : JSON.parse(fs.readFileSync(file, 'utf8'));
    data.forEach((g, gi) => g.qs.forEach((q, qi) => {
      const e = ex[ids[gi][qi]];
      const t = e && clean(e[lang]);
      if (t) q.x = t; else { delete q.x; missing.add(`${ids[gi][qi]}:${lang}`); }
    }));
    fs.writeFileSync(file, JSON.stringify(data));
  }
}
console.log('explanations loaded:', Object.keys(ex).length, '| invalid files:', bad, '| missing (id:lang):', missing.size);
if (missing.size) console.log([...missing].slice(0, 30).join('\n'));
