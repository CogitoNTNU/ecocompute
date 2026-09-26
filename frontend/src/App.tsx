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
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            navigate('chat');
          }}
        >
          <span className="brand-icon">
            <Icon name="leaf" size={24} />
          </span>
          EcoCompute<span className="brand-period">.</span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a
            href="/"
            aria-current={page === 'chat' ? 'page' : undefined}
            className={page === 'chat' ? 'active' : ''}
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
            className={page === 'costs' ? 'active' : ''}
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
        <div className="sidebar-project">
          <div className="project-graphic">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <span className="eyebrow">LESS IDLE. MORE INSIGHT.</span>
          <h3>
            Small experiments.
            <br />
            Smarter infrastructure.
          </h3>
          <p>Understanding what it takes to run AI, one request at a time.</p>
        </div>
        <div className="sidebar-footer">
          <span className="lab-icon">
            <Icon name="globe" size={20} />
          </span>
          <div>
            EcoCompute Lab<small>Azure · Microsoft Foundry</small>
          </div>
          <span className="status-dot" />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace
            <Icon name="chevron" size={13} />
            <strong>{page === 'chat' ? 'Chat playground' : 'Cost explorer'}</strong>
          </div>
          <span className="environment-tag">
            <span className="status-dot" />
            Research environment
          </span>
        </header>
        <main id="main">
          {page === 'chat' ? (
            <ChatPage config={config} chat={chat} />
          ) : (
            <CostPage samples={chat.samples} />
          )}
        </main>
        <footer className="app-footer">
          <span>
            EcoCompute <span className="muted">/</span> An experiment in thoughtful computing.
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
      <div className="loading-screen">
        <span className="brand-icon">
          <Icon name="leaf" size={30} />
        </span>
        <h1>EcoCompute</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>
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
