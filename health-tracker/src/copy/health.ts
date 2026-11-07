// All health/education copy in one place so it can be reviewed easily. Non-diagnostic by design.

export const SLEEP_SAFETY_CARD =
  'Kantuk sepanjang hari, bangun tidak segar, dan mendengkur dapat menjadi alasan untuk membahas kualitas tidur serta kemungkinan sleep apnea dengan tenaga kesehatan. Catatan aplikasi tidak dapat mendiagnosis kondisi tersebut.';

export const DROWSY_DRIVING = 'Jangan menyetir atau mengoperasikan mesin saat sangat mengantuk. Berhenti dan istirahat bila perlu.';

export const URGENT_WARNING = {
  title: 'Tanda bahaya — segera cari pertolongan medis',
  items: [
    'Nyeri dada (bisa berasal dari jantung), terutama bila menjalar ke lengan/rahang, disertai sesak atau keringat dingin',
    'Sulit atau sakit saat menelan',
    'Muntah darah atau seperti ampas kopi',
    'BAB hitam seperti aspal',
    'Pingsan, atau sesak napas berat',
  ],
  action: 'Segera ke IGD atau hubungi 119 / 112.',
};

export interface EduCard {
  id: string;
  title: string;
  body: string[];
}

export const EDU_CARDS: EduCard[] = [
  {
    id: 'sleep',
    title: 'Tidur & kantuk siang',
    body: [
      'Sebagian besar orang dewasa membutuhkan kesempatan tidur 7–9 jam. Jadwal tidur-bangun yang konsisten membantu.',
      SLEEP_SAFETY_CARD,
      'Bila ada yang melihat kamu berhenti napas, tersedak, atau terengah saat tidur, sampaikan ke dokter.',
      'Jam tangan bisa memperkirakan durasi tidur, tetapi tidak bisa mendiagnosis sleep apnea — termasuk fitur SpO2.',
      'Penurunan berat badan saja tidak bisa memastikan atau menyelesaikan gangguan napas saat tidur; evaluasi tetap perlu.',
      'Riset menunjukkan saat diet dengan tidur pendek, porsi berat yang hilang dari lemak cenderung lebih kecil. Tidur cukup ikut membantu tujuanmu.',
    ],
  },
  {
    id: 'gerd',
    title: 'GERD & pemicu',
    body: [
      'Pemicu GERD berbeda pada tiap orang. Hindari hanya yang berulang kali memicu gejala — satu kejadian belum cukup untuk menyimpulkan.',
      'Banyak orang terbantu dengan tidak berbaring 2–3 jam setelah makan dan menghindari porsi sangat besar di malam hari (sesuaikan dengan saran dokter).',
      'Kopi bisa menjadi pemicu bagi sebagian orang, terutama saat perut kosong. Catat jam kopimu agar polanya terlihat.',
      'Bila gejala sering, memburuk, atau mengganggu aktivitas/tidur, konsultasikan dengan dokter.',
    ],
  },
  {
    id: 'fasting',
    title: 'Puasa intermiten (opsional)',
    body: [
      'Puasa tidak wajib untuk menurunkan lemak dan tidak lebih unggul dari defisit kalori yang setara.',
      'Mode awal 14:10 bersifat uji coba. Aplikasi tidak akan menaikkan durasi puasa secara otomatis.',
      'Bila refluks memburuk, pusing, lemas tidak biasa, atau hampir pingsan saat puasa: hentikan puasa, makan/minum sesuai kondisi, dan cari bantuan medis bila berat atau menetap.',
      'Kamu bisa menjeda IF kapan saja dan memakai jadwal makan biasa — semua fitur lain tetap berjalan.',
    ],
  },
  {
    id: 'uric',
    title: 'Asam urat',
    body: [
      'Kadar asam urat sekitar 6,8 mg/dL ke atas sering dianggap di atas ambang kelarutan. Hasil lab perlu ditafsirkan oleh dokter bersama riwayatmu.',
      'Penurunan berat yang sangat cepat, puasa panjang, dan kurang minum dapat menaikkan asam urat sementara — salah satu alasan aplikasi ini menghindari diet ekstrem.',
      'Sumber protein yang umumnya lebih "ramah": telur, susu/yogurt rendah lemak, ayam, tahu/tempe. Jeroan, daging merah, dan seafood tertentu biasanya dibatasi; minuman tinggi gula/fruktosa juga.',
      'Cek ulang sesuai saran dokter dan catat hasilnya di Log Lab.',
    ],
  },
  {
    id: 'protein',
    title: 'Protein & otot',
    body: [
      'Protein cukup dan latihan kekuatan membantu menjaga otot saat berat turun.',
      'Contoh ±30 g protein: 100 g dada ayam; 150 g tempe; 2 telur + 100 g tahu + segelas susu.',
      'Membagi protein ke 3–4 kali makan biasanya lebih mudah daripada sekaligus.',
    ],
  },
  {
    id: 'weight-noise',
    title: 'Kenapa berat naik-turun?',
    body: [
      'Berat harian bisa naik-turun 0,5–1,5 kg karena air, garam, isi pencernaan, dan glikogen — bukan karena lemak.',
      'Minggu pertama sering turun cepat karena air; jangan jadikan patokan.',
      'Lihat rata-rata 7 hari dan tren beberapa minggu, bukan satu angka.',
      'Timbang di kondisi yang sama: pagi, setelah ke toilet, sebelum makan/minum.',
    ],
  },
  {
    id: 'ramadan',
    title: 'Ramadan',
    body: [
      'Saat Ramadan, jadwal puasa intermiten harian otomatis dinonaktifkan dan diganti pencatatan sahur–berbuka.',
      'Tidur sering terpotong karena sahur; catat tidur malam dan tidur setelah sahur bila ada.',
      'Berbuka bertahap, minum cukup antara berbuka dan sahur, dan hindari langsung berbaring setelah makan besar — relevan untuk GERD dan asam urat.',
      'Bila ada kondisi kesehatan, diskusikan rencana puasa dengan dokter.',
    ],
  },
];

export const ESTIMATE_EXPLAINER = [
  'BMR (energi saat istirahat) dihitung dengan rumus Mifflin–St Jeor: 10 × berat (kg) + 6,25 × tinggi (cm) − 5 × usia + 5 (pria) atau − 161 (wanita).',
  'TDEE (kebutuhan harian) = BMR × faktor aktivitas (duduk 1,2; ringan 1,375; sedang 1,55; tinggi 1,725).',
  'Rumus ini bisa meleset ±10% atau lebih per orang. Setelah ±3–4 minggu catatan yang konsisten, aplikasi menghitung "TDEE terobservasi" dari datamu sendiri: rata-rata kalori tercatat + (laju turun tren berat × 7.700 kkal/kg).',
  'Target kalori TIDAK berubah otomatis. Angka-angka ini adalah perkiraan, bukan resep medis.',
];

export const PRIVACY_TEXT = [
  'Semua data kesehatanmu tersimpan di perangkat ini. Tidak ada akun, server, iklan, atau analitik.',
  'Data hanya keluar dari perangkat bila KAMU memilih: mengekspor/membagikan backup, atau memakai fitur AI.',
  'Fitur AI (opsional): foto makanan/label/screenshot, atau ringkasan statistik mingguan, dikirim ke penyedia AI yang kamu pilih (Anthropic atau Google) saat fitur dipakai. Catatan bebas dan identitasmu tidak dikirim.',
  'Health Connect: aplikasi membaca langkah, tidur, nadi, dan SpO2 hanya dengan izinmu, dan bisa menulis berat & kalori bila kamu mengaktifkannya.',
  'Menghapus aplikasi atau data aplikasi akan menghapus catatanmu. Lakukan backup berkala.',
];
