import type { Message, Sample } from './contracts';

export function conversationWindow(messages: Message[], prompt: string): Message[] {
  const history = messages.slice(-20);
  let total = history.reduce((sum, message) => sum + message.content.length, prompt.length);
  // Remove whole turns so the bounded context still begins with a user message.
  while (
    history.length &&
    (total > 32000 || history.some((message) => message.content.length > 16000))
  ) {
    const removed = history.splice(0, 2);
    total -= removed.reduce((sum, message) => sum + message.content.length, 0);
  }
  return [...history, { role: 'user', content: prompt }];
}

export function summarize(samples: Sample[]) {
  const successful = samples.filter((sample) => sample.status === 'success');
  const durations = successful.map((sample) => sample.roundTripMs).sort((a, b) => a - b);
  return {
    attempts: samples.length,
    completed: successful.length,
    averageMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    p95Ms: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
    inputTokens:
      successful.length && successful.every((sample) => sample.inputTokens !== null)
        ? successful.reduce((sum, sample) => sum + (sample.inputTokens ?? 0), 0)
        : null,
    outputTokens:
      successful.length && successful.every((sample) => sample.outputTokens !== null)
        ? successful.reduce((sum, sample) => sum + (sample.outputTokens ?? 0), 0)
        : null,
  };
}

export const formatDuration = (ms: number | null) =>
  ms === null ? '—' : `${(ms / 1000).toFixed(2)} s`;
export const formatNumber = (value: number | null) =>
  value === null ? '—' : new Intl.NumberFormat().format(value);
export const money = (value: number | undefined, currency: string | null) =>
  value === undefined || !currency
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
      }).format(value);
