// Beginner, equipment-free plan with double progression and safe regressions.
export interface ExerciseLevel {
  name: string;
  how: string;
}

export interface Exercise {
  id: string;
  name: string;
  ladder: ExerciseLevel[]; // index 0 = easiest regression
  safety: string;
}

export const EXERCISES: Exercise[] = [
  {
    id: 'squat',
    name: 'Squat',
    ladder: [
      { name: 'Duduk-berdiri dari kursi (pegangan)', how: 'Duduk di kursi stabil, berdiri tanpa menghentak, pegang meja bila perlu. Turun pelan 3 detik.' },
      { name: 'Squat ke kursi', how: 'Turunkan pinggul ke belakang sampai bokong menyentuh kursi, lalu berdiri. Lutut searah jari kaki.' },
      { name: 'Squat badan (bodyweight)', how: 'Tanpa kursi, turun senyaman mungkin dengan punggung netral, tumit tetap menapak.' },
      { name: 'Squat tempo 3-1-1', how: 'Turun 3 detik, tahan 1 detik, naik 1 detik.' },
      { name: 'Split squat', how: 'Satu kaki di depan, satu di belakang; turunkan lutut belakang mendekati lantai. Pegang dinding bila perlu.' },
    ],
    safety: 'Hentikan bila nyeri lutut/pinggang tajam. Kurangi kedalaman bila tidak nyaman.',
  },
  {
    id: 'pushup',
    name: 'Push-up',
    ladder: [
      { name: 'Wall push-up', how: 'Tangan di dinding setinggi bahu, badan lurus, tekuk siku sampai dada mendekati dinding.' },
      { name: 'Incline push-up (meja)', how: 'Tangan di tepi meja kokoh, badan lurus dari kepala ke tumit.' },
      { name: 'Incline push-up (kursi/sofa)', how: 'Permukaan lebih rendah = lebih berat. Jaga perut tetap kencang.' },
      { name: 'Knee push-up', how: 'Lutut di lantai (beri alas), badan lurus dari kepala ke lutut.' },
      { name: 'Push-up penuh', how: 'Badan lurus, turunkan dada mendekati lantai.' },
    ],
    safety: 'Hentikan bila nyeri bahu/pergelangan. Tetap bernapas, jangan menahan napas.',
  },
  {
    id: 'bridge',
    name: 'Glute bridge',
    ladder: [
      { name: 'Glute bridge', how: 'Berbaring, lutut ditekuk, angkat pinggul sampai lurus dari bahu ke lutut, tahan 1 detik.' },
      { name: 'Glute bridge tahan 3 detik', how: 'Sama, tahan 3 detik di atas.' },
      { name: 'Bridge kaki dirapatkan', how: 'Kaki lebih rapat, fokus kencangkan bokong.' },
      { name: 'Single-leg bridge', how: 'Satu kaki diluruskan, angkat pinggul dengan kaki lainnya.' },
    ],
    safety: 'Jangan melengkungkan punggung bawah berlebihan.',
  },
  {
    id: 'birddog',
    name: 'Bird-dog',
    ladder: [
      { name: 'Bird-dog tangan saja', how: 'Posisi merangkak, julurkan satu tangan ke depan, punggung tetap rata.' },
      { name: 'Bird-dog kaki saja', how: 'Julurkan satu kaki ke belakang tanpa memutar pinggul.' },
      { name: 'Bird-dog penuh', how: 'Julurkan tangan dan kaki berlawanan bersamaan, tahan 2 detik.' },
      { name: 'Bird-dog tahan 5 detik', how: 'Tahan 5 detik tiap sisi, gerak pelan.' },
    ],
    safety: 'Gerak pelan dan terkontrol; beri alas untuk lutut.',
  },
];

export const PROGRESSION_RULE = {
  targetSets: 3,
  targetReps: 12,
  sessionsToProgress: 2,
  startSets: 2,
  startReps: 8,
};

export function exerciseById(id: string) {
  return EXERCISES.find((e) => e.id === id);
}

/**
 * Double progression: once target sets×reps are hit in N consecutive logged sessions at a level,
 * suggest the next variation. Regressions are always allowed.
 */
export function suggestLevel(history: { level: number; sets: number; reps: number }[], exercise: Exercise): { level: number; reason: string } {
  if (history.length === 0) return { level: 0, reason: `Mulai dari ${PROGRESSION_RULE.startSets}×${PROGRESSION_RULE.startReps} dengan variasi termudah.` };
  const last = history[history.length - 1];
  const recent = history.slice(-PROGRESSION_RULE.sessionsToProgress);
  const hit =
    recent.length === PROGRESSION_RULE.sessionsToProgress &&
    recent.every((h) => h.level === last.level && h.sets >= PROGRESSION_RULE.targetSets && h.reps >= PROGRESSION_RULE.targetReps);
  if (hit && last.level < exercise.ladder.length - 1)
    return { level: last.level + 1, reason: `Kamu mencapai ${PROGRESSION_RULE.targetSets}×${PROGRESSION_RULE.targetReps} di ${PROGRESSION_RULE.sessionsToProgress} sesi berturut — boleh naik ke variasi berikutnya (mulai lagi dari 2×8).` };
  return { level: last.level, reason: `Tambah repetisi/set secara bertahap sampai ${PROGRESSION_RULE.targetSets}×${PROGRESSION_RULE.targetReps} dengan teknik baik.` };
}

export const PLAN_PHASES = [
  {
    id: 'w1-2',
    title: 'Minggu 1–2: Membangun kebiasaan',
    items: [
      'Jalan 15–20 menit hampir setiap hari, sesuai toleransi (boleh dipecah 2×10 menit, mis. setelah makan siang).',
      'Latihan kekuatan 2–3× seminggu: squat, push-up, glute bridge, bird-dog — 2 set × 8–10 repetisi di variasi termudah.',
      'Hari ringan boleh kapan saja: cukup jalan santai 10 menit.',
    ],
  },
  {
    id: 'w3-6',
    title: 'Minggu 3–6: Menambah volume',
    items: [
      'Jalan bertahap menuju 30 menit di sebagian besar hari.',
      'Latihan kekuatan 3× seminggu (2× tetap dihitung cukup).',
      'Naikkan repetisi/set menuju 3×12, lalu naik variasi (aturan progresi ganda).',
    ],
  },
  {
    id: 'later',
    title: 'Selanjutnya',
    items: [
      'Menuju 150–300 menit aktivitas aerobik sedang per minggu dan latihan kekuatan ≥2 hari per minggu, sesuai kemampuan.',
      'Target langkah naik bertahap dari rata-rata pribadimu (+10–15% per 2 minggu), bukan langsung 10.000.',
    ],
  },
];

export function currentPhase(daysSinceStart: number) {
  if (daysSinceStart < 14) return PLAN_PHASES[0];
  if (daysSinceStart < 42) return PLAN_PHASES[1];
  return PLAN_PHASES[2];
}
