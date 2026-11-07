# Jejak Sehat

Pelacak kesehatan & penurunan berat badan pribadi: berat, makan, tidur, GERD, puasa, aktivitas, dan hubungan di antaranya. Tersedia sebagai **aplikasi Android (APK)** dan **web (PWA)**. Semua data tersimpan di perangkatmu.

> Alat bantu pencatatan & perencanaan, **bukan alat medis**. Semua angka kalori, TDEE, dan proyeksi adalah perkiraan.

Spesifikasi lengkap: [`docs/SPEC.md`](docs/SPEC.md).

---

## 1. Pasang di HP Android (cara termudah)

1. Di HP, buka halaman **Releases** repo ini di GitHub: `https://github.com/mhananh/TradingSystem/releases` → pilih rilis "Jejak Sehat v…" terbaru.
2. Unduh file **`JejakSehat-….apk`**.
3. Buka file itu. Android akan bertanya soal "Instal aplikasi tidak dikenal" → izinkan untuk browser/File Manager → **Instal**.
   Play Protect mungkin memperingatkan karena aplikasi tidak dari Play Store; pilih "Tetap instal".
4. Buka **Jejak Sehat**. Profil awal sudah terisi; periksa dan ubah bila perlu.

**Update:** pasang APK versi baru di atas versi lama — data tetap ada. *Jangan uninstall dulu* (uninstall menghapus data).

### Agar GitHub bisa membuat APK otomatis (sekali saja)
APK release ditandatangani dengan "kunci tanda tangan" yang **sama** setiap kali; kalau berganti, update tidak bisa dipasang di atas versi lama. Karena repo ini publik, kunci tidak disimpan di kode tetapi di **GitHub Secrets**:

1. GitHub → repo ini → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Buat secret `ANDROID_KEYSTORE_BASE64` → tempel isi file `keystore-base64.txt` (dikirim terpisah, jangan dibagikan).
3. Buat secret `ANDROID_KEYSTORE_PASSWORD` → tempel isi `password.txt`.
4. Simpan juga kedua file itu di tempat aman (mis. Google Drive pribadi). Tanpa kunci ini, versi baru tidak bisa dipasang di atas aplikasi lama.

Setelah itu, setiap perubahan pada folder `health-tracker/` otomatis membuat rilis APK baru (tab **Actions** → *Jejak Sehat – Android APK*).

## 2. Hubungkan Huawei Band 10

Huawei Health belum punya sinkron resmi ke Health Connect (per Nov 2026), jadi dipakai aplikasi perantara:

1. Pastikan Band tersinkron ke **Huawei Health**.
2. Pasang **Health Sync** (Play Store). Pilih sumber: Huawei Health → tujuan: **Health Connect**. Pakai trial 1 minggu dulu untuk memastikan data tidur & nadi Band-mu terbawa.
3. Di Jejak Sehat: **Pengaturan → Jam tangan & Health Connect → Izinkan Health Connect** → aktifkan *Sinkron otomatis*.
4. Data yang tidak terbawa (mis. SpO2): di **Catat → Screenshot jam**, pilih screenshot Huawei Health, AI membaca angkanya.

Aturan: data jam tidak pernah menimpa isian manual tanpa kamu ubah sendiri.

## 3. Fitur AI (opsional)

Foto makanan → perkiraan kalori, foto label gizi, baca screenshot jam, review mingguan, saran menu.

- **Claude:** butuh API key dari [console.anthropic.com](https://console.anthropic.com) (isi saldo, buat key, **pasang spend limit**). Langganan Claude Pro/Max **tidak** bisa dipakai di aplikasi buatan sendiri. Bawaan: *Claude Haiku 5.5* (effort low) untuk foto/screenshot, *Claude Sonnet 5.5* (effort low) untuk review & menu. Perkiraan biaya untuk ±4 foto/hari dengan Haiku: sangat kecil (sekitar US$0,001 per foto); Sonnet ±US$0,01–0,02 per panggilan.
- **Gemini:** key dari [aistudio.google.com](https://aistudio.google.com). Catatan: pada tingkat gratis, Google dapat memakai data yang dikirim untuk meningkatkan produknya.
- Isi di **Pengaturan → AI**, setujui, lalu **Tes koneksi**. Key disimpan terenkripsi di HP (Android Keystore), tidak pernah di kode.
- Yang dikirim: foto/screenshot yang kamu pilih, atau ringkasan statistik mingguan. Catatan bebas & identitas tidak dikirim. Hasil AI selalu bisa diedit sebelum disimpan.

## 4. Data, backup, dan privasi

- Data disimpan di penyimpanan lokal aplikasi (IndexedDB). Backup cloud Android **dimatikan** untuk aplikasi ini agar data kesehatan tidak keluar tanpa sepengetahuanmu.
- **Backup:** Pengaturan → Data → *Backup JSON* → bagikan ke Google Drive/WhatsApp. Aktifkan pengingat backup mingguan.
- **Pulihkan:** Pengaturan → Data → *Impor backup JSON* → pratinjau → pilih *Gabung* atau *Ganti* → konfirmasi. File rusak ditolak tanpa mengubah data.
- **CSV:** harian, makanan, GERD (format Excel Indonesia `;` atau standar `,`).
- **Hapus semua:** Pengaturan → Data → Hapus semua data (ketik HAPUS).
- Uninstall aplikasi / hapus data aplikasi = data hilang. Backup berkala!

## 5. Untuk developer

```bash
cd health-tracker
npm install
npm run dev          # http://localhost:5173
npm test             # unit test (Vitest)
npm run lint
npm run build        # build web/PWA ke dist/
npm run preview      # sajikan build produksi
node scripts/e2e.mjs # uji end-to-end di 360/390/430 px (butuh Playwright + build)
```

Android (butuh JDK 21 + Android SDK, `ANDROID_HOME`):

```bash
npm run build && npx cap sync android
cd android
# APK debug:
./gradlew assembleDebug
# APK release bertanda tangan:
ANDROID_KEYSTORE_PATH=/path/jejaksehat-release.keystore ANDROID_KEYSTORE_PASSWORD=... ./gradlew assembleRelease
```

Versi web (PWA) bisa dipublikasikan ke GitHub Pages lewat workflow manual *Jejak Sehat – Web (GitHub Pages)* (aktifkan dulu Settings → Pages → Source: GitHub Actions). Instal dari Chrome: menu ⋮ → *Instal aplikasi*.

Struktur: `src/domain` (model & kalkulasi murni), `src/db` (Dexie), `src/ai` (Claude/Gemini), `src/integrations` (Health Connect, notifikasi, kalender), `src/pages`, `src/components`, `src/copy` (semua teks kesehatan), `tests/`.

## 6. Keterbatasan

- Prediksi & TDEE adalah model kasar; tanggal selesai tidak pernah pasti. TDEE terobservasi baru muncul setelah ±3–4 minggu catatan konsisten.
- Perkiraan kalori dari foto bisa meleset besar (minyak, santan, porsi). Ditampilkan sebagai rentang.
- Data Huawei bergantung pada Health Sync (pihak ketiga); SpO2/nadi kontinu mungkin tidak selalu terbawa.
- Pengingat yang muncul saat aplikasi tertutup hanya di APK Android, bukan versi web.
- Tanggal Ramadan/Idul Fitri 2027 adalah perkiraan; ubah sesuai penetapan resmi.
- Aplikasi tidak mendiagnosis apa pun (GERD, sleep apnea, asam urat) dan tidak menggantikan tenaga kesehatan.
