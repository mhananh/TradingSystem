// Small, editable example library. ALL values are rough estimates (perkiraan): sources differ
// (e.g. cooked white rice is listed anywhere from ~130 to ~180 kcal/100 g depending on water content),
// and warung/warteg portions vary widely.
export interface LibraryFood {
  id: string;
  name: string;
  portion: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  category: 'pokok' | 'protein' | 'sayur' | 'buah' | 'tambahan' | 'minuman' | 'camilan';
}

export const FOOD_LIBRARY: LibraryFood[] = [
  { id: 'nasi', name: 'Nasi putih', portion: '1 centong (±100 g)', caloriesKcal: 150, proteinG: 3, carbsG: 34, fatG: 0.3, category: 'pokok' },
  { id: 'roti-gandum', name: 'Roti gandum', portion: '2 lembar (±60 g)', caloriesKcal: 150, proteinG: 7, carbsG: 26, fatG: 2, category: 'pokok' },
  { id: 'oatmeal', name: 'Oatmeal (masak dengan air)', portion: '40 g oat kering', caloriesKcal: 150, proteinG: 5, carbsG: 27, fatG: 3, category: 'pokok' },
  { id: 'telur-rebus', name: 'Telur rebus', portion: '1 butir', caloriesKcal: 75, proteinG: 6, carbsG: 0.5, fatG: 5, category: 'protein' },
  { id: 'ayam-panggang', name: 'Ayam panggang tanpa kulit (dada)', portion: '100 g', caloriesKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, category: 'protein' },
  { id: 'ikan', name: 'Ikan bakar/kukus', portion: '100 g', caloriesKcal: 120, proteinG: 22, carbsG: 0, fatG: 3, category: 'protein' },
  { id: 'tahu', name: 'Tahu (kukus/rebus)', portion: '2 potong (±100 g)', caloriesKcal: 80, proteinG: 8, carbsG: 2, fatG: 4.5, category: 'protein' },
  { id: 'tempe', name: 'Tempe (kukus/bacem tanpa goreng)', portion: '2 potong (±100 g)', caloriesKcal: 190, proteinG: 19, carbsG: 9, fatG: 10, category: 'protein' },
  { id: 'tempe-goreng', name: 'Tempe goreng', portion: '2 potong (±100 g)', caloriesKcal: 280, proteinG: 18, carbsG: 10, fatG: 19, category: 'protein' },
  { id: 'sayur-bening', name: 'Sayur bening', portion: '1 mangkuk', caloriesKcal: 40, proteinG: 2, carbsG: 7, fatG: 0.5, category: 'sayur' },
  { id: 'pisang', name: 'Pisang', portion: '1 buah sedang', caloriesKcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, category: 'buah' },
  { id: 'yogurt-hp', name: 'Yogurt tinggi protein', portion: '1 cup (±150 g)', caloriesKcal: 110, proteinG: 15, carbsG: 8, fatG: 2, category: 'protein' },
  { id: 'minyak', name: 'Minyak goreng', portion: '1 sdm', caloriesKcal: 120, proteinG: 0, carbsG: 0, fatG: 13.6, category: 'tambahan' },
  { id: 'kecap', name: 'Kecap manis', portion: '1 sdm', caloriesKcal: 45, proteinG: 0.5, carbsG: 10, fatG: 0, category: 'tambahan' },
  { id: 'sambal', name: 'Sambal', portion: '1 sdm', caloriesKcal: 25, proteinG: 0.3, carbsG: 2, fatG: 2, category: 'tambahan' },
  { id: 'teh-manis', name: 'Teh manis', portion: '1 gelas', caloriesKcal: 90, proteinG: 0, carbsG: 22, fatG: 0, category: 'minuman' },
  { id: 'kopi-susu', name: 'Kopi susu gula aren', portion: '1 cup (±250 ml)', caloriesKcal: 180, proteinG: 4, carbsG: 28, fatG: 6, category: 'minuman' },
  { id: 'kopi-hitam', name: 'Kopi hitam tanpa gula', portion: '1 cangkir', caloriesKcal: 5, proteinG: 0.3, carbsG: 0, fatG: 0, category: 'minuman' },
  { id: 'gorengan', name: 'Gorengan (bakwan/tahu isi)', portion: '1 buah', caloriesKcal: 140, proteinG: 3, carbsG: 14, fatG: 8, category: 'camilan' },
];
