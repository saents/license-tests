import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
const file = process.argv[2]; const maxPages = +(process.argv[3]||2);
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
console.log('pages', doc.numPages);
for (let p = 1; p <= Math.min(maxPages, doc.numPages); p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  console.log(`--- page ${p} ${vp.width}x${vp.height}`);
  const tc = await page.getTextContent();
  const styles = tc.styles;
  for (const it of tc.items) if (it.str.trim()) console.log(Math.round(it.transform[4]), Math.round(it.transform[5]), it.fontName, styles[it.fontName]?.fontFamily, JSON.stringify(it.str));
  const ops = await page.getOperatorList();
  const imgs = ops.fnArray.map((f,i)=>[f,i]).filter(([f])=>f===OPS.paintImageXObject||f===OPS.paintInlineImageXObject).length;
  const fills = ops.fnArray.filter(f=>f===OPS.setFillRGBColor).length;
  console.log('images', imgs, 'fillColorOps', fills);
}
