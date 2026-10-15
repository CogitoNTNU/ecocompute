import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { AppConfig } from './lib/contracts';
import { api } from './lib/api';
import { configureAuth, signIn, signOut } from './lib/auth';
import { Icon } from './components/Icon';
import { ChatPage } from './features/chat/ChatPage';
import { useChat } from './features/chat/useChat';
import { CostPage } from './features/costs/CostPage';

type Page = 'chat' | 'costs';

const pageFromPath = (): Page => (location.pathname === '/costs' ? 'costs' : 'chat');

function userCharLimitCheck(username: string | null) {
  if (username) {
    if (username.length > 23) {
      username = username.slice(0, 23);

      username += '...';
    }

    return username;
  }
}

function Workspace({ config, username }: { config: AppConfig; username: string | null }) {
  const [page, setPage] = useState<Page>(pageFromPath);
  const chat = useChat(config);
  useEffect(() => {
    const navigate = () => setPage(pageFromPath());
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);
  useEffect(() => {
    document.title = `${page === 'chat' ? 'Chat playground' : 'Cost explorer'} · EcoCompute`;
  }, [page]);
  function navigate(event: MouseEvent<HTMLAnchorElement>, next: Page) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (page === next) return;
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
        <div className="flex flex-row">
          <a
            href="/"
            className="flex items-center gap-[9px] px-[6px] py-0 text-[22px] font-semibold tracking-[-0.7px] tablet:text-[19px] mobile:p-0 mobile:text-[21px]"
            onClick={(event) => navigate(event, 'chat')}
          >
            <span className="inline-flex items-center justify-center text-[#c4e7a6]">
              <Icon name="leaf" size={24} />
            </span>
            EcoCompute<span className="ml-[-9px] text-[#bdd9a4]">.</span>
          </a>

          {username && (
            <button
              onClick={() => signOut()}
              className="visible ml-auto justify-self-start rounded-md border border-[#74896b] bg-transparent text-[#eef5e8] hover:bg-[#74896b] md:hidden"
            >
              Sign Out
            </button>
          )}
        </div>

        <nav
          className="mt-8 grid gap-[7px] mobile:mt-[16px] mobile:flex mobile:gap-[8px]"
          aria-label="Main navigation"
        >
          <a
            href="/"
            aria-current={page === 'chat' ? 'page' : undefined}
            className="sidebar-link"
            onClick={(event) => navigate(event, 'chat')}
          >
            <Icon name="chat" size={19} />
            Chat playground
            <Icon name="chevron" size={13} />
          </a>
          <a
            href="/costs"
            aria-current={page === 'costs' ? 'page' : undefined}
            className="sidebar-link"
            onClick={(event) => navigate(event, 'costs')}
          >
            <Icon name="chart" size={19} />
            Cost explorer
            <Icon name="chevron" size={13} />
          </a>
        </nav>
        <div className="justify-left mt-auto flex items-center gap-[10px] border-t [border-top-style:solid] border-t-[#34473b] px-[4px] py-[21px] text-[11px] mobile:hidden [&_small]:mt-[3px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#829b8c] [&>span:last-child]:ml-auto">
          <span className="grid h-[36px] w-[36px] place-items-center rounded-[8px] bg-[#2c4335] text-[#a0b796]">
            <Icon name="user" size={24} />
          </span>
          <div className="flex flex-col items-start gap-1">
            <span>{username ? userCharLimitCheck(username) : 'Research Environment'} </span>
            {username && (
              <button
                onClick={() => signOut()}
                className="justify-self-start rounded-md border border-[#74896b] bg-transparent text-[#eef5e8] hover:bg-[#74896b]"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="ml-[235px] flex min-h-screen w-[calc(100%_-_235px)] flex-col compact:ml-[205px] compact:w-[calc(100%_-_205px)] tablet:ml-[185px] tablet:w-[calc(100%_-_185px)] mobile:m-0 mobile:w-full">
        <main
          id="main"
          className="m-auto w-full max-w-[1580px] flex-1 px-[38px] pt-[34px] pb-[25px] wide:pt-[45px] compact:px-[25px] compact:pt-[28px] compact:pb-[24px] mobile:px-[18px] mobile:pt-[26px] mobile:pb-[20px]"
        >
          {page === 'chat' ? (
            <ChatPage config={config} chat={chat} />
          ) : (
            <CostPage
              samples={chat.samples}
              models={config.models}
              billingUrl={config.backends.find((backend) => backend.id === 'always-on')?.url ?? ''}
            />
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
  const [retryCount, setRetryCount] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setAccessError(null);
    api
      .config(controller.signal)
      .then(async (loaded) => {
        const account = await configureAuth(loaded.auth);
        let authorized = false;
        if (account && loaded.auth) {
          try {
            await api.me(controller.signal);
            authorized = true;
          } catch (failure) {
            if (!controller.signal.aborted)
              setAccessError(failure instanceof Error ? failure.message : 'Access denied.');
          }
        }
        if (!controller.signal.aborted) {
          setUsername(authorized ? (account?.username ?? null) : null);
          setConfig(loaded);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Could not load configuration.');
      });
    return () => controller.abort();
  }, [retryCount]);
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
              onClick={() => setRetryCount((value) => value + 1)}
            >
              Try again
            </button>
          </>
        ) : (
          <p role="status">Preparing your workspace…</p>
        )}
      </div>
    );
  if (config.auth && !username)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-[20px] bg-[#f4f6f0] px-[20px] text-center">
        <span className="text-[#547b4b]">
          <Icon name="leaf" size={30} />
        </span>
        <h1>Sign in to EcoCompute</h1>
        <p className="text-[13px] text-[#637457]">
          Use your NTNU Microsoft account to access chat and costs.
        </p>
        {accessError && (
          <p role="alert" className="text-[12px] text-[#915941]">
            {accessError}
          </p>
        )}
        <button
          className="rounded-[6px] border border-solid border-brand bg-brand px-[16px] py-[10px] text-[12px] font-medium text-white"
          onClick={() =>
            void signIn().catch((failure) =>
              setError(failure instanceof Error ? failure.message : 'Sign-in failed.'),
            )
          }
        >
          Sign in with Microsoft
        </button>
        {accessError && (
          <button className="text-[11px] text-[#64745a] underline" onClick={() => void signOut()}>
            Sign out
          </button>
        )}
        {error && (
          <p role="alert" className="text-[12px] text-[#915941]">
            {error}
          </p>
        )}
      </main>
    );
  return <Workspace config={config} username={username} />;
}
