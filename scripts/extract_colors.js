require('dotenv').config();
const sharp = require('sharp');
const path = require('path');

async function extractColors(filePath, label) {
  const img = sharp(filePath);
  const { data, info } = await img.resize(200, 200, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });

  const colorMap = {};
  const channels = info.channels;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i+1], b = data[i+2], a = channels === 4 ? data[i+3] : 255;
    if (a < 30) continue; // skip transparent
    // quantize to nearest 16
    const qr = Math.round(r/16)*16, qg = Math.round(g/16)*16, qb = Math.round(b/16)*16;
    if (qr > 230 && qg > 230 && qb > 230) continue; // skip near-white
    if (qr < 20 && qg < 20 && qb < 20) continue;    // skip near-black
    const key = `${qr},${qg},${qb}`;
    colorMap[key] = (colorMap[key] || 0) + 1;
  }

  const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\n=== ${label} ===`);
  sorted.forEach(([k, v]) => {
    const [r, g, b] = k.split(',').map(Number);
    const hex = '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
    console.log(`  ${hex}  (${v} px)  rgb(${k})`);
  });
}

async function run() {
  await extractColors('public/images/logo.svg', 'logo.svg (deployed)');
  await extractColors('predictvilladownloadfile.png.svg', 'predictvilladownloadfile (original download)');
  await extractColors('predictvila.svg.svg', 'predictvila.svg (alternative)').catch(()=>console.log('predictvila.svg skip'));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
