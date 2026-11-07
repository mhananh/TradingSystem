import { z } from 'zod';

// Schemas kept simple (no numeric bounds) so they translate to provider JSON-schema subsets.
// Range checks happen afterwards in sanitize* helpers.

export const foodItemSchema = z.object({
  name: z.string(),
  portion: z.string(),
  kcal: z.number(),
  kcal_min: z.number(),
  kcal_max: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

export const foodPhotoSchema = z.object({
  is_food: z.boolean(),
  items: z.array(foodItemSchema),
  confidence: z.enum(['low', 'medium', 'high']),
  assumptions: z.array(z.string()),
  questions: z.array(z.object({ question: z.string(), options: z.array(z.string()) })),
  gerd_note: z.string().nullable(),
});
export type FoodPhotoResult = z.infer<typeof foodPhotoSchema>;

export const nutritionLabelSchema = z.object({
  readable: z.boolean(),
  product_name: z.string().nullable(),
  serving_description: z.string().nullable(),
  per_serving_kcal: z.number().nullable(),
  per_serving_protein_g: z.number().nullable(),
  per_serving_carbs_g: z.number().nullable(),
  per_serving_fat_g: z.number().nullable(),
  servings_per_package: z.number().nullable(),
});
export type NutritionLabelResult = z.infer<typeof nutritionLabelSchema>;

export const screenshotSchema = z.object({
  readable: z.boolean(),
  date_shown: z.string().nullable(), // YYYY-MM-DD if visible
  sleep_total_minutes: z.number().nullable(),
  bedtime: z.string().nullable(), // HH:mm
  wake_time: z.string().nullable(), // HH:mm
  steps: z.number().nullable(),
  resting_hr: z.number().nullable(),
  spo2_min: z.number().nullable(),
  sleep_score: z.number().nullable(),
});
export type ScreenshotResult = z.infer<typeof screenshotSchema>;

export const weeklyReviewSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  suggestions: z.array(z.object({ title: z.string(), detail: z.string() })),
  data_gaps: z.array(z.string()),
  see_clinician: z.boolean(),
});
export type WeeklyReviewResult = z.infer<typeof weeklyReviewSchema>;

export const menuSchema = z.object({
  options: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      why: z.string(),
    }),
  ),
  note: z.string().nullable(),
});
export type MenuResult = z.infer<typeof menuSchema>;

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export function sanitizeFood(r: FoodPhotoResult): FoodPhotoResult {
  return {
    ...r,
    items: r.items.slice(0, 15).map((i) => {
      const kcal = clamp(Math.round(i.kcal), 0, 3000);
      const lo = clamp(Math.round(Math.min(i.kcal_min, kcal)), 0, kcal);
      const hi = clamp(Math.round(Math.max(i.kcal_max, kcal)), kcal, 4000);
      return {
        ...i,
        name: i.name.slice(0, 120),
        portion: i.portion.slice(0, 120),
        kcal,
        kcal_min: lo,
        kcal_max: hi,
        protein_g: clamp(Math.round(i.protein_g * 10) / 10, 0, 300),
        carbs_g: clamp(Math.round(i.carbs_g * 10) / 10, 0, 500),
        fat_g: clamp(Math.round(i.fat_g * 10) / 10, 0, 300),
      };
    }),
    assumptions: r.assumptions.slice(0, 6),
    questions: r.questions.slice(0, 2).map((q) => ({ question: q.question, options: q.options.slice(0, 5) })),
  };
}

export function sanitizeScreenshot(r: ScreenshotResult): ScreenshotResult {
  const okTime = (t: string | null) => (t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null);
  const inRange = (n: number | null, lo: number, hi: number) => (n != null && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null);
  return {
    readable: r.readable,
    date_shown: r.date_shown && /^\d{4}-\d{2}-\d{2}$/.test(r.date_shown) ? r.date_shown : null,
    sleep_total_minutes: inRange(r.sleep_total_minutes, 0, 1440),
    bedtime: okTime(r.bedtime),
    wake_time: okTime(r.wake_time),
    steps: inRange(r.steps, 0, 100000),
    resting_hr: inRange(r.resting_hr, 30, 130),
    spo2_min: inRange(r.spo2_min, 70, 100),
    sleep_score: inRange(r.sleep_score, 0, 100),
  };
}

/**
 * Guardrail on model advice: drop suggestions that recommend intake below the floor or
 * extending fasting, regardless of what the prompt said.
 */
export function guardAdvice<T extends { title: string; detail: string }>(items: T[], calorieFloor: number): T[] {
  return items.filter((s) => {
    const text = `${s.title} ${s.detail}`.toLowerCase();
    const kcalMentions = [...text.matchAll(/(\d[\d.]{2,5})\s*(k?kal|kcal)/g)].map((m) => Number(m[1].replace(/\./g, '')));
    if (kcalMentions.some((k) => k >= 500 && k < calorieFloor)) return false;
    if (/16\s*[:/]\s*8|18\s*[:/]\s*6|20\s*[:/]\s*4|omad|perpanjang\w* puasa|puasa lebih lama/.test(text)) return false;
    return true;
  });
}
