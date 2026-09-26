import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { AppConfig, BackendId, Message, ModelId, Sample } from '../../lib/contracts';
import { conversationWindow } from '../../lib/measurements';

export function useChat(config: AppConfig) {
  const [backend, setBackend] = useState<BackendId>(config.backend_mode);
  const [model, setModel] = useState<ModelId>(
    config.models.find((item) => item.enabled)?.id ?? 'gpt-4.1-nano',
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const target = config.backends.find((item) => item.id === backend);
  const canSend = Boolean(
    target?.enabled && config.models.find((item) => item.id === model)?.enabled,
  );

  async function send() {
    const prompt = draft.trim();
    if (!prompt || !canSend || controller.current || !target) return;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort('timeout'), 120000);
    const start = performance.now();
    const previous = messages;
    setPending(true);
    setError(null);
    setDraft('');
    setMessages([...previous, { role: 'user', content: prompt }]);
    let sample: Sample = {
      id: crypto.randomUUID(),
      backend,
      model,
      timestamp: new Date().toISOString(),
      roundTripMs: 0,
      status: 'failed',
      inputTokens: null,
      outputTokens: null,
    };
    try {
      const result = await api.chat(
        target.url,
        backend,
        model,
        conversationWindow(previous, prompt),
        abort.signal,
      );
      if (result.backend !== backend || result.model !== model)
        throw new Error(
          'The response came from a different backend or model. Check the endpoint configuration.',
        );
      sample = {
        ...sample,
        id: result.request_id,
        status: 'success',
        inputTokens: result.input_tokens,
        outputTokens: result.output_tokens,
        roundTripMs: performance.now() - start,
      };
      setMessages([
        ...previous,
        { role: 'user', content: prompt },
        { role: 'assistant', content: result.reply, result, roundTripMs: sample.roundTripMs },
      ]);
    } catch (failure) {
      sample = {
        ...sample,
        roundTripMs: performance.now() - start,
        status: abort.signal.aborted ? 'cancelled' : 'failed',
      };
      setMessages(previous);
      setDraft(prompt);
      setError(
        abort.signal.aborted
          ? (abort.signal.reason === 'timeout'
              ? 'The request timed out.'
              : 'Stopped waiting for the response.') +
              ' Foundry may still finish the request and charge for usage.'
          : failure instanceof Error
            ? failure.message
            : 'The request failed.',
      );
    } finally {
      window.clearTimeout(timeout);
      controller.current = null;
      setPending(false);
      setSamples((current) => [...current, sample]);
    }
  }
  return {
    backend,
    setBackend,
    model,
    setModel,
    messages,
    samples,
    draft,
    setDraft,
    pending,
    error,
    canSend,
    send,
    cancel: () => controller.current?.abort('user'),
    clear: () => {
      if (!controller.current) {
        setMessages([]);
        setDraft('');
        setError(null);
      }
    },
  };
}
export type ChatController = ReturnType<typeof useChat>;
