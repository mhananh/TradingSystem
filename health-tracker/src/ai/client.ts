import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db, getMeta, newId, setMeta } from '../db/db';
import type { AiUsageRecord } from '../domain/types';
import { getApiKey, type AiProvider } from './secrets';

export type AiFeature = AiUsageRecord['feature'];
export type Effort = 'low' | 'medium' | 'high';

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  claudeVisionModel: string; // food photo, label, screenshot
  claudeTextModel: string; // weekly review, menu
  claudeEffort: Effort;
  geminiModel: string;
  consentAt?: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  provider: 'claude',
  claudeVisionModel: 'claude-haiku-5-5',
  claudeTextModel: 'claude-sonnet-5-5',
  claudeEffort: 'low',
  geminiModel: 'gemini-flash-latest',
};

export const CLAUDE_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (hemat, cepat)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (lebih teliti)' },
];

// USD per 1M tokens (input, output). Used only for an in-app cost estimate.
const CLAUDE_PRICES: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
};

export async function getAiSettings(): Promise<AiSettings> {
  return { ...DEFAULT_AI_SETTINGS, ...(await getMeta<Partial<AiSettings>>('aiSettings', {})) };
}
export async function saveAiSettings(s: AiSettings): Promise<void> {
  await setMeta('aiSettings', s);
}

export class AiError extends Error {
  constructor(
    public kind: 'disabled' | 'no-key' | 'auth' | 'rate' | 'network' | 'refusal' | 'parse' | 'truncated' | 'server',
    message: string,
  ) {
    super(message);
  }
}

export type Part = { type: 'text'; text: string } | { type: 'image'; mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string };

export interface StructuredRequest<T extends z.ZodType> {
  feature: AiFeature;
  system: string;
  parts: Part[];
  schema: T;
  maxTokens?: number;
}

function modelFor(s: AiSettings, feature: AiFeature): string {
  if (s.provider === 'gemini') return s.geminiModel;
  return feature === 'weekly-review' || feature === 'menu' ? s.claudeTextModel : s.claudeVisionModel;
}

async function recordUsage(feature: AiFeature, provider: AiProvider, model: string, inputTokens: number, outputTokens: number) {
  const price = provider === 'claude' ? CLAUDE_PRICES[model] : undefined;
  const estCostUsd = price ? (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000 : 0;
  try {
    await db.aiUsage.add({ id: newId(), at: new Date().toISOString(), feature, provider, model, inputTokens, outputTokens, estCostUsd });
  } catch {
    /* usage logging must never break the feature */
  }
}

export async function runStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  const s = await getAiSettings();
  if (!s.enabled || !s.consentAt) throw new AiError('disabled', 'Fitur AI belum diaktifkan. Aktifkan di Pengaturan → AI.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('network', 'Tidak ada koneksi internet. Fitur AI butuh internet; pencatatan manual tetap bisa.');
  const key = await getApiKey(s.provider);
  if (!key) throw new AiError('no-key', 'API key belum diisi. Buka Pengaturan → AI.');
  const model = modelFor(s, req.feature);
  return s.provider === 'claude' ? runClaude(req, key, model, s.claudeEffort) : runGemini(req, key, model);
}

async function runClaude<T extends z.ZodType>(req: StructuredRequest<T>, apiKey: string, model: string, effort: Effort): Promise<z.infer<T>> {
  // Loaded on demand so the SDK isn't part of the initial app bundle.
  const [{ default: AnthropicSdk }, { betaZodOutputFormat }] = await Promise.all([import('@anthropic-ai/sdk'), import('@anthropic-ai/sdk/helpers/beta/zod')]);
  // Personal BYOK app: the key belongs to the device owner and is never bundled in the build.
  const client = new AnthropicSdk({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 90_000 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = req.parts.map((p) =>
    p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.base64 } },
  );
  // Server-side refusal fallback is supported for Claude Sonnet 5.5 (not Haiku).
  const fallback: { fallbacks?: 'default'; betas?: Anthropic.Beta.AnthropicBeta[] } = model.startsWith('claude-sonnet-5-5')
    ? { fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] }
    : {};
  try {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: req.maxTokens ?? 6000,
      system: req.system,
      messages: [{ role: 'user', content }],
      output_config: { effort, format: betaZodOutputFormat(req.schema) },
      ...fallback,
    });
    await recordUsage(req.feature, 'claude', model, res.usage.input_tokens, res.usage.output_tokens);
    if (res.stop_reason === 'refusal') throw new AiError('refusal', 'AI menolak permintaan ini. Coba foto/teks lain atau isi manual.');
    if (res.stop_reason === 'max_tokens') throw new AiError('truncated', 'Jawaban AI terpotong. Coba lagi.');
    if (res.parsed_output == null) throw new AiError('parse', 'Jawaban AI tidak bisa dibaca. Coba lagi atau isi manual.');
    const check = req.schema.safeParse(res.parsed_output);
    if (!check.success) throw new AiError('parse', 'Jawaban AI tidak sesuai format. Coba lagi atau isi manual.');
    return check.data;
  } catch (e) {
    throw mapClaudeError(e, AnthropicSdk);
  }
}

function mapClaudeError(e: unknown, Anthropic: typeof import('@anthropic-ai/sdk').default): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new AiError('auth', 'API key Claude ditolak. Periksa key di Pengaturan → AI (dan saldo/billing di console.anthropic.com).');
  if (e instanceof Anthropic.RateLimitError) return new AiError('rate', 'Batas pemakaian tercapai. Tunggu sebentar lalu coba lagi.');
  if (e instanceof Anthropic.APIConnectionError) return new AiError('network', 'Gagal terhubung ke server AI. Periksa koneksi internet.');
  if (e instanceof Anthropic.BadRequestError) return new AiError('server', `Permintaan ditolak server: ${e.message.slice(0, 160)}`);
  if (e instanceof Anthropic.APIError) return new AiError('server', 'Server AI sedang bermasalah. Coba lagi nanti.');
  return new AiError('parse', 'Terjadi kesalahan saat memproses jawaban AI.');
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string };
}

async function runGemini<T extends z.ZodType>(req: StructuredRequest<T>, apiKey: string, model: string): Promise<z.infer<T>> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(req.schema));
  const parts = req.parts.map((p) => (p.type === 'text' ? { text: p.text } : { inline_data: { mime_type: p.mediaType, data: p.base64 } }));
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${req.system}\n\nBalas HANYA dengan JSON valid yang sesuai JSON Schema berikut, tanpa teks lain:\n${jsonSchema}` }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: req.maxTokens ?? 6000 },
      }),
    });
  } catch {
    throw new AiError('network', 'Gagal terhubung ke Gemini. Periksa koneksi internet.');
  }
  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (res.status === 400 && /api key/i.test(body.error?.message ?? '')) throw new AiError('auth', 'API key Gemini tidak valid.');
  if (res.status === 401 || res.status === 403) throw new AiError('auth', 'API key Gemini ditolak. Periksa key di Pengaturan → AI.');
  if (res.status === 429) throw new AiError('rate', 'Kuota Gemini habis/terbatas. Coba lagi nanti.');
  if (res.status === 404) throw new AiError('server', `Model "${model}" tidak ditemukan. Ganti nama model di Pengaturan → AI.`);
  if (!res.ok) throw new AiError('server', `Gemini error (${res.status}). ${body.error?.message?.slice(0, 120) ?? ''}`);
  const u = body.usageMetadata;
  await recordUsage(req.feature, 'gemini', model, u?.promptTokenCount ?? 0, (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0));
  if (body.promptFeedback?.blockReason) throw new AiError('refusal', 'Gemini menolak permintaan ini. Coba foto/teks lain atau isi manual.');
  const cand = body.candidates?.[0];
  if (cand?.finishReason === 'MAX_TOKENS') throw new AiError('truncated', 'Jawaban AI terpotong. Coba lagi.');
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new AiError('parse', 'Jawaban AI tidak bisa dibaca. Coba lagi atau isi manual.');
  }
  const check = req.schema.safeParse(raw);
  if (!check.success) throw new AiError('parse', 'Jawaban AI tidak sesuai format. Coba lagi atau isi manual.');
  return check.data;
}

/** Cheap connectivity/key check used by the "Tes koneksi" button. */
export async function testConnection(): Promise<string> {
  const r = await runStructured({
    feature: 'menu',
    system: 'Balas dengan JSON sesuai skema.',
    parts: [{ type: 'text', text: 'Tes koneksi. Isi ok=true.' }],
    schema: z.object({ ok: z.boolean() }),
    maxTokens: 2000,
  });
  return r.ok ? 'Koneksi berhasil.' : 'Terhubung, tetapi jawaban tidak terduga.';
}

export async function usageThisMonth(): Promise<{ calls: number; usd: number; tokens: number }> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const rows = await db.aiUsage.where('at').aboveOrEqual(start).toArray();
  return {
    calls: rows.length,
    usd: rows.reduce((s, r) => s + r.estCostUsd, 0),
    tokens: rows.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
  };
}
