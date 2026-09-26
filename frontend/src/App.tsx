import { useEffect, useState } from 'react';
import type { AppConfig } from './lib/contracts';
import { api } from './lib/api';
import { Icon } from './components/Icon';
import { ChatPage } from './features/chat/ChatPage';
import { useChat } from './features/chat/useChat';
import { CostPage } from './features/costs/CostPage';

function Workspace({ config }: { config: AppConfig }) {
  const [page, setPage] = useState(location.pathname === '/costs' ? 'costs' : 'chat');
  const chat = useChat(config);
  useEffect(() => {
    const navigate = () => setPage(location.pathname === '/costs' ? 'costs' : 'chat');
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);
  useEffect(() => {
    document.title = `${page === 'chat' ? 'Chat playground' : 'Cost explorer'} · EcoCompute`;
  }, [page]);
  function navigate(next: string) {
    history.pushState({}, '', next === 'chat' ? '/' : '/costs');
    setPage(next);
  }
  return (
    <div className="flex min-h-screen mobile:block">
      <a
        href="#main"
        className="fixed top-[-80px] left-[270px] z-[10] bg-white p-[12px] mobile:left-[18px] [&:focus]:top-[12px]"
      >
        Skip to content
      </a>
      <aside className="fixed [inset:0_auto_0_0] z-[3] flex w-[235px] flex-col bg-sidebar px-[20px] pt-[34px] pb-0 text-[#d8e1db] compact:w-[205px] compact:px-[13px] tablet:w-[185px] mobile:relative mobile:block mobile:w-full mobile:px-[18px] mobile:pt-[17px] mobile:pb-[12px]">
        <a
          href="/"
          className="flex items-center gap-[9px] px-[6px] py-0 text-[22px] font-semibold tracking-[-0.7px] tablet:text-[19px] mobile:p-0 mobile:text-[21px]"
          onClick={(event) => {
            event.preventDefault();
            navigate('chat');
          }}
        >
          <span className="inline-flex items-center justify-center text-[#c4e7a6]">
            <Icon name="leaf" size={24} />
          </span>
          EcoCompute<span className="ml-[-9px] text-[#bdd9a4]">.</span>
        </a>
        <div className="mx-[14px] mt-[52px] mb-[15px] text-[9px] tracking-[1.9px] text-[#779487] mobile:hidden">
          WORKSPACE
        </div>
        <nav
          className="grid gap-[7px] mobile:mt-[16px] mobile:flex mobile:gap-[8px]"
          aria-label="Main navigation"
        >
          <a
            href="/"
            aria-current={page === 'chat' ? 'page' : undefined}
            className="flex items-center gap-[12px] rounded-[7px] px-[14px] py-[12px] text-[12px] text-[#a7b9ae] mobile:flex-1 mobile:px-[12px] mobile:py-[10px] mobile:text-[11px] [&:hover]:bg-[#2c4035] [&>svg:last-child]:ml-auto [&>svg:last-child]:opacity-0 [&[aria-current=page]]:bg-[#31463a] [&[aria-current=page]]:text-[#ddedce] [&[aria-current=page]:hover]:bg-[#2c4035] [&[aria-current=page]>svg:last-child]:opacity-[1]"
            onClick={(event) => {
              event.preventDefault();
              navigate('chat');
            }}
          >
            <Icon name="chat" size={19} />
            Chat playground
            <Icon name="chevron" size={13} />
          </a>
          <a
            href="/costs"
            aria-current={page === 'costs' ? 'page' : undefined}
            className="flex items-center gap-[12px] rounded-[7px] px-[14px] py-[12px] text-[12px] text-[#a7b9ae] mobile:flex-1 mobile:px-[12px] mobile:py-[10px] mobile:text-[11px] [&:hover]:bg-[#2c4035] [&>svg:last-child]:ml-auto [&>svg:last-child]:opacity-0 [&[aria-current=page]]:bg-[#31463a] [&[aria-current=page]]:text-[#ddedce] [&[aria-current=page]:hover]:bg-[#2c4035] [&[aria-current=page]>svg:last-child]:opacity-[1]"
            onClick={(event) => {
              event.preventDefault();
              navigate('costs');
            }}
          >
            <Icon name="chart" size={19} />
            Cost explorer
            <Icon name="chevron" size={13} />
          </a>
        </nav>
        <div className="mx-[13px] mt-auto mb-[35px] pt-[40px] mobile:hidden">
          <div className="mb-[25px] flex h-[48px] items-end gap-[6px] [&_span]:h-[25%] [&_span]:w-[10px] [&_span]:rounded-[2px] [&_span]:border [&_span]:border-solid [&_span]:border-[#577659] [&_span]:bg-[#3f6047] [&_span:nth-child(2)]:h-[45%] [&_span:nth-child(3)]:h-[35%] [&_span:nth-child(4)]:h-[75%] [&_span:nth-child(5)]:h-[58%] [&_span:nth-child(6)]:h-full [&_span:nth-child(6)]:border-[#b9d798] [&_span:nth-child(6)]:bg-[#b9d798] [&_span:nth-child(7)]:h-[70%]">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <span className="text-[8px] font-[650] tracking-[1.3px] text-[#86a78f]">
            LESS IDLE. MORE INSIGHT.
          </span>
          <h3 className="mx-0 my-[12px] text-[17px] leading-[1.55] font-[450] text-[#d2dfd6] tablet:text-[15px]">
            Small experiments.
            <br />
            Smarter infrastructure.
          </h3>
          <p className="text-[11px] leading-[1.9] text-[#90a599]">
            Understanding what it takes to run AI, one request at a time.
          </p>
        </div>
        <div className="flex items-center gap-[10px] border-t [border-top-style:solid] border-t-[#34473b] px-[4px] py-[21px] text-[11px] mobile:hidden [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#829b8c] [&>span:last-child]:ml-auto">
          <span className="grid h-[32px] w-[32px] place-items-center rounded-[6px] bg-[#2c4335] text-[#a0b796]">
            <Icon name="globe" size={20} />
          </span>
          <div>
            EcoCompute Lab<small>Azure · Microsoft Foundry</small>
          </div>
          <span className="inline-block h-[6px] w-[6px] shrink-0 rounded-[100%] bg-[#82a67f]" />
        </div>
      </aside>
      <div className="ml-[235px] flex min-h-screen w-[calc(100%_-_235px)] flex-col compact:ml-[205px] compact:w-[calc(100%_-_205px)] tablet:ml-[185px] tablet:w-[calc(100%_-_185px)] mobile:m-0 mobile:w-full">
        <header className="flex h-[73px] items-center justify-between border-b [border-bottom-style:solid] border-b-line bg-[#fafbf8] px-[38px] py-0 compact:px-[25px] compact:py-0 mobile:h-[48px] mobile:px-[18px] mobile:py-0">
          <div className="flex items-center gap-[15px] text-[11px] text-[#69716a] mobile:gap-[8px] mobile:text-[10px] [&_strong]:font-medium [&_strong]:text-[#47574e]">
            Workspace
            <Icon name="chevron" size={13} />
            <strong>{page === 'chat' ? 'Chat playground' : 'Cost explorer'}</strong>
          </div>
          <span className="flex items-center gap-[7px] rounded-[5px] border border-solid border-[#dce3d7] bg-[#f3f6ec] px-[9px] py-[5px] text-[10px] text-[#64745a] tablet:text-[9px] mobile:px-[7px] mobile:py-[3px] mobile:text-[8px]">
            <span className="inline-block h-[6px] w-[6px] shrink-0 rounded-[100%] bg-[#82a67f]" />
            Research environment
          </span>
        </header>
        <main
          id="main"
          className="m-auto w-full max-w-[1580px] flex-1 px-[38px] pt-[34px] pb-[25px] wide:pt-[45px] compact:px-[25px] compact:pt-[28px] compact:pb-[24px] mobile:px-[18px] mobile:pt-[26px] mobile:pb-[20px]"
        >
          {page === 'chat' ? (
            <ChatPage config={config} chat={chat} />
          ) : (
            <CostPage samples={chat.samples} />
          )}
        </main>
        <footer className="flex justify-between gap-[12px] px-[38px] pt-0 pb-[22px] text-[9px] text-[#6a7263] compact:px-[25px] mobile:px-[18px] mobile:pt-0 mobile:pb-[20px] mobile:text-[8px] tablet:[&>span:last-child]:hidden">
          <span>
            EcoCompute <span className="mx-[6px] my-0 text-[#6a7165]">/</span> An experiment in
            thoughtful computing.
          </span>
          <span>Built to measure, not assume.</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    api
      .config(controller.signal)
      .then(setConfig)
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Could not load configuration.');
      });
    return () => controller.abort();
  }, [attempt]);
  if (!config)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-[20px] bg-[#f4f6f0] [&_p]:max-w-[480px] [&_p]:px-[20px] [&_p]:py-0 [&_p]:text-center [&_p]:text-[13px] [&_p]:text-[#637457]">
        <span className="inline-flex items-center justify-center text-[#547b4b]">
          <Icon name="leaf" size={30} />
        </span>
        <h1>EcoCompute</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="inline-flex items-center justify-center gap-[8px] rounded-[6px] border border-solid border-brand bg-brand px-[13px] py-[9px] text-[11px] font-medium whitespace-nowrap text-white"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </>
        ) : (
          <p role="status">Preparing your workspace…</p>
        )}
      </div>
    );
  return <Workspace config={config} />;
}
