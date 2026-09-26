import type { z } from 'zod';
import { chatSchema, configSchema, costSchema } from './contracts';
import type { BackendId, Message, ModelId } from './contracts';

async function request<T>(url: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const deadline = AbortSignal.timeout(120000);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  try {
    response = await fetch(url, { ...init, signal, credentials: 'omit' });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (deadline.aborted) throw new Error('The backend took too long to respond. Try again later.');
    throw new Error(
      'Could not reach the backend. Check your connection, endpoint and IP access rule.',
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    throw new Error(
      typeof detail === 'string' ? detail : `The backend returned an error (${response.status}).`,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      'The backend returned an unexpected response. Check that both backends are up to date.',
    );
  return parsed.data;
}

export const api = {
  config: (signal?: AbortSignal) => request('/api/config', configSchema, { signal }),
  costs: (days: number, signal?: AbortSignal) =>
    request(`/api/costs?days=${days}`, costSchema, { signal }),
  chat: (
    url: string,
    backend: BackendId,
    model: ModelId,
    messages: Message[],
    signal: AbortSignal,
  ) =>
    request(`${url.replace(/\/$/, '')}/api/chat`, chatSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        backend,
        model,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    }),
};
