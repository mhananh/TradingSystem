# Spesifikasi Jejak Sehat (v3 — gabungan brief + background + hasil evaluasi)

## Context
Dua dokumen dari ChatGPT (`CLAUDE_APP_BUILD_SPEC.md` + "Project Background") digabung jadi satu sumber kebenaran. Hasil evaluasi menemukan: Ramadan tidak diperhitungkan, target 75 kg tidak konsisten dengan rencana kalori, konflik kebiasaan (kopi pagi saat puasa vs GERD), aturan data lintas-tengah-malam tidak ada, dan beberapa janji teknis tidak realistis tanpa server. Dokumen ini menyelesaikan semua itu. Setelah disetujui, isi bagian "Spec" disalin ke `health-tracker/docs/SPEC.md` lalu aplikasi diimplementasi penuh.

Repo `mhananh/TradingSystem` kosong → aplikasi di subfolder **`health-tracker/`**, branch `ccr-eb55c065-d8dexf`. User berlatar marketing/sales: keputusan teknis diserahkan ke Claude; README harus bisa diikuti non-programmer.

## Keputusan yang sudah dikunci
| Topik | Keputusan |
|---|---|
| Jendela makan IF default | 14:10, **09:30–19:30**, opsional, bisa dijeda |
| Makro awal | 1.700 kcal · protein 130 g (≥110 g = "cukup") · lemak 55 g · karbo 171 g |
| Lantai kalori | 1.500 kcal; di bawahnya wajib konfirmasi + saran konsultasi |
| Target | 75 kg = **target ambisius** (default ~10 Mar 2027, label "perkiraan"); checkpoint realistis ~80 kg di awal Ramadan; 70 kg jangka panjang |
| Asam urat | Log lab sederhana + kartu edukasi, tanpa diagnosis |
| Jam tangan | **Huawei Band** → v1 input manual cepat dengan kolom mengikuti tampilan Huawei Health |
| Lokasi kode | `health-tracker/` |

---

## SPEC

### 1. Prinsip
Personal health analytics, bukan penghitung kalori. Local-first (tanpa server, akun, analytics). Offline setelah dibuka sekali. Bahasa Indonesia. Tanpa guilt/streak hukuman. Semua estimasi berlabel *perkiraan*. Tidak ada klaim kausal dari data pribadi. Gejala selalu mengalahkan target.

### 2. Profil (semua bisa diedit; nilai awal = baseline 7 Nov 2026)
Pria, 26 th, 172 cm, 90 kg (BMI 30,4), sedentary, belum olahraga, tidur 5–6 j, mendengkur ringan, bangun lelah, kantuk berat terutama setelah makan siang, GERD kadang, kopi pagi kadang, tanpa obat rutin. Tambahan opsional: lingkar pinggang & leher baseline, tekanan darah (untuk dibawa ke dokter), asam urat 7,3 (dikonfirmasi user saat onboarding, tanggal bisa diisi).

### 3. Mesin estimasi
- **BMR Mifflin** (1.850) & **TDEE formula** (×1,2 = 2.220), dihitung ulang dari *tren* berat terbaru → ditampilkan sebagai "perkiraan rumus" + rentang ketidakpastian (BMR ±10%, faktor aktivitas 1,2–1,5).
- **TDEE terobservasi** (fitur inti): setelah ≥21 hari dengan ≥80% hari catatan makan "lengkap" dan ≥8 penimbangan → `rata-rata kkal tercatat + (−slope tren kg/hari × 7.700)`. Minggu pertama dikecualikan dari slope (air/glikogen). Menggantikan angka rumus di dashboard bila tersedia.
- **Target kalori tidak pernah berubah otomatis.**
- **Proyeksi 3 skenario** (optimis/tengah/pesimis) menuju tanggal target & awal Ramadan, model mingguan dengan TDEE yang turun seiring berat; ditampilkan sebagai pita rentang, bukan garis pasti. Setelah TDEE terobservasi tersedia, skenario tengah memakainya.
- **Dua angka berdampingan:** "laju dibutuhkan" vs "laju dari rencanamu saat ini". Laju >0,75 kg/mgg atau >1% BB/mgg → label "ambisius".
- **Checkpoint minggu 4** (dan tiap 2 minggu): bila tren <0,4 kg/mgg → daftar cek berurutan: kelengkapan catatan (minyak, minuman, camilan) → tidur → langkah → opsi kurangi kalori sedikit (tidak <1.500), keputusan user. Bila >1 kg/mgg setelah minggu 2 → saran tambah makan/protein.
- Kalori olahraga **tidak** ditambahkan ke jatah makan (hindari hitung ganda).

### 4. Aturan data (integritas)
- Satu `DailyEntry` per tanggal lokal (PK `YYYY-MM-DD`).
- **Tidur** dicatat ke **tanggal bangun**. **Puasa** dicatat ke **tanggal puasa berakhir**. Durasi dihitung dari timestamp lengkap (aman lintas tengah malam & DST).
- `nutritionComplete: boolean` membedakan "hari tidak lengkap" dari "makan sedikit"; hari tanpa data ≠ 0 di grafik dan rata-rata.
- **GERD per episode** (`GerdEpisode[]`: waktu, keparahan, jenis, konteks: saat puasa/sebelum makan/setelah makan/malam/tidak tahu, pemicu) — konteks "saat puasa" diisi otomatis bila waktu jatuh dalam jendela puasa yang tercatat.
- **Kantuk dipecah 3:** pagi, setelah makan siang, sore (1–5).
- **Kopi:** jam + jumlah gelas; aplikasi menandai otomatis "sebelum makan pertama" bila jamnya sebelum makan pertama/akhir puasa.
- Penimbangan: catatan kondisi opsional (pagi setelah toilet = standar).
- Data versi skema + migrasi; semua input divalidasi (berat 30–300, tinggi 120–230, makro/langkah ≥0, jam valid).

### 5. Pencatatan bertingkat (target ≤30 detik untuk inti)
- **Inti (layar Catat, atas):** berat · kkal + protein (atau dari daftar makan) · total tidur + jam tidur/bangun · rasa saat bangun · kantuk siang · GERD ya/tidak · langkah.
- **Tombol cepat:** "Sama seperti kemarin" (makan), menu favorit, salin makanan, pustaka contoh Indonesia berlabel perkiraan (nasi putih, telur rebus, ayam panggang tanpa kulit, ikan, tahu, tempe, sayur bening, oatmeal, pisang, yogurt tinggi protein, roti gandum, minyak goreng 1 sdm, sambal/kecap, teh manis, kopi susu, gorengan).
- **Detail (collapsible):** makro per makan, puasa mulai/selesai, episode GERD, kualitas tidur 1–5, terbangun, tidur siang, kopi, jeda napas/tersedak yang dilihat orang lain, latihan (gerakan, set, reps, variasi, effort), jalan menit, pinggang, catatan.
- **Kolom jam tangan (Huawei Health):** total tidur, jam tidur/bangun, langkah, nadi istirahat, SpO2 terendah malam (opsional), skor tidur (opsional, info saja).
- Autosave draft, edit tanggal lampau, status "Tersimpan".

### 6. Mode puasa
- **IF harian (opsional, default uji coba 14:10):** tombol "Jeda IF / makan teratur", log manual, durasi aktual, tidak pernah naik otomatis ke 16:8, catatan "puasa tidak lebih unggul dari defisit kalori setara".
- **Mode Ramadan (opt-in):** tanggal perkiraan 8 Feb–9 Mar 2027 (bisa diedit, label "perkiraan, ikuti penetapan resmi"); jendela sahur–berbuka; tidur bisa 2 segmen (malam + setelah sahur); ringkasan: tidur total, GERD setelah berbuka, minum air sahur–berbuka, berat. Saat aktif, IF harian otomatis nonaktif. Edukasi netral: berbuka bertahap, jangan langsung berbaring, cukup cairan (relevan asam urat & GERD). Tidak ada penilaian soal menjalankan atau tidak.
- Gejala saat puasa (refluks memburuk, pusing, lemas, hampir pingsan) → kartu: hentikan puasa/makan-minum sesuai kondisi, cari bantuan medis bila berat atau menetap.

### 7. Halaman (bottom nav)
1. **Beranda** — sapaan & tanggal; berat terbaru + rata-rata 7 hari + arah tren; progres ke 75 kg (70 kg di "Target jangka panjang"); kkal & protein hari ini vs target; tidur semalam; kantuk & GERD; langkah/jalan/latihan; status IF/Ramadan; **ringkasan minggu ini vs minggu lalu**; satu kartu insight/pengingat; tombol utama **Catat hari ini**. Warna netral untuk data kosong.
2. **Catat** — §5.
3. **Progres** — grafik berat (titik + rata-rata 7 hari bila ≥4 titik/7 hari; rentang 2 mgg/1 bln/3 bln/semua; pita skenario); pinggang; kkal & protein (hari tak lengkap ditandai, bukan nol); TDEE rumus vs terobservasi; tidur & 3 skor kantuk; nadi istirahat; frekuensi GERD; menit jalan & sesi kekuatan/minggu; kalkulator laju target.
4. **Kesehatan** — log tidur, episode GERD + riwayat pemicu, rencana latihan bertahap, log lab (asam urat), kartu edukasi, kartu tanda bahaya darurat (terpisah, merah hanya di sini), catatan "Tanya ke dokter".
5. **Pengaturan** — profil & target, makro, IF & Ramadan, ekspor/impor/hapus, pengingat backup, privasi, versi.

### 8. Insight (menjawab pertanyaan di Background §7)
Setiap insight punya ambang data minimum; di bawah ambang tampil "belum cukup data (butuh X lagi)". Bahasa: "tampaknya", "mungkin berkaitan", selalu dengan catatan faktor lain.
| Pertanyaan | Metode | Ambang |
|---|---|---|
| Laju turun berkelanjutan? | slope tren 14/28 hari vs 0,5–1% BB/mgg | ≥10 timbangan / 14 hari |
| Defisit konsisten? | TDEE terobservasi − rata-rata asupan; % hari lengkap | 21 hari |
| Protein cukup? | % hari lengkap ≥110 g | 7 hari lengkap |
| Tidur membaik? | rata-rata 7 hari vs 7 hari sebelumnya & vs baseline | 7+7 malam |
| Kantuk membaik? | idem per waktu (pagi/siang/sore) | 7+7 hari |
| Puasa ↔ GERD? | % hari dengan episode saat puasa ≥14 j vs <14 j/tanpa puasa; tampilkan juga faktor pengganggu (kopi sebelum makan, makan malam telat) | ≥5 hari di tiap kelompok |
| Kopi ↔ GERD? | idem, kopi sebelum makan pertama vs tidak | ≥5 per kelompok |
| Tidur ↔ kantuk keesokan hari? | rata-rata kantuk setelah tidur <6 j vs ≥7 j | ≥5 per kelompok |
| Latihan konsisten? | sesi/minggu 4 minggu terakhir | 2 minggu |

### 9. Rencana latihan (progressive overload + pemulihan)
- **Minggu 1–2:** jalan 15–20 mnt hampir tiap hari sesuai toleransi; kekuatan 2–3×/mgg: squat ke kursi, wall push-up, glute bridge, bird-dog, 2×8–10.
- **Minggu 3–6:** jalan menuju 30 mnt; kekuatan 3× (2× dianggap cukup).
- **Aturan progresi ganda:** bila 3×12 dengan teknik baik pada 2 sesi berturut → naik variasi (wall → incline → knee push-up; chair squat → bodyweight squat → tempo/split squat; bridge → single-leg bridge). Regresi selalu tersedia.
- **Lanjutan:** menuju 150–300 mnt aerobik sedang/mgg + kekuatan ≥2 hari. Target langkah berbasis baseline pribadi (+10–15% per 2 mgg), bukan 10.000.
- Tombol "hari ringan". Nyeri, sakit, pusing, sesak tidak biasa → lewati latihan.

### 10. Konten kesehatan (non-diagnostik)
Kartu sleep apnea (kutipan spec asli) di onboarding & Kesehatan; jangan menyetir/mengoperasikan mesin saat sangat mengantuk; tidur 7–9 j sebagai *kesempatan tidur*; jam tangan tidak bisa mendiagnosis; GERD: pemicu individual, hindari berbaring 2–3 j setelah makan, kopi bisa jadi pemicu, konsultasi bila sering/memburuk; tanda bahaya darurat (nyeri dada, sulit menelan, muntah darah, BAB hitam) → segera ke IGD; asam urat: hidrasi, hindari crash diet/puasa ekstrem, sumber protein yang umumnya lebih ramah, cek ulang ke dokter; tidur sebagai faktor kehilangan lemak vs otot. Semua teks dikumpulkan di satu file `copy/` supaya mudah direview user.

### 11. Data & privasi
- IndexedDB (Dexie) + `navigator.storage.persist()`; status "penyimpanan permanen: ya/tidak" ditampilkan di Pengaturan.
- Ekspor JSON (backup penuh) & CSV (harian, makanan, episode GERD; UTF-8 BOM, pemisah `;` opsi untuk Excel lokal Indonesia). Pengingat backup di dalam aplikasi tiap 7 hari.
- Impor: validasi skema (zod) → pratinjau (jumlah hari/rentang tanggal/konflik) → pilih "gabung" atau "ganti" → konfirmasi. File rusak ditolak tanpa mengubah data.
- Hapus semua: ketik "HAPUS" untuk konfirmasi; undo untuk hapus satu catatan.
- Nol request jaringan berisi data pribadi; font dibundel lokal.
- **Pengingat:** hanya di dalam aplikasi (notifikasi terjadwal saat aplikasi tertutup tidak dijanjikan — butuh server).

### 12. Integrasi jam tangan
- **v1:** input manual kolom Huawei Health (§5).
- **Di luar v1 (didokumentasikan sebagai opsi):** Huawei Health tidak menyinkronkan langsung ke Health Connect; jalurnya lewat aplikasi pihak ketiga (mis. Health Sync) + pembungkus Android (Capacitor). Ekspor data Huawei (Privacy Center) formatnya tidak terdokumentasi → tidak dijanjikan. Tanpa reverse engineering.

### 13. Visual & aksesibilitas
Netral hangat, kartu putih, teks charcoal, aksen hijau, amber untuk hati-hati, merah hanya untuk darurat. Kontrol ≥44 px, bottom nav sticky + safe-area, nyaman di 360 px, form tidak tertutup keyboard, fokus terlihat, label aksesibel, grafik tidak hanya mengandalkan warna. Tema terang (gelap bila sempat).

---

## Implementasi

**Stack:** React + TypeScript + Vite · Tailwind · Dexie · Recharts · vite-plugin-pwa · lucide-react · zod · Vitest + Testing Library · Playwright (QA, sudah terpasang di environment) · ESLint.

**Struktur `health-tracker/`:**
```
docs/SPEC.md                 ← salinan bagian SPEC di atas
src/domain/  types.ts, defaults.ts, calc.ts, projection.ts, tdee.ts, insights.ts, exercise.ts, validation.ts
src/db/      db.ts (profile, days, favorites, clinicianNotes, labResults, meta; migrasi)
src/lib/     date.ts, export.ts, format.ts, storage.ts
src/copy/    id.ts (semua teks + konten kesehatan)
src/components/, src/pages/ (Beranda, Catat, Progres, Kesehatan, Pengaturan, Onboarding)
tests/       unit + e2e
.github/workflows/pages.yml  ← deploy ke GitHub Pages (di root repo, build dari health-tracker/)
```

**Urutan kerja & prioritas** (P0 wajib jalan; P1 dikerjakan setelah P0 lulus):
- **P0:** scaffold + design system + nav → model/DB/migrasi → calc + unit test → onboarding/pengaturan → Catat (inti + detail + favorit) → Beranda → Progres (berat, kkal/protein, tidur/kantuk) → Kesehatan (log, edukasi, darurat, latihan) → IF + Ramadan → ekspor/impor/hapus + persist → PWA (manifest, ikon, offline) → README.
- **P1:** TDEE terobservasi + proyeksi skenario + checkpoint → insight korelasi → grafik tambahan (nadi istirahat, GERD, latihan) → tema gelap.
  (Target: P0 dan P1 sama-sama selesai; pembagian ini hanya urutan.)

**Deployment (dikerjakan Claude, dijelaskan untuk non-programmer di README):**
1. Workflow GitHub Actions membangun & mempublikasi ke GitHub Pages saat push ke `main`. Catatan: Pages untuk repo privat butuh akun berbayar → alternatif **Netlify Drop** (seret folder `dist` ke browser) dijelaskan langkah demi langkah.
2. Di HP: buka URL HTTPS di Chrome → menu ⋮ → "Instal aplikasi/Tambahkan ke layar utama".
3. Data tetap di HP; hosting hanya menyajikan file aplikasi.

## Verifikasi
- **Unit test:** BMR 1.850, TDEE 2.220, BMI 30,4, makro 1.699 kcal; tidur & puasa lintas tengah malam/DST; atribusi tanggal; rolling average dengan hari kosong; laju target (~0,85 kg/mgg ke 10 Mar 2027); progres saat menjauh dari target; TDEE terobservasi (data sintetis dengan TDEE diketahui); proyeksi monoton & rentang; ambang insight; validasi impor rusak; CSV.
- **E2E Playwright (360/390/430 px):** onboarding → catat → edit → hapus + undo; reload → data tetap; IF off total; Ramadan on; ekspor → hapus semua → impor → data kembali; file rusak ditolak; offline reload aplikasi tetap jalan; tidak ada scroll horizontal; pantau request jaringan (hanya aset sendiri).
- `npm run lint`, `npm test`, `npm run build`, `npm run preview` bersih. Screenshot tiap halaman dikirim ke user.
- Commit & push ke `ccr-eb55c065-d8dexf`; tanpa PR kecuali diminta. Laporan akhir: fitur, keterbatasan, perintah, langkah instal Android, lokasi data & backup, hasil tes apa adanya, TODO.

---

## AMANDEMEN v3 (menggantikan bagian yang bertentangan di atas)

### A. Platform: aplikasi Android asli + versi web
- Satu kode React/TS dibungkus **Capacitor** → **APK Android** (utama) + PWA (cadangan, mis. untuk dibuka di laptop).
- APK dibangun otomatis oleh **GitHub Actions** dan dipublikasikan sebagai **GitHub Release** → user cukup buka link di HP, unduh, pasang (izinkan "instal dari sumber tidak dikenal").
- **Kunci tanda tangan APK tetap** (disimpan sebagai GitHub Secret; panduan 3 langkah untuk user). Wajib: kalau kunci berubah, update tidak bisa dipasang di atas versi lama dan data bisa hilang.
- Penyimpanan tetap lokal di HP (IndexedDB dalam aplikasi; tidak terhapus oleh "hapus data browser").
- §12 lama (integrasi jam di luar v1) dan batasan "pengingat hanya di dalam aplikasi" di §11 **dibatalkan**.

### B. Huawei Band → Health Connect (otomatis) + cadangan screenshot
- Alur: Huawei Band → Huawei Health → **Health Sync** (pihak ketiga; trial 1 minggu, lalu bayar sekali/langganan) → **Health Connect** → aplikasi kita.
- Riset (Nov 2026): Huawei Health tidak punya sinkron resmi ke Health Connect; Health Sync bisa membaca "sebagian besar data" Huawei Health. SpO2 & nadi kontinu mungkin tidak lengkap → user disarankan memakai trial 1 minggu untuk memastikan data Band-nya terbawa.
- **Baca** dari Health Connect: langkah, sesi tidur (+tahap bila ada), detak jantung, nadi istirahat, SpO2, berat, sesi olahraga. Sinkron saat aplikasi dibuka + tombol "Sinkron sekarang". Data otomatis diberi label sumber ("Huawei via Health Connect") dan **tidak menimpa** isian manual tanpa konfirmasi.
- **Tulis** ke Health Connect: berat & nutrisi (kkal/makro per makan) — opsional, izin terpisah.
- **Cadangan screenshot:** foto/screenshot halaman Huawei Health → Claude Haiku membaca angka (tidur, jam tidur/bangun, langkah, nadi istirahat, SpO2) → pratinjau → konfirmasi.
- Huawei Health Kit API langsung (OAuth, review Huawei ±15 hari kerja) **tidak** di v1; dicatat sebagai opsi masa depan.

### C. Fitur AI (Claude API, opsional, bisa dimatikan total)
- **Kunci API milik user** (console.anthropic.com, terpisah dari langganan Claude), disimpan terenkripsi di HP, tidak pernah masuk kode/repo. Panduan pembuatan + saran pasang batas pengeluaran di README & layar pengaturan.
- Model: **Claude Sonnet 5.5** (`claude-sonnet-5-5`) untuk foto makanan, review mingguan, saran menu; **Claude Haiku 5.5** (`claude-haiku-5-5`) untuk membaca screenshot. Bisa diganti di Pengaturan. Penghitung pemakaian & perkiraan biaya bulanan di aplikasi.
- **Foto makanan → kalori:** foto dikecilkan (~1024 px) sebelum dikirim; hasil per item (nama, porsi, kkal & makro sebagai **rentang** + nilai tengah, tingkat keyakinan), daftar asumsi (minyak/santan/gula), maks. 2 pertanyaan klarifikasi (mis. "digoreng atau direbus?", "nasi berapa centong?"); user edit/konfirmasi → tersimpan sebagai entri makan berlabel "perkiraan AI". Mode **label gizi** (foto tabel nilai gizi → angka persis × porsi). Hasil yang dikoreksi bisa disimpan sebagai favorit.
- **Review mingguan:** dikirim hanya ringkasan statistik (bukan foto/catatan bebas) → narasi singkat + 1–3 saran konkret. Aturan keras di prompt sistem & validasi: tanpa diagnosis, tanpa klaim kausal, tidak menyarankan kalori < lantai, tidak memperpanjang puasa, gejala = prioritas, sebut keterbatasan data.
- **Saran menu sisa makro:** input sisa kkal/protein + konteks (kantin kantor/warung/masak) → 3 opsi menu Indonesia, mempertimbangkan GERD & asam urat, semua angka berlabel perkiraan.
- Output terstruktur (JSON schema) + validasi zod; kegagalan/penolakan/offline ditangani dengan pesan ramah, tidak merusak data. Fitur AI nonaktif saat offline.
- Privasi: layar persetujuan sekali di awal menjelaskan apa yang dikirim ke Anthropic dan kapan.

### D. Integrasi lain
- **Notifikasi lokal** (tetap jalan saat aplikasi ditutup), semua opt-in: catat pagi (tidur/berat), makan, pengingat tidur (jam target), backup mingguan, mulai/selesai IF bila aktif. Tidak ada notifikasi yang menekan ("kamu gagal…").
- **Bagikan Android:** backup JSON/CSV ke Google Drive/WhatsApp/mana saja; "Ringkasan untuk dokter" (PDF/teks: tidur, kantuk, GERD, berat, lab) via WhatsApp/email.
- **Kalender:** jadwal latihan & janji kontrol dokter ditulis ke kalender HP (otomatis tersinkron ke Google Calendar bila akun Google ada di HP) — tanpa login Google di aplikasi kita.

### E. Dampak pada implementasi & verifikasi
- Tambahan stack: Capacitor (Android), plugin Camera, Local Notifications, Share, Filesystem, secure storage, Health Connect (plugin terawat bila ada; bila tidak, plugin Kotlin kecil dibuat sendiri), Calendar; `@anthropic-ai/sdk` (mode browser).
- Struktur tambahan: `src/ai/` (client, prompts, schemas, foodPhoto, screenshot, weeklyReview, menu), `src/integrations/` (healthConnect, notifications, share, calendar), `android/`, `.github/workflows/android.yml`.
- Batas verifikasi yang jujur: di lingkungan cloud ini tidak ada HP Android/Huawei Band → Health Connect, notifikasi, kamera, dan kalender diuji lewat unit test + build APK yang sukses; uji nyata dilakukan user di HP (checklist uji disediakan). Panggilan AI diuji dengan respons tiruan; uji nyata butuh API key user.
