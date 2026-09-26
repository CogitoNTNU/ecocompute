import { z } from 'zod';

export const backendId = z.enum(['autoscale', 'always-on']);
export const modelId = z.enum(['gpt-4.1-nano', 'gpt-6-luna']);
const origin = z.string().refine((value) => {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/'
    );
  } catch {
    return false;
  }
}, 'Invalid backend origin');
export const configSchema = z.object({
  backend_mode: backendId,
  backends: z.array(
    z.object({
      id: backendId,
      label: z.string(),
      url: origin,
      enabled: z.boolean(),
      min_replicas: z.number(),
      max_replicas: z.number(),
    }),
  ),
  models: z.array(z.object({ id: modelId, label: z.string(), enabled: z.boolean() })),
  billing_configured: z.boolean(),
});
export const chatSchema = z.object({
  reply: z.string().min(1),
  model: modelId,
  backend: backendId,
  input_tokens: z.number().nonnegative().nullable(),
  output_tokens: z.number().nonnegative().nullable(),
  cached_tokens: z.number().nonnegative().nullable(),
  duration_ms: z.number().nonnegative(),
  request_id: z.string(),
  truncated: z.boolean(),
});
export const costSchema = z.object({
  status: z.enum(['ready', 'empty', 'not_configured']),
  source: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  fetched_at: z.string().nullable(),
  currency: z.string().nullable(),
  configured_categories: z.array(z.string()),
  totals: z.record(z.string(), z.number()),
  daily: z.array(
    z.object({
      date: z.string(),
      autoscale: z.number(),
      always_on: z.number(),
      foundry: z.number(),
      shared: z.number(),
    }),
  ),
});
export type BackendId = z.infer<typeof backendId>;
export type ModelId = z.infer<typeof modelId>;
export type AppConfig = z.infer<typeof configSchema>;
export type ChatResponse = z.infer<typeof chatSchema>;
export type CostReport = z.infer<typeof costSchema>;
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  result?: ChatResponse;
  roundTripMs?: number;
};
export type Sample = {
  id: string;
  backend: BackendId;
  model: ModelId;
  timestamp: string;
  roundTripMs: number;
  status: 'success' | 'failed' | 'cancelled';
  inputTokens: number | null;
  outputTokens: number | null;
};
export const backendLabels: Record<BackendId, string> = {
  autoscale: 'Autoscale',
  'always-on': 'Always-on',
};
export const modelLabels: Record<ModelId, string> = {
  'gpt-4.1-nano': 'GPT-4.1 Nano',
  'gpt-6-luna': 'GPT-6 Luna',
};
