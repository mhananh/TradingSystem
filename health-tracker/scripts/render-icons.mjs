// Renders PNG icons from the SVGs with the preinstalled Chromium (no extra deps).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Playwright is preinstalled globally in the dev environment; require() resolves it via NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');

const jobs = [
  ['public/icons/icon.svg', 'public/icons/icon-192.png', 192],
  ['public/icons/icon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/maskable.svg', 'public/icons/icon-maskable-512.png', 512],
  ...(process.argv.includes('--android')
    ? [
        ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192],
      ].flatMap(([d, s]) => [
        ['public/icons/icon.svg', `android/app/src/main/res/mipmap-${d}/ic_launcher.png`, s],
        ['public/icons/icon.svg', `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, s],
        ['public/icons/maskable.svg', `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, Math.round(s * 2.25)],
      ])
    : []),
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = readFileSync(src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', out);
}
await browser.close();

// Android splash screens: replace Capacitor's default splash.png files (same sizes) with brand colours + icon.
if (process.argv.includes('--android')) {
  const { globSync } = await import('node:fs');
  const files = globSync('android/app/src/main/res/drawable*/splash.png');
  const b2 = await chromium.launch();
  const pg = await b2.newPage();
  const icon = readFileSync('public/icons/icon.svg', 'utf8');
  for (const f of files) {
    const buf = readFileSync(f);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const s = Math.round(Math.min(w, h) * 0.28);
    await pg.setViewportSize({ width: w, height: h });
    await pg.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;background:#f4efe6;display:flex;align-items:center;justify-content:center">${icon.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
    writeFileSync(f, await pg.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
    console.log('wrote', f, w, h);
  }
  await b2.close();
}
