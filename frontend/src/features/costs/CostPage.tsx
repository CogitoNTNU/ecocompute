import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import type { CostReport, Sample } from '../../lib/contracts';
import { backendLabels, modelLabels } from '../../lib/contracts';
import { formatDuration, formatNumber, money, summarize } from '../../lib/measurements';
import { categories, CostChart } from './CostChart';

function exportMeasurements(samples: Sample[]) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          source: 'EcoCompute browser session; not billing data',
          exportedAt: new Date().toISOString(),
          samples,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ecocompute-session.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CostPage({ samples }: { samples: Sample[] }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setReport(null);
    api
      .costs(days, controller.signal)
      .then(setReport)
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Could not load billing.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, refresh]);
  const ready = report?.status === 'ready';
  const total = ready
    ? Object.values(report.totals).reduce((sum, value) => sum + value, 0)
    : undefined;
  const max = Math.max(0.01, ...Object.values(report?.totals ?? {}).map(Math.abs));
  const session = summarize(samples);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE BIGGER PICTURE</div>
          <h1>Understand the cost of a conversation.</h1>
          <p>Compare infrastructure spend. Keep model usage in perspective.</p>
        </div>
        <div className="heading-actions">
          <label className="sr-only" htmlFor="period">
            Billing period
          </label>
          <select
            id="period"
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            className="button secondary square"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            aria-label="Refresh billing"
          >
            <Icon name="refresh" size={17} />
          </button>
        </div>
      </div>
      <div className="billing-context">
        <span className={`source-badge ${ready ? 'connected' : ''}`}>
          <span className="status-dot" />
          {loading
            ? 'Loading Azure billing'
            : ready
              ? 'Azure-reported costs'
              : error
                ? 'Billing unavailable'
                : report?.status === 'empty'
                  ? 'Awaiting billing data'
                  : 'Billing not connected'}
        </span>
        <span>
          {report ? `${report.start_date} — ${report.end_date} · UTC` : 'Complete UTC days only'}
          <span className="dot-divider">·</span>Billing data is delayed
        </span>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="cost-stats">
        <div className="stat-card featured">
          <div className="stat-title">
            Tracked resource spend
            <Icon name="chart" size={18} />
          </div>
          <strong>{money(total, report?.currency ?? null)}</strong>
          <span>Actual pre-tax cost · selected resources</span>
        </div>
        {categories.slice(0, 3).map((category) => (
          <div className="stat-card" key={category.key}>
            <div className="stat-title">
              <span className="category-dot" style={{ background: category.color }} />
              {category.label}
            </div>
            <strong>
              {money(ready ? report.totals[category.key] : undefined, report?.currency ?? null)}
            </strong>
            <span>
              {category.key === 'foundry'
                ? 'Shared model service · both backends'
                : category.key === 'autoscale'
                  ? '0–3 replicas · usage-based scaling'
                  : '1 replica · continuously available'}
            </span>
          </div>
        ))}
      </div>
      <div className="cost-chart-layout">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Daily cost over time</h3>
              <p>Infrastructure and AI, side by side.</p>
            </div>
            <span className="subtle-label">{report?.currency ?? 'BILLING CURRENCY'}</span>
          </div>
          {ready ? (
            <CostChart report={report} />
          ) : (
            <div className="chart-empty" role="status">
              <div className="empty-chart-icon">
                <Icon name="chart" size={30} />
              </div>
              <h3>
                {loading
                  ? 'Fetching your cost data…'
                  : error
                    ? 'Could not load Azure costs'
                    : report?.status === 'empty'
                      ? 'No reported charges yet'
                      : 'Your costs will tell the story.'}
              </h3>
              <p>
                {loading
                  ? 'Reading Azure Cost Management.'
                  : error
                    ? 'Use refresh to try again. No estimated values are substituted.'
                    : report?.status === 'empty'
                      ? 'Azure has no billing rows for these resources and dates. That does not mean no usage occurred.'
                      : 'Connect Azure Cost Management to see actual spend for your Container Apps and Foundry resource.'}
              </p>
              <span className="empty-caption">Real billing data only. No sample numbers.</span>
            </div>
          )}
        </section>
        <section className="panel breakdown-panel">
          <div className="eyebrow">WHERE IT GOES</div>
          <h3>Cost breakdown</h3>
          <p className="muted small">Charges by configured resource groupings.</p>
          <div className="cost-bars">
            {categories.map((category) => (
              <div className="cost-bar" key={category.key}>
                <div>
                  <span>
                    <i style={{ background: category.color }} />
                    {category.label}
                  </span>
                  <strong>
                    {money(
                      ready ? report.totals[category.key] : undefined,
                      report?.currency ?? null,
                    )}
                  </strong>
                </div>
                <div className="bar-track">
                  <span
                    style={{
                      width: ready
                        ? `${(Math.abs(report.totals[category.key] ?? 0) / max) * 100}%`
                        : '0%',
                      background: category.color,
                    }}
                  />
                </div>
                {ready && report.totals[category.key] === undefined && (
                  <small>Resource not connected</small>
                )}
              </div>
            ))}
          </div>
          <p className="small-note">
            Shared services include configured registry and environment resources. Credits can
            appear as negative costs.
          </p>
        </section>
      </div>
      <div className="billing-note">
        <Icon name="info" size={18} />
        <p>
          <strong>Billing and performance answer different questions.</strong> Azure costs can
          arrive hours later and may include other usage of a shared resource. Foundry charges are
          not split by backend or model here. Token counts below describe this browser session, not
          your Azure invoice.
        </p>
      </div>
      <section className="panel session-panel">
        <div className="panel-heading">
          <div>
            <h3>
              Session comparison <span className="tag">{session.attempts} requests</span>
            </h3>
            <p>Measured end to end in this tab. Includes network time and backend startup.</p>
          </div>
          <button
            className="button secondary"
            disabled={!samples.length}
            onClick={() => exportMeasurements(samples)}
          >
            <Icon name="download" size={16} />
            Export session
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Session measurements by infrastructure and model</caption>
            <thead>
              <tr>
                <th>Infrastructure</th>
                <th>Model</th>
                <th>Completed / attempted</th>
                <th>Average</th>
                <th>p95</th>
                <th>Tokens in / out</th>
              </tr>
            </thead>
            <tbody>
              {(['autoscale', 'always-on'] as const).flatMap((backend) =>
                (['gpt-4.1-nano', 'gpt-6-luna'] as const).map((model) => {
                  const stats = summarize(
                    samples.filter(
                      (sample) => sample.backend === backend && sample.model === model,
                    ),
                  );
                  return (
                    <tr key={`${backend}-${model}`}>
                      <td>
                        <span className={`table-backend ${backend}`}>
                          <Icon name={backend === 'autoscale' ? 'bolt' : 'server'} size={14} />
                          {backendLabels[backend]}
                        </span>
                      </td>
                      <td>{modelLabels[model]}</td>
                      <td>
                        {stats.completed} <span className="muted">/ {stats.attempts}</span>
                      </td>
                      <td>{formatDuration(stats.averageMs)}</td>
                      <td>{formatDuration(stats.p95Ms)}</td>
                      <td>
                        {formatNumber(stats.inputTokens)} <span className="muted">/</span>{' '}
                        {formatNumber(stats.outputTokens)}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footnote">
          {samples.length
            ? 'Only completed requests contribute to latency and token totals. Small samples are not representative benchmarks.'
            : 'Send a few messages in the playground to start comparing.'}{' '}
          No background requests are sent to keep the autoscale backend awake.
        </div>
      </section>
      {ready && (
        <details className="panel daily-data">
          <summary>
            View daily billing data{' '}
            <span className="muted">Accessible table · {report.daily.length} days</span>
          </summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  {categories.map((category) => (
                    <th key={category.key}>{category.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.daily.map((point) => (
                  <tr key={point.date}>
                    <td>{point.date}</td>
                    {categories.map((category) => (
                      <td key={category.key}>
                        {money(
                          report.configured_categories.includes(category.key)
                            ? point[category.dataKey]
                            : undefined,
                          report.currency,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="data-footer">
        Source: Azure Cost Management · Foundry usage is billed through Azure.
        {report?.fetched_at &&
          ` Last fetched ${new Date(report.fetched_at).toLocaleString()}.`}{' '}
        Billing responses are cached for 15 minutes.
      </p>
    </>
  );
}
