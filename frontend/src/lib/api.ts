import { z } from 'zod';
import { chatSchema, configSchema, costSchema } from './contracts';
import type { BackendId, Message, ModelId } from './contracts';
import { accessToken } from './auth';

async function request<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  authorized = true,
): Promise<T> {
  let response: Response;
  const deadline = AbortSignal.timeout(120000);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  const token = authorized ? await accessToken() : null;
  try {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    response = await fetch(url, { ...init, headers, signal, credentials: 'omit' });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (deadline.aborted) throw new Error('The backend took too long to respond. Try again later.');
    throw new Error('Could not reach the backend. Check your connection and endpoint.');
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
  config: (signal?: AbortSignal) => request('/api/config', configSchema, { signal }, false),
  me: (signal?: AbortSignal) =>
    request('/api/me', z.object({ authorized: z.literal(true) }), { signal }),
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
