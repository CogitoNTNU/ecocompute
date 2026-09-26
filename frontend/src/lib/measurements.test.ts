import { describe, expect, it } from 'vitest';
import { conversationWindow, summarize } from './measurements';
import { configSchema } from './contracts';
import type { Message, Sample } from './contracts';

describe('bounded conversations', () => {
  it('keeps complete turns within message and character limits', () => {
    const history: Message[] = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: 'a'.repeat(3000),
    }));
    const result = conversationWindow(history, 'new prompt');
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(
      32000,
    );
    expect(result[0].role).toBe('user');
    expect(result.at(-1)?.content).toBe('new prompt');
    expect(history).toHaveLength(30);
  });
});

describe('measurement summaries', () => {
  const base: Sample = {
    id: 'one',
    backend: 'autoscale',
    model: 'gpt-6-luna',
    timestamp: '2026-09-01',
    roundTripMs: 1200,
    status: 'success',
    inputTokens: 100,
    outputTokens: 20,
  };
  it('excludes failed requests from latency and token totals', () => {
    const stats = summarize([
      base,
      { ...base, status: 'failed', roundTripMs: 60000, inputTokens: null, outputTokens: null },
    ]);
    expect(stats).toMatchObject({
      attempts: 2,
      completed: 1,
      averageMs: 1200,
      p95Ms: 1200,
      inputTokens: 100,
      outputTokens: 20,
    });
  });
  it('does not turn missing measurements into zero', () => {
    expect(summarize([])).toMatchObject({ averageMs: null, inputTokens: null, outputTokens: null });
  });
});

it('rejects credential-bearing and unsafe backend URLs', () => {
  const config = {
    backend_mode: 'autoscale',
    backends: [
      {
        id: 'autoscale',
        label: 'Auto',
        url: 'https://user:secret@example.test',
        enabled: true,
        min_replicas: 0,
        max_replicas: 3,
      },
    ],
    models: [],
    billing_configured: false,
  };
  expect(configSchema.safeParse(config).success).toBe(false);
  config.backends[0].url = 'http://public.example.test';
  expect(configSchema.safeParse(config).success).toBe(false);
});
