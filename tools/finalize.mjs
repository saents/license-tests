// Post-processes extracted JSON: single image field + intrinsic dimensions (prevents layout shift).
// Usage: node finalize.mjs <dataDir>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const dims = {};
for (const f of fs.readdirSync(path.join(dir, 'img'))) {
  const m = await sharp(path.join(dir, 'img', f)).metadata();
  dims[f] = [m.width, m.height];
}
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const groups = JSON.parse(fs.readFileSync(path.join(dir, f)));
  for (const g of groups) for (const q of g.qs) {
    const img = Array.isArray(q.i) ? q.i[0] : q.i;
    delete q.i; delete q.w; delete q.h;
    if (img) Object.assign(q, { i: img, w: dims[img][0], h: dims[img][1] });
  }
  fs.writeFileSync(path.join(dir, f), JSON.stringify(groups));
}
console.log('images', Object.keys(dims).length);
