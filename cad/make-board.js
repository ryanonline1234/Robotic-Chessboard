/*
 * Draws the board top at 1:1 scale in millimetres:
 *   board-sheet.svg   the playing surface to print and glue on the top panel
 *   board-layout.svg  the same with dimensions and the magnet's travel area
 *
 *   node cad/make-board.js [squareMm] [storageColumns]
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';

const square = Number(process.argv[2] ?? 40);
const storage = Number(process.argv[3] ?? 1);
const cols = 8 + 2 * storage;
const width = cols * square;
const height = 8 * square;
const margin = 40; // room for dimensions on the layout drawing

function cells() {
  const out = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < 8; y++) {
      const left = x * square;
      const top = (7 - y) * square;
      const file = x - storage;
      if (file < 0 || file > 7) {
        out.push(`<rect x="${left}" y="${top}" width="${square}" height="${square}" fill="#e3e6eb" stroke="#b9c0cb" stroke-width="0.4"/>`);
        out.push(`<circle cx="${left + square / 2}" cy="${top + square / 2}" r="${square * 0.3}" fill="none" stroke="#9aa3b1" stroke-width="0.5"/>`);
        continue;
      }
      const dark = (file + y) % 2 === 0;
      out.push(`<rect x="${left}" y="${top}" width="${square}" height="${square}" fill="${dark ? '#b38c65' : '#eadfc9'}"/>`);
      const ink = dark ? '#eadfc9' : '#b38c65';
      const size = square * 0.18;
      if (file === 0) out.push(`<text x="${left + 2}" y="${top + size + 1}" font-size="${size}" fill="${ink}">${y + 1}</text>`);
      if (y === 0) out.push(`<text x="${left + square - 2}" y="${top + square - 2}" font-size="${size}" fill="${ink}" text-anchor="end">${'abcdefgh'[file]}</text>`);
    }
  }
  out.push(`<rect x="${storage * square}" y="0" width="${8 * square}" height="${height}" fill="none" stroke="#5a4632" stroke-width="0.8"/>`);
  return out.join('\n');
}

function svg(w, h, offset, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" font-family="Arial, sans-serif">
<g transform="translate(${offset} ${offset})">
${body}
</g>
</svg>
`;
}

const sheet = svg(width, height, 0, cells());

const half = square / 2;
const layout = svg(width + 2 * margin, height + 2 * margin, margin, `${cells()}
<rect x="${half}" y="${half}" width="${width - square}" height="${height - square}" fill="none" stroke="#2b59f5" stroke-width="0.8" stroke-dasharray="4 3"/>
<text x="${width / 2}" y="${half - 3}" font-size="6" fill="#2b59f5" text-anchor="middle">magnet travel between cell centers: ${width - square} × ${height - square} mm</text>
<g stroke="#333" stroke-width="0.4" fill="#333" font-size="7" text-anchor="middle">
  <line x1="0" y1="${height + 12}" x2="${width}" y2="${height + 12}"/>
  <line x1="0" y1="${height + 8}" x2="0" y2="${height + 16}"/>
  <line x1="${width}" y1="${height + 8}" x2="${width}" y2="${height + 16}"/>
  <text x="${width / 2}" y="${height + 24}" stroke="none">${width} mm (${cols} cells of ${square} mm, ${storage} storage column${storage === 1 ? '' : 's'} each side)</text>
  <line x1="${width + 12}" y1="0" x2="${width + 12}" y2="${height}"/>
  <line x1="${width + 8}" y1="0" x2="${width + 16}" y2="0"/>
  <line x1="${width + 8}" y1="${height}" x2="${width + 16}" y2="${height}"/>
  <text x="${width + 24}" y="${height / 2}" stroke="none" transform="rotate(90 ${width + 24} ${height / 2})">${height} mm</text>
  <text x="${storage * square / 2}" y="-6" stroke="none">storage</text>
  <text x="${width - storage * square / 2}" y="-6" stroke="none">storage</text>
</g>`);

const here = new URL('.', import.meta.url);
writeFileSync(new URL('board-sheet.svg', here), sheet);
writeFileSync(new URL('board-layout.svg', here), layout);
console.log(`Wrote board-sheet.svg and board-layout.svg (${width} × ${height} mm)`);
