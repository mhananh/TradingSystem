// End-to-end smoke test on the production build at phone sizes. Run: npm run build && node scripts/e2e.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const OUT = process.env.SHOTS ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => String(d).includes('Local') && r()); setTimeout(r, 8000); });

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true });
  const page = await ctx.newPage();
  const foreign = [];
  page.on('request', (req) => { const u = new URL(req.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) foreign.push(req.url()); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const noHScroll = async (label) => {
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(`no horizontal scroll: ${label}`, sw <= iw, `(${sw} ≤ ${iw})`);
  };

  await page.goto(BASE);
  await page.getByText('Jejak Sehat').first().waitFor();
  await page.screenshot({ path: `${OUT}/01-onboarding.png`, fullPage: true });
  await noHScroll('onboarding');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Lanjut' }).click();
  const bmrText = await page.locator('text=BMR (perkiraan)').locator('..').innerText();
  check('BMR 1850 shown for initial profile', /1\.850/.test(bmrText), bmrText.replace(/\n/g, ' '));
  const tdeeText = await page.locator('text=TDEE (perkiraan)').locator('..').innerText();
  check('TDEE 2220 shown', /2\.220/.test(tdeeText));
  check('macro total 1699 shown', await page.getByText('1.699 kkal').count() > 0);
  await page.screenshot({ path: `${OUT}/02-onboarding-gizi.png`, fullPage: true });
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: 'Mulai' }).click();
  await page.getByText('Angka hari ini').waitFor();
  await page.screenshot({ path: `${OUT}/03-beranda-kosong.png`, fullPage: true });
  await noHScroll('beranda');
  check('start weight logged as first weigh-in', await page.getByText('90 kg').count() + (await page.getByText(/90\b/).count()) > 0);

  // Daily log
  await page.goto(`${BASE}#/catat`);
  await page.getByText('Berat & pinggang').waitFor();
  if (!(await page.getByLabel('Berat', { exact: true }).isVisible())) await page.getByText('Berat & pinggang').click();
  await page.getByLabel('Berat', { exact: true }).fill('89,6');
  await page.getByText('Makan & makro').click();
  await page.getByLabel('Kalori', { exact: true }).fill('1650');
  await page.getByLabel('Protein', { exact: true }).fill('112');
  await page.getByText('Tidur semalam').click();
  await page.getByLabel('Tidur jam').fill('23:30');
  await page.getByLabel('Bangun jam').fill('05:45');
  await page.getByText(/Tersimpan \d/).waitFor({ timeout: 5000 });
  check('autosave shows saved state', true);
  check('sleep across midnight = 6 j 15 mnt', await page.getByText('≈ 6 j 15 mnt').waitFor({ timeout: 3000 }).then(() => true).catch(() => false));
  await page.screenshot({ path: `${OUT}/04-catat.png`, fullPage: true });
  await noHScroll('catat');

  // Meals add up
  await page.getByRole('button', { name: 'Favorit & contoh', exact: true }).click();
  await page.getByRole('button', { name: /Nasi putih/ }).click();
  await page.getByRole('button', { name: 'Favorit & contoh', exact: true }).click();
  await page.getByRole('button', { name: /Telur rebus/ }).click();
  await page.getByText(/Total: 225/).waitFor({ timeout: 4000 });
  check('meals add up (150 + 75 = 225 kkal)', true);

  // IF off completely
  await page.goto(`${BASE}#/pengaturan`);
  await page.getByText('Puasa, Ramadan, tidur & langkah').click();
  await page.getByRole('switch', { name: /Puasa intermiten/ }).click();
  await page.getByRole('button', { name: 'Simpan perubahan' }).first().click();
  await page.goto(`${BASE}#/beranda`);
  check('IF can be turned off ("IF tidak aktif")', await page.getByText('IF tidak aktif').waitFor({ timeout: 4000 }).then(() => true).catch(() => false));

  // Persistence across reload
  await page.reload();
  await page.goto(`${BASE}#/catat`);
  await page.getByText('Berat & pinggang').waitFor();
  check('data persists after reload', (await page.getByText('89,6 kg').count()) > 0);

  for (const [tab, file] of [['progres', '05-progres'], ['kesehatan', '06-kesehatan'], ['kesehatan/latihan', '07-latihan'], ['pengaturan', '08-pengaturan']]) {
    await page.goto(`${BASE}#/${tab}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
    await noHScroll(tab);
  }

  // Export JSON, wipe, import back
  await page.goto(`${BASE}#/pengaturan`);
  await page.getByText('Data: backup, impor, hapus').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh backup JSON' }).click()]);
  const backupPath = `${OUT}/backup.json`;
  await dl.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  check('JSON export contains the day', backup.days.some((d) => d.weightKg === 89.6));
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV harian' }).click()]);
  await csvDl.saveAs(`${OUT}/harian.csv`);
  const csv = readFileSync(`${OUT}/harian.csv`, 'utf8');
  check('CSV export readable with BOM + header', csv.charCodeAt(0) === 0xfeff && csv.includes('tanggal;berat_kg'));

  // Malformed import rejected
  writeFileSync(`${OUT}/bad.json`, '{"app":"jejak-sehat","days":[{"date":"bukan-tanggal"}]}');
  const [fc1] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Impor backup JSON' }).click()]);
  await fc1.setFiles(`${OUT}/bad.json`);
  await page.getByText('Impor ditolak').waitFor({ timeout: 4000 });
  check('malformed import rejected safely', true);

  // Delete all, then import
  await page.getByRole('button', { name: 'Hapus semua data' }).click();
  await page.getByLabel(/Ketik "HAPUS"/).fill('HAPUS');
  await page.getByRole('button', { name: 'Hapus semuanya' }).click();
  await page.getByText('Selamat datang').first().waitFor({ timeout: 5000 });
  check('delete all → back to onboarding', true);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Lanjut' }).click();
  await page.getByRole('button', { name: 'Mulai' }).click();
  await page.goto(`${BASE}#/pengaturan`);
  await page.getByText('Data: backup, impor, hapus').click();
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Impor backup JSON' }).click()]);
  await fc2.setFiles(backupPath);
  await page.getByText('Pratinjau impor').waitFor();
  await page.screenshot({ path: `${OUT}/09-impor.png` });
  await page.getByRole('button', { name: 'Impor sekarang' }).click();
  await page.goto(`${BASE}#/catat`);
  await page.getByText('Berat & pinggang').waitFor();
  check('import restores data', (await page.getByText('89,6 kg').count()) > 0);

  // Offline app shell
  await page.goto(BASE);
  await page.evaluate(async () => { await navigator.serviceWorker?.ready; });
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  const offlineOk = await page.getByText(/Offline/).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  check('app shell loads offline + offline indicator', offlineOk);
  await page.screenshot({ path: `${OUT}/10-offline.png` });
  await ctx.setOffline(false);

  check('no external network requests', foreign.length === 0, foreign.slice(0, 3).join(' '));
  check('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  // Other phone widths
  for (const w of [390, 430]) {
    const p2 = await ctx.newPage();
    await p2.setViewportSize({ width: w, height: 860 });
    for (const tab of ['beranda', 'catat', 'progres', 'kesehatan', 'pengaturan']) {
      await p2.goto(`${BASE}#/${tab}`);
      await p2.waitForTimeout(300);
      const { sw, iw } = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      check(`no horizontal scroll @${w}px: ${tab}`, sw <= iw);
    }
    await p2.close();
  }
} catch (e) {
  check('e2e run', false, String(e).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
