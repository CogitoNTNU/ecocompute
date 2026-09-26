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
      <div className="mb-[30px] flex items-center justify-between gap-[20px] tablet:items-start mobile:mb-[24px] mobile:flex-wrap mobile:gap-[12px] tablet:[&_h1]:text-[25px] mobile:[&_h1]:max-w-[370px] mobile:[&_h1]:text-[25px] [&_p]:mt-[10px] [&_p]:text-[12px] [&_p]:text-[#67726b] mobile:[&_p]:max-w-[330px] mobile:[&_p]:text-[11px] mobile:[&_p]:leading-[1.8]">
        <div>
          <div className="mb-[10px] text-[10px] font-[650] tracking-[1.55px] text-[#76867b]">
            THE PLAYGROUND
          </div>
          <h1>One prompt. Different possibilities.</h1>
          <p>Talk to AI. Explore how your infrastructure changes the experience.</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-[8px] rounded-[6px] border border-solid border-[#dce2d8] bg-white px-[13px] py-[9px] text-[11px] font-medium whitespace-nowrap text-[#465a4c] tablet:mt-[23px] mobile:mt-0 [&:hover:not(:disabled)]:border-[#c2d0bf] [&:hover:not(:disabled)]:bg-[#eff4ed]"
          onClick={chat.clear}
          disabled={chat.pending}
        >
          <Icon name="plus" size={17} />
          New chat
        </button>
      </div>
      <div className="mb-[22px] flex flex-wrap items-center gap-[24px] compact:gap-[15px] mobile:mb-[18px] mobile:gap-[13px]">
        <fieldset className="m-0 min-w-0 p-0 [border:0] mobile:w-full" disabled={chat.pending}>
          <legend className="mb-[8px] p-0 text-[9px] tracking-[1px] text-[#667269] mobile:mb-[6px]">
            01{' '}
            <span className="ml-[7px] text-[10px] tracking-[0.2px] text-[#687a6e]">
              Infrastructure
            </span>
          </legend>
          <div className="flex gap-[4px] rounded-[8px] border border-solid border-[#e4e8e0] bg-[#ecefe9] p-[4px] mobile:flex">
            {config.backends.map((backend) => (
              <button
                key={backend.id}
                type="button"
                aria-pressed={chat.backend === backend.id}
                disabled={!backend.enabled}
                title={!backend.enabled ? 'Configure this backend URL to enable it' : undefined}
                className="flex items-center gap-[8px] rounded-[5px] border border-solid border-transparent bg-transparent px-[11px] py-[7px] text-[11px] whitespace-nowrap text-[#647268] compact:px-[8px] compact:py-[7px] compact:text-[10px] mobile:flex-1 mobile:justify-center mobile:px-[10px] mobile:py-[8px] mobile:text-[11px] [&:hover:not(:disabled)]:bg-[#f9fbf7] [&[aria-pressed=true]]:border-[#dbe3d6] [&[aria-pressed=true]]:bg-white [&[aria-pressed=true]]:text-[#315f46] [&[aria-pressed=true]]:shadow-[0_2px_4px_#1f392607]"
                onClick={() => chat.setBackend(backend.id)}
              >
                <Icon name={backend.id === 'autoscale' ? 'bolt' : 'server'} size={17} />
                {backend.label}
                <span className="rounded-[3px] bg-[#edf1e9] px-[4px] py-[1px] text-[9px] text-[#667264]">
                  {backend.min_replicas === backend.max_replicas
                    ? backend.min_replicas
                    : `${backend.min_replicas}–${backend.max_replicas}`}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-[23px] h-[32px] w-[1px] bg-line tablet:hidden" />
        <fieldset className="m-0 min-w-0 p-0 [border:0] mobile:w-full" disabled={chat.pending}>
          <legend className="mb-[8px] p-0 text-[9px] tracking-[1px] text-[#667269] mobile:mb-[6px]">
            02{' '}
            <span className="ml-[7px] text-[10px] tracking-[0.2px] text-[#687a6e]">AI model</span>
          </legend>
          <div className="flex gap-[4px] rounded-[8px] border border-solid border-[#e4e8e0] bg-[#ecefe9] p-[4px] mobile:flex">
            {config.models.map((model) => (
              <button
                key={model.id}
                aria-pressed={chat.model === model.id}
                disabled={!model.enabled}
                title={!model.enabled ? 'Model deployment is not configured' : undefined}
                className="flex items-center gap-[8px] rounded-[5px] border border-solid border-transparent bg-transparent px-[11px] py-[7px] text-[11px] whitespace-nowrap text-[#647268] compact:px-[8px] compact:py-[7px] compact:text-[10px] mobile:flex-1 mobile:justify-center mobile:px-[10px] mobile:py-[8px] mobile:text-[11px] [&:hover:not(:disabled)]:bg-[#f9fbf7] [&[aria-pressed=true]]:border-[#dbe3d6] [&[aria-pressed=true]]:bg-white [&[aria-pressed=true]]:text-[#315f46] [&[aria-pressed=true]]:shadow-[0_2px_4px_#1f392607]"
                onClick={() => chat.setModel(model.id)}
              >
                <span
                  className={`grid h-[16px] w-[16px] place-items-center rounded-[4px] text-[9px] font-[650] ${model.id === 'gpt-6-luna' ? 'bg-[#eeebf2] text-[#78688f]' : 'bg-[#e7efe8] text-[#4c7765]'}`}
                >
                  {model.id === 'gpt-6-luna' ? 'L' : 'N'}
                </span>
                {model.label}
                {!model.enabled && <span className="text-[10px] text-[#89928d]">Unavailable</span>}
              </button>
            ))}
          </div>
        </fieldset>
        <span className="ml-auto flex gap-[7px] pt-[20px] text-[10px] text-[#677268] compact:hidden">
          <span className="inline-block h-[6px] w-[6px] shrink-0 rounded-[100%] bg-[#82a67f]" />
          Your next request
        </span>
      </div>
      {!chat.canSend && (
        <div className="mb-[20px] flex items-center gap-[10px] rounded-[7px] bg-[#f4efe2] px-[17px] py-[13px] text-[12px] text-[#816d3f]">
          <Icon name="info" />
          Connect a model deployment and backend to start chatting. See the setup guide in the
          repository.
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,_1fr)_272px] [align-items:start] gap-[22px] compact:grid-cols-[minmax(0,_1fr)_240px] compact:gap-[16px] tablet:grid-cols-[1fr]">
        <section
          className="flex h-[calc(100vh_-_315px)] max-h-[900px] min-h-[590px] flex-col overflow-hidden rounded-[10px] border border-solid border-line bg-white wide:min-h-[660px] tablet:h-[600px] mobile:h-[620px] mobile:min-h-[550px]"
          aria-label="AI conversation"
        >
          <div className="flex shrink-0 items-center justify-between gap-[12px] border-b [border-bottom-style:solid] border-b-[#edf0e9] px-[21px] py-[18px] compact:p-[16px] mobile:px-[13px] mobile:py-[16px] [&_p]:mt-[5px] [&_p]:text-[10px] [&_p]:text-[#68735b]">
            <span className="flex items-center gap-[9px] text-[11px] font-medium mobile:gap-[7px] mobile:text-[10px]">
              <span
                className={`inline-block h-[6px] w-[6px] shrink-0 rounded-[100%] ${chat.backend === 'always-on' ? 'bg-[#7598b7]' : 'bg-[#82a67f]'}`}
              />
              {backendLabels[chat.backend]} <span className="text-muted">/</span>{' '}
              {modelLabels[chat.model]}
            </span>
            <span className="text-[8px] tracking-[1.25px] whitespace-nowrap text-[#687169] compact:text-[7px] mobile:text-[6px] mobile:tracking-[0.7px]">
              MICROSOFT FOUNDRY
            </span>
          </div>
          <div
            className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#d6dfd3_transparent] overflow-y-auto overscroll-contain px-[24px] py-[15px] mobile:px-[15px] mobile:py-[12px]"
            role="log"
            aria-label="Conversation"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {chat.messages.length === 0 && (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-0 pt-[15px] pb-[25px] text-center">
                <div className="relative mb-[26px] grid h-[65px] w-[65px] [transform:rotate(-6deg)] place-items-center rounded-[18px] border border-solid border-[#e0e9d8] bg-[#edf2e7] text-[#4e7956] mobile:mb-[20px] [&_svg]:[transform:rotate(6deg)]">
                  <Icon name="leaf" size={36} />
                  <span className="absolute top-[5px] right-[-10px] h-[10px] w-[10px] [transform:rotate(25deg)] rounded-[3px] bg-[#adc893]" />
                </div>
                <span className="mb-[11px] text-[8px] font-[650] tracking-[1.15px] text-[#67735f]">
                  A SMALL QUESTION. A BIGGER PICTURE.
                </span>
                <h2 className="wide:text-[30px] compact:text-[23px] tablet:text-[27px] mobile:text-[23px]">
                  Let’s start a conversation.
                </h2>
                <p className="mt-[12px] text-[12px] leading-[1.8] text-[#687269] wide:text-[14px] mobile:text-[11px]">
                  Choose your backend and model above.
                  <br />
                  Every response tells a little more of the story.
                </p>
                <div className="mt-[28px] flex max-w-[480px] gap-[10px] compact:gap-[6px] mobile:mt-[22px] mobile:w-full mobile:max-w-[300px] mobile:flex-col">
                  {prompts.map((prompt) => (
                    <button
                      className="flex flex-1 items-center gap-[10px] rounded-[7px] border border-solid border-[#e8ece3] bg-[#fafbf8] px-[11px] py-[13px] text-left text-[10px] leading-[1.65] text-[#697a6a] compact:p-[10px] compact:text-[9px] mobile:p-[11px] mobile:text-[10px] [&:hover]:border-[#ccd9c5] [&:hover]:bg-[#f1f5ed] [&>svg:first-child]:text-[#5f7558] [&>svg:last-child]:ml-auto"
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
              <article key={index} className="mx-0 mt-[19px] mb-[27px] flex items-start gap-[12px]">
                <div
                  className={`grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[8px] text-[11px] ${message.role === 'user' ? 'bg-[#f0f1ee] text-[#697264]' : 'bg-[#edf3e7] text-[#587849]'}`}
                >
                  {message.role === 'assistant' ? <Icon name="leaf" size={17} /> : 'Y'}
                </div>
                <div className="w-full min-w-0">
                  <div className="flex min-h-[29px] items-center gap-[10px] text-[11px] font-semibold [&_span]:text-[9px] [&_span]:font-normal [&_span]:text-[#66735e]">
                    {message.role === 'assistant' ? modelLabels[message.result!.model] : 'You'}
                    {message.result && <span>{backendLabels[message.result.backend]}</span>}
                  </div>
                  <div
                    className={`mt-[6px] text-[13px] leading-[1.9] [overflow-wrap:anywhere] whitespace-pre-wrap text-[#435640] ${message.role === 'user' ? 'rounded-[2px_10px_10px_10px] bg-[#f5f7f1] px-[15px] py-[12px]' : ''}`}
                  >
                    {message.content}
                  </div>
                  {message.result && (
                    <div className="mt-[12px] flex flex-wrap gap-[12px] text-[9px] text-[#68725d] [&>span]:flex [&>span]:items-center [&>span]:gap-[4px]">
                      <span>
                        <Icon name="clock" size={12} />
                        {formatDuration(message.roundTripMs ?? null)} round trip
                      </span>
                      <span>
                        {formatNumber(message.result.input_tokens)} in ·{' '}
                        {formatNumber(message.result.output_tokens)} out
                      </span>
                      {message.result.truncated && (
                        <span className="text-[#8d6928]">Output limit reached</span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {chat.pending && (
              <div className="mx-0 mt-[19px] mb-[27px] flex items-start gap-[12px]">
                <div className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[8px] bg-[#edf3e7] text-[11px] text-[#587849]">
                  <Icon name="leaf" size={17} />
                </div>
                <div className="flex min-h-[29px] items-center gap-[4px] [&>span:not(:last-child)]:h-[4px] [&>span:not(:last-child)]:w-[4px] [&>span:not(:last-child)]:animate-thinking [&>span:not(:last-child)]:rounded-[100%] [&>span:not(:last-child)]:bg-[#9eaf8e] [&>span:nth-child(2)]:[animation-delay:0.2s] [&>span:nth-child(3)]:[animation-delay:0.4s]">
                  <span />
                  <span />
                  <span />
                  <span className="ml-[8px] text-[10px] text-[#677358]">
                    Waiting for {modelLabels[chat.model]}…
                  </span>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <div className="px-[20px] pt-0 pb-[14px] mobile:px-[11px] mobile:pt-0 mobile:pb-[11px]">
            {chat.error && (
              <div
                role="alert"
                className="mb-[14px] rounded-[7px] border border-solid border-[#f1d5c8] bg-[#fff1ec] px-[14px] py-[12px] text-[12px] leading-[1.7] text-[#915941]"
              >
                {chat.error}
              </div>
            )}
            <form
              className="rounded-[9px] border border-solid border-[#d8e0d2] bg-white shadow-[0_2px_6px_#31422a04] [&:focus-within]:border-[#9eb698] [&:focus-within]:shadow-[0_0_0_3px_#9eb69814]"
              onSubmit={(event) => {
                event.preventDefault();
                void chat.send();
              }}
            >
              <label className="sr-only" htmlFor="prompt">
                Message
              </label>
              <textarea
                className="max-h-[140px] min-h-[69px] w-full resize-none bg-transparent px-[16px] pt-[16px] pb-[3px] text-[12px] leading-[1.8] text-[#344d3a] [outline:none]! [border:0] placeholder:text-[#687166]"
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
              <div className="flex items-center justify-between pt-[6px] pr-[11px] pb-[10px] pl-[16px] [&>span]:flex [&>span]:items-center [&>span]:gap-[8px] [&>span]:text-[9px] [&>span]:text-[#657263] mobile:[&>span]:gap-[5px] mobile:[&>span]:text-[8px]">
                <span>
                  <Icon name="globe" size={14} />
                  {backendLabels[chat.backend]}
                  <span className="text-muted">·</span>
                  {modelLabels[chat.model]}
                </span>
                {chat.pending ? (
                  <button
                    className="grid h-[32px] w-[32px] place-items-center rounded-[7px] bg-[#776345] text-[#eef3e6] [border:0] [&:disabled]:opacity-[0.45] [&:hover:not(:disabled)]:bg-[#234f33]"
                    type="button"
                    onClick={chat.cancel}
                    aria-label="Stop waiting"
                  >
                    <Icon name="stop" size={17} />
                  </button>
                ) : (
                  <button
                    className="grid h-[32px] w-[32px] place-items-center rounded-[7px] bg-[#365e43] text-[#eef3e6] [border:0] [&:disabled]:opacity-[0.45] [&:hover:not(:disabled)]:bg-[#234f33]"
                    type="submit"
                    disabled={!chat.draft.trim() || !chat.canSend}
                    aria-label="Send message"
                  >
                    <Icon name="arrow" size={20} />
                  </button>
                )}
              </div>
            </form>
            <div className="mt-[10px] flex justify-between px-[3px] py-0 text-[8px] text-[#697166] mobile:text-[7px]">
              <span>Enter to send · Shift + Enter for a new line</span>
              <span>AI can make mistakes.</span>
            </div>
          </div>
        </section>
        <aside className="grid gap-[17px] tablet:grid-cols-[1fr_1fr] mobile:grid-cols-[1fr]">
          <section className="overflow-hidden rounded-[10px] border border-solid border-line bg-white px-[20px] py-[21px] compact:px-[15px] compact:py-[18px] mobile:p-[22px] [&_h3]:mt-[7px] [&_h3]:text-[14px]">
            <div className="text-[8px] font-[650] tracking-[1.15px] text-[#76867b]">
              REQUEST JOURNEY
            </div>
            <h3>A look under the hood</h3>
            <div className="mx-0 my-[24px] mobile:flex mobile:flex-wrap mobile:gap-[12px]">
              <div className="flex items-center gap-[12px] mobile:w-full [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#657362] [&_strong]:block [&_strong]:text-[11px] [&_strong]:font-[550]">
                <span className="grid h-[35px] w-[35px] shrink-0 place-items-center rounded-[8px] border border-solid border-[#e6eae0] bg-[#f5f6f2] text-[#667360]">
                  <Icon name="chat" size={18} />
                </span>
                <div>
                  <strong>Your message</strong>
                  <small>Conversation context included</small>
                </div>
              </div>
              <div className="my-[4px] mr-0 ml-[17px] h-[21px] border-l [border-left-style:dashed] border-l-[#cfdbca] mobile:hidden" />
              <div className="flex items-center gap-[12px] mobile:w-full [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#657362] [&_strong]:block [&_strong]:text-[11px] [&_strong]:font-[550]">
                <span className="grid h-[35px] w-[35px] shrink-0 place-items-center rounded-[8px] border border-solid border-[#dce8d5] bg-[#edf4ea] text-[#537946]">
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
              <div className="my-[4px] mr-0 ml-[17px] h-[21px] border-l [border-left-style:dashed] border-l-[#cfdbca] mobile:hidden" />
              <div className="flex items-center gap-[12px] mobile:w-full [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#657362] [&_strong]:block [&_strong]:text-[11px] [&_strong]:font-[550]">
                <span className="grid h-[35px] w-[35px] shrink-0 place-items-center rounded-[8px] border border-solid border-[#e9e1f0] bg-[#f2eff6] text-[#79688d]">
                  <Icon name="globe" size={18} />
                </span>
                <div>
                  <strong>{modelLabels[chat.model]}</strong>
                  <small>Microsoft Foundry</small>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-[8px] border-t [border-top-style:solid] border-t-[#edf0e8] pt-[17px] text-[#617553] [&_p]:text-[10px] [&_p]:leading-[1.8] [&_p]:text-[#667260] mobile:[&_p]:text-[10px] [&_svg]:mt-[2px] [&_svg]:shrink-0">
              <Icon name="info" size={16} />
              <p>
                {chat.backend === 'autoscale'
                  ? 'An idle backend can scale to zero. The next request may take longer while it starts.'
                  : 'One replica stays available between requests. Idle infrastructure can still incur cost.'}
              </p>
            </div>
          </section>
          <section className="overflow-hidden rounded-[10px] border border-solid border-line bg-white px-[20px] py-[21px] compact:px-[15px] compact:py-[18px] mobile:p-[22px] [&_h3]:mt-[7px] [&_h3]:text-[14px]">
            <div className="text-[8px] font-[650] tracking-[1.15px] text-[#76867b]">
              THIS SESSION · SELECTED PAIR
            </div>
            <h3>Measure as you go</h3>
            <dl className="mx-0 mt-[16px] mb-[13px] [&_dd]:m-0 [&_dd]:font-[550] [&_dd]:text-[#4b6348] [&_dd]:tabular-nums [&_dt]:text-[#667362] [&>div]:flex [&>div]:justify-between [&>div]:px-0 [&>div]:py-[8px] [&>div]:text-[11px] mobile:[&>div]:text-[12px]">
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
            <p className="text-[9px] leading-[1.8] text-[#697261] mobile:text-[10px]">
              Measured in this tab. Refreshing clears the session. These are usage measurements, not
              billing totals.
            </p>
          </section>
          {last?.result && (
            <div className="flex gap-[8px] p-[4px] text-[10px] text-[#58774f] tablet:col-[1/-1] [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#667261]">
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
