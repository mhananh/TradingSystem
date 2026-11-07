import type { UserProfile } from '../domain/types';
import type { WeekSummary, Insight } from '../domain/insights';
import { runStructured, type Part } from './client';
import { FOOD_PHOTO_SYSTEM, MENU_SYSTEM, NUTRITION_LABEL_SYSTEM, SCREENSHOT_SYSTEM, WEEKLY_REVIEW_SYSTEM } from './prompts';
import {
  foodPhotoSchema, guardAdvice, menuSchema, nutritionLabelSchema, sanitizeFood, sanitizeScreenshot, screenshotSchema, weeklyReviewSchema,
  type FoodPhotoResult, type MenuResult, type NutritionLabelResult, type ScreenshotResult, type WeeklyReviewResult,
} from './schemas';

export interface PreparedImage {
  base64: string;
  mediaType: 'image/jpeg';
  previewUrl: string;
}

/** Downscale to ~1024 px longest side and JPEG-encode — fewer tokens, lower cost, EXIF stripped. */
export async function prepareImage(file: Blob, maxSide = 1024, quality = 0.82): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', previewUrl: dataUrl };
}

const img = (p: PreparedImage): Part => ({ type: 'image', mediaType: p.mediaType, base64: p.base64 });

export async function estimateFoodPhoto(image: PreparedImage, profile: UserProfile, note?: string): Promise<FoodPhotoResult> {
  const r = await runStructured({
    feature: 'food-photo',
    system: FOOD_PHOTO_SYSTEM(profile.calorieFloorKcal),
    parts: [img(image), { type: 'text', text: `Perkirakan kalori & makro makanan di foto ini.${note ? `\nCatatan pengguna: ${note}` : ''}` }],
    schema: foodPhotoSchema,
  });
  return sanitizeFood(r);
}

/** Refine with the user's answers. Text-only (no image re-upload) to keep cost low. */
export async function refineFoodEstimate(previous: FoodPhotoResult, answers: { question: string; answer: string }[], profile: UserProfile): Promise<FoodPhotoResult> {
  const r = await runStructured({
    feature: 'food-photo',
    system: FOOD_PHOTO_SYSTEM(profile.calorieFloorKcal),
    parts: [
      {
        type: 'text',
        text: `Ini perkiraan sebelumnya (JSON):\n${JSON.stringify(previous)}\n\nJawaban pengguna atas pertanyaan klarifikasi:\n${answers
          .map((a) => `- ${a.question} → ${a.answer}`)
          .join('\n')}\n\nPerbarui perkiraan berdasarkan jawaban ini. Jangan ajukan pertanyaan lagi (questions kosong).`,
      },
    ],
    schema: foodPhotoSchema,
  });
  return sanitizeFood({ ...r, questions: [] });
}

export async function readNutritionLabel(image: PreparedImage): Promise<NutritionLabelResult> {
  return runStructured({
    feature: 'nutrition-label',
    system: NUTRITION_LABEL_SYSTEM,
    parts: [img(image), { type: 'text', text: 'Baca label gizi ini.' }],
    schema: nutritionLabelSchema,
    maxTokens: 3000,
  });
}

export async function readHealthScreenshot(image: PreparedImage): Promise<ScreenshotResult> {
  const r = await runStructured({
    feature: 'screenshot',
    system: SCREENSHOT_SYSTEM,
    parts: [img(image), { type: 'text', text: 'Ambil angka tidur/langkah/nadi dari screenshot ini.' }],
    schema: screenshotSchema,
    maxTokens: 3000,
  });
  return sanitizeScreenshot(r);
}

export interface WeeklyReviewInput {
  thisWeek: WeekSummary;
  lastWeek: WeekSummary;
  insights: Insight[];
  observedTdee: number | null;
  daysSinceStart: number;
  ifEnabled: boolean;
  ramadan: boolean;
}

export async function weeklyReview(input: WeeklyReviewInput, profile: UserProfile): Promise<WeeklyReviewResult> {
  // Only aggregated statistics are sent — no free-text notes, photos or meal names.
  const payload = {
    targets: {
      kalori: profile.calorieTargetKcal,
      batas_bawah_kalori: profile.calorieFloorKcal,
      protein_min_g: profile.proteinMinG,
      protein_target_g: profile.proteinTargetG,
      langkah: profile.stepGoal,
      tidur_jam: profile.sleepTargetHours,
      target_berat: profile.goalWeightKg,
    },
    minggu_ini: input.thisWeek,
    minggu_lalu: input.lastWeek,
    insight: input.insights.map((i) => ({ pertanyaan: i.question, status: i.status, hasil: i.text })),
    tdee_terobservasi: input.observedTdee,
    hari_sejak_mulai: input.daysSinceStart,
    puasa_intermiten_aktif: input.ifEnabled,
    mode_ramadan: input.ramadan,
  };
  const r = await runStructured({
    feature: 'weekly-review',
    system: WEEKLY_REVIEW_SYSTEM(profile.calorieFloorKcal),
    parts: [{ type: 'text', text: `Data ringkas (JSON):\n${JSON.stringify(payload)}` }],
    schema: weeklyReviewSchema,
  });
  return { ...r, highlights: r.highlights.slice(0, 3), suggestions: guardAdvice(r.suggestions, profile.calorieFloorKcal).slice(0, 3) };
}

export interface MenuInput {
  remainingKcal: number;
  remainingProteinG: number;
  context: string;
  gerd: boolean;
  uricAcid: boolean;
  note?: string;
}

export async function suggestMenu(input: MenuInput, profile: UserProfile): Promise<MenuResult> {
  const r = await runStructured({
    feature: 'menu',
    system: MENU_SYSTEM(profile.calorieFloorKcal),
    parts: [
      {
        type: 'text',
        text: `Sisa kebutuhan hari ini (perkiraan): ${Math.max(0, Math.round(input.remainingKcal))} kkal, protein ${Math.max(0, Math.round(input.remainingProteinG))} g.
Konteks: ${input.context}.
GERD: ${input.gerd ? 'ya, sedang/kadang bergejala' : 'tidak ditandai'}.
Asam urat tinggi: ${input.uricAcid ? 'ya' : 'tidak ditandai'}.
${input.note ? `Catatan: ${input.note}` : ''}
Berikan 3 opsi.`,
      },
    ],
    schema: menuSchema,
  });
  return {
    note: r.note,
    options: r.options.slice(0, 3).map((o) => ({
      ...o,
      kcal: Math.max(0, Math.round(o.kcal)),
      protein_g: Math.max(0, Math.round(o.protein_g)),
      carbs_g: Math.max(0, Math.round(o.carbs_g)),
      fat_g: Math.max(0, Math.round(o.fat_g)),
    })),
  };
}
