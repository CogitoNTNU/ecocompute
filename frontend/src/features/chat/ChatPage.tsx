import { useEffect, useRef } from 'react';
import type { AppConfig } from '../../lib/contracts';
import { backendLabels, modelLabels } from '../../lib/contracts';
import { formatDuration, formatNumber, summarize } from '../../lib/measurements';
import { Icon } from '../../components/Icon';
import type { ChatController } from './useChat';

const prompts = [
  'Explain serverless computing in simple terms.',
  'When is an always-on backend more efficient?',
];

export function ChatPage({ config, chat }: { config: AppConfig; chat: ChatController }) {
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stats = summarize(
    chat.samples.filter((sample) => sample.backend === chat.backend && sample.model === chat.model),
  );
  const last = [...chat.messages].reverse().find((message) => message.result);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat.messages, chat.pending]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE PLAYGROUND</div>
          <h1>One prompt. Different possibilities.</h1>
          <p>Talk to AI. Explore how your infrastructure changes the experience.</p>
        </div>
        <button className="button secondary" onClick={chat.clear} disabled={chat.pending}>
          <Icon name="plus" size={17} />
          New chat
        </button>
      </div>
      <div className="experiment-controls">
        <fieldset disabled={chat.pending}>
          <legend>
            01 <span>Infrastructure</span>
          </legend>
          <div className="segmented">
            {config.backends.map((backend) => (
              <button
                key={backend.id}
                type="button"
                aria-pressed={chat.backend === backend.id}
                disabled={!backend.enabled}
                title={!backend.enabled ? 'Configure this backend URL to enable it' : undefined}
                className={chat.backend === backend.id ? 'selected' : ''}
                onClick={() => chat.setBackend(backend.id)}
              >
                <Icon name={backend.id === 'autoscale' ? 'bolt' : 'server'} size={17} />
                {backend.label}
                <span className="replica-tag">
                  {backend.min_replicas === backend.max_replicas
                    ? backend.min_replicas
                    : `${backend.min_replicas}–${backend.max_replicas}`}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="control-divider" />
        <fieldset disabled={chat.pending}>
          <legend>
            02 <span>AI model</span>
          </legend>
          <div className="segmented">
            {config.models.map((model) => (
              <button
                key={model.id}
                aria-pressed={chat.model === model.id}
                disabled={!model.enabled}
                title={!model.enabled ? 'Model deployment is not configured' : undefined}
                className={chat.model === model.id ? 'selected' : ''}
                onClick={() => chat.setModel(model.id)}
              >
                <span className={`model-mark ${model.id === 'gpt-6-luna' ? 'luna' : ''}`}>
                  {model.id === 'gpt-6-luna' ? 'L' : 'N'}
                </span>
                {model.label}
                {!model.enabled && <span className="tiny">Unavailable</span>}
              </button>
            ))}
          </div>
        </fieldset>
        <span className="control-note">
          <span className="status-dot" />
          Your next request
        </span>
      </div>
      {!chat.canSend && (
        <div className="notice">
          <Icon name="info" />
          Connect a model deployment and backend to start chatting. See the setup guide in the
          repository.
        </div>
      )}
      <div className="chat-layout">
        <section className="chat-panel panel" aria-label="AI conversation">
          <div className="panel-heading">
            <span className="panel-title">
              <span className={`status-dot ${chat.backend === 'always-on' ? 'blue' : ''}`} />
              {backendLabels[chat.backend]} <span className="muted">/</span>{' '}
              {modelLabels[chat.model]}
            </span>
            <span className="subtle-label">MICROSOFT FOUNDRY</span>
          </div>
          <div
            className="conversation"
            role="log"
            aria-label="Conversation"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {chat.messages.length === 0 && (
              <div className="welcome">
                <div className="welcome-art">
                  <Icon name="leaf" size={36} />
                  <span className="orbit-dot" />
                </div>
                <span className="eyebrow">A SMALL QUESTION. A BIGGER PICTURE.</span>
                <h2>Let’s start a conversation.</h2>
                <p>
                  Choose your backend and model above.
                  <br />
                  Every response tells a little more of the story.
                </p>
                <div className="prompt-cards">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        chat.setDraft(prompt);
                        input.current?.focus();
                      }}
                    >
                      <Icon name="chat" size={17} />
                      <span>{prompt}</span>
                      <Icon name="chevron" size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat.messages.map((message, index) => (
              <article key={index} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'assistant' ? <Icon name="leaf" size={17} /> : 'Y'}
                </div>
                <div className="message-body">
                  <div className="message-label">
                    {message.role === 'assistant' ? modelLabels[message.result!.model] : 'You'}
                    {message.result && <span>{backendLabels[message.result.backend]}</span>}
                  </div>
                  <div className="message-text">{message.content}</div>
                  {message.result && (
                    <div className="response-meta">
                      <span>
                        <Icon name="clock" size={12} />
                        {formatDuration(message.roundTripMs ?? null)} round trip
                      </span>
                      <span>
                        {formatNumber(message.result.input_tokens)} in ·{' '}
                        {formatNumber(message.result.output_tokens)} out
                      </span>
                      {message.result.truncated && (
                        <span className="warning-text">Output limit reached</span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {chat.pending && (
              <div className="message assistant">
                <div className="message-avatar">
                  <Icon name="leaf" size={17} />
                </div>
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                  <span className="thinking-label">Waiting for {modelLabels[chat.model]}…</span>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <div className="composer-area">
            {chat.error && (
              <div role="alert" className="error-banner">
                {chat.error}
              </div>
            )}
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                void chat.send();
              }}
            >
              <label className="sr-only" htmlFor="prompt">
                Message
              </label>
              <textarea
                id="prompt"
                ref={input}
                value={chat.draft}
                onChange={(event) => chat.setDraft(event.target.value)}
                placeholder="Ask something. See what it takes."
                maxLength={8000}
                rows={2}
                disabled={chat.pending}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void chat.send();
                  }
                }}
              />
              <div className="composer-bottom">
                <span>
                  <Icon name="globe" size={14} />
                  {backendLabels[chat.backend]}
                  <span className="muted">·</span>
                  {modelLabels[chat.model]}
                </span>
                {chat.pending ? (
                  <button
                    className="send-button cancel"
                    type="button"
                    onClick={chat.cancel}
                    aria-label="Stop waiting"
                  >
                    <Icon name="stop" size={17} />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!chat.draft.trim() || !chat.canSend}
                    aria-label="Send message"
                  >
                    <Icon name="arrow" size={20} />
                  </button>
                )}
              </div>
            </form>
            <div className="composer-footnote">
              <span>Enter to send · Shift + Enter for a new line</span>
              <span>AI can make mistakes.</span>
            </div>
          </div>
        </section>
        <aside className="experiment-sidebar">
          <section className="panel insight-card">
            <div className="eyebrow">REQUEST JOURNEY</div>
            <h3>A look under the hood</h3>
            <div className="journey">
              <div className="journey-step">
                <span className="journey-icon">
                  <Icon name="chat" size={18} />
                </span>
                <div>
                  <strong>Your message</strong>
                  <small>Conversation context included</small>
                </div>
              </div>
              <div className="journey-connector" />
              <div className="journey-step">
                <span className="journey-icon green">
                  <Icon name={chat.backend === 'autoscale' ? 'bolt' : 'server'} size={18} />
                </span>
                <div>
                  <strong>{backendLabels[chat.backend]} backend</strong>
                  <small>
                    {chat.backend === 'autoscale'
                      ? '0–3 replicas · scales with demand'
                      : '1 replica · stays running'}
                  </small>
                </div>
              </div>
              <div className="journey-connector" />
              <div className="journey-step">
                <span className="journey-icon purple">
                  <Icon name="globe" size={18} />
                </span>
                <div>
                  <strong>{modelLabels[chat.model]}</strong>
                  <small>Microsoft Foundry</small>
                </div>
              </div>
            </div>
            <div className="insight-note">
              <Icon name="info" size={16} />
              <p>
                {chat.backend === 'autoscale'
                  ? 'An idle backend can scale to zero. The next request may take longer while it starts.'
                  : 'One replica stays available between requests. Idle infrastructure can still incur cost.'}
              </p>
            </div>
          </section>
          <section className="panel insight-card">
            <div className="eyebrow">THIS SESSION · SELECTED PAIR</div>
            <h3>Measure as you go</h3>
            <dl className="metric-list">
              <div>
                <dt>Completed requests</dt>
                <dd>{stats.completed}</dd>
              </div>
              <div>
                <dt>Average round trip</dt>
                <dd>{formatDuration(stats.averageMs)}</dd>
              </div>
              <div>
                <dt>Input tokens</dt>
                <dd>{formatNumber(stats.inputTokens)}</dd>
              </div>
              <div>
                <dt>Output tokens</dt>
                <dd>{formatNumber(stats.outputTokens)}</dd>
              </div>
            </dl>
            <p className="small-note">
              Measured in this tab. Refreshing clears the session. These are usage measurements, not
              billing totals.
            </p>
          </section>
          {last?.result && (
            <div className="last-response">
              <Icon name="check" size={17} />
              <span>
                Last response via {backendLabels[last.result.backend]}
                <small>
                  {formatDuration(last.result.duration_ms)} in Foundry ·{' '}
                  {formatDuration(last.roundTripMs ?? null)} end to end
                </small>
              </span>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
