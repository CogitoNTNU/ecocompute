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
      <div className="mb-[30px] flex items-center justify-between gap-[20px] tablet:items-start mobile:mb-[24px] mobile:flex-wrap mobile:gap-[12px] tablet:[&_h1]:text-[25px] mobile:[&_h1]:max-w-[370px] mobile:[&_h1]:text-[25px] [&_p]:mt-[10px] [&_p]:text-[12px] [&_p]:text-[#67726b] mobile:[&_p]:max-w-[330px] mobile:[&_p]:text-[11px] mobile:[&_p]:leading-[1.8]">
        <div>
          <div className="mb-[10px] text-[10px] font-[650] tracking-[1.55px] text-[#76867b]">
            THE BIGGER PICTURE
          </div>
          <h1>Understand the cost of a conversation.</h1>
          <p>Compare infrastructure spend. Keep model usage in perspective.</p>
        </div>
        <div className="flex items-center gap-[9px] tablet:pt-[20px] mobile:pt-0">
          <label className="sr-only" htmlFor="period">
            Billing period
          </label>
          <select
            className="rounded-[6px] border border-solid border-[#dce2d8] bg-white py-[9px] pr-[30px] pl-[12px] text-[11px] text-[#5c6e54]"
            id="period"
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            className="inline-flex items-center justify-center gap-[8px] rounded-[6px] border border-solid border-[#dce2d8] bg-white p-[10px] text-[11px] font-medium whitespace-nowrap text-[#465a4c] [&:hover:not(:disabled)]:border-[#c2d0bf] [&:hover:not(:disabled)]:bg-[#eff4ed]"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
            aria-label="Refresh billing"
          >
            <Icon name="refresh" size={17} />
          </button>
        </div>
      </div>
      <div className="mb-[20px] flex items-center justify-between gap-[12px] text-[10px] text-[#67725e] tablet:flex-col tablet:items-start mobile:text-[9px]">
        <span
          className={`inline-flex items-center gap-[7px] rounded-[5px] border border-solid px-[9px] py-[5px] text-[10px] ${ready ? 'border-[#dce7cd] bg-[#edf3e7] text-[#5c7746] [&>span]:bg-[#86a570]' : 'border-[#e5dfcb] bg-[#f9f6ee] text-[#7f6d3f] [&>span]:bg-[#cbb778]'}`}
        >
          <span className="inline-block h-[6px] w-[6px] shrink-0 rounded-[100%] bg-[#82a67f]" />
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
          <span className="mx-[10px] my-0">·</span>Billing data is delayed
        </span>
      </div>
      {error && (
        <div
          className="mb-[14px] rounded-[7px] border border-solid border-[#f1d5c8] bg-[#fff1ec] px-[14px] py-[12px] text-[12px] leading-[1.7] text-[#915941]"
          role="alert"
        >
          {error}
        </div>
      )}
      <div className="mb-[22px] grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-[16px] compact:gap-[10px] tablet:grid-cols-[1fr_1fr] mobile:gap-[10px]">
        <div
          data-testid="tracked-resource-spend"
          className="rounded-[9px] border border-solid border-[#d8e3cc] bg-[#eaf0e3] p-[20px] compact:p-[16px] mobile:p-[15px] [&_strong]:mx-0 [&_strong]:mt-[13px] [&_strong]:mb-[7px] [&_strong]:block [&_strong]:text-[31px] [&_strong]:font-medium [&_strong]:tracking-[-1.1px] [&_strong]:tabular-nums mobile:[&_strong]:text-[27px] [&>span]:text-[9px] [&>span]:text-[#647451] compact:[&>span]:text-[8px] mobile:[&>span]:block mobile:[&>span]:text-[8px] mobile:[&>span]:leading-[1.7]"
        >
          <div className="flex items-center gap-[7px] text-[11px] text-[#617550] mobile:text-[10px] [&>svg]:ml-auto">
            Tracked resource spend
            <Icon name="chart" size={18} />
          </div>
          <strong>{money(total, report?.currency ?? null)}</strong>
          <span>Actual pre-tax cost · selected resources</span>
        </div>
        {categories.slice(0, 3).map((category) => (
          <div
            className="rounded-[9px] border border-solid border-line bg-white p-[20px] compact:p-[16px] mobile:p-[15px] [&_strong]:mx-0 [&_strong]:mt-[13px] [&_strong]:mb-[7px] [&_strong]:block [&_strong]:text-[31px] [&_strong]:font-medium [&_strong]:tracking-[-1.1px] [&_strong]:tabular-nums mobile:[&_strong]:text-[27px] [&>span]:text-[9px] [&>span]:text-[#67735b] compact:[&>span]:text-[8px] mobile:[&>span]:block mobile:[&>span]:text-[8px] mobile:[&>span]:leading-[1.7]"
            key={category.key}
          >
            <div className="flex items-center gap-[7px] text-[11px] text-[#617550] mobile:text-[10px] [&>svg]:ml-auto">
              <span
                className="h-[6px] w-[6px] rounded-[50%]"
                style={{ background: category.color }}
              />
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
      <div className="grid grid-cols-[minmax(0,_1fr)_290px] gap-[22px] compact:grid-cols-[minmax(0,_1fr)_250px] compact:gap-[16px] tablet:grid-cols-[1fr]">
        <section className="overflow-hidden rounded-[10px] border border-solid border-line bg-white">
          <div className="flex shrink-0 items-center justify-between gap-[12px] px-[21px] py-[18px] [border:0] compact:p-[16px] mobile:px-[13px] mobile:py-[16px] [&_p]:mt-[5px] [&_p]:text-[10px] [&_p]:text-[#68735b]">
            <div>
              <h3>Daily cost over time</h3>
              <p>Infrastructure and AI, side by side.</p>
            </div>
            <span className="text-[8px] tracking-[1.25px] whitespace-nowrap text-[#687169] compact:text-[7px] mobile:text-[6px] mobile:tracking-[0.7px]">
              {report?.currency ?? 'BILLING CURRENCY'}
            </span>
          </div>
          {ready ? (
            <CostChart report={report} />
          ) : (
            <div
              className="flex min-h-[280px] flex-col items-center justify-center p-[20px] text-center [background:linear-gradient(0deg,_#fff,_#fcfdf9)] mobile:min-h-[260px] [&_h3]:text-[16px] [&_h3]:font-medium [&_p]:mx-0 [&_p]:mt-[10px] [&_p]:mb-[17px] [&_p]:max-w-[340px] [&_p]:text-[11px] [&_p]:leading-[1.9] [&_p]:text-[#67735a]"
              role="status"
            >
              <div className="mb-[18px] grid h-[57px] w-[57px] place-items-center rounded-[12px] border border-solid border-[#e5ebdb] bg-[#f3f6ed] text-[#667356]">
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
              <span className="text-[9px] text-[#69725e]">
                Real billing data only. No sample numbers.
              </span>
            </div>
          )}
        </section>
        <section className="overflow-hidden rounded-[10px] border border-solid border-line bg-white p-[23px] [&>p]:mt-[8px] [&>p]:text-[10px] [&>p]:leading-[1.8]">
          <div className="mb-[8px] text-[8px] font-[650] tracking-[1.55px] text-[#76867b]">
            WHERE IT GOES
          </div>
          <h3>Cost breakdown</h3>
          <p className="text-[12px] text-muted">Charges by configured resource groupings.</p>
          <div className="mx-0 mt-[25px] mb-[23px] grid gap-[20px] tablet:grid-cols-[1fr_1fr] mobile:grid-cols-[1fr]">
            {categories.map((category) => (
              <div
                className="[&_i]:h-[6px] [&_i]:w-[6px] [&_i]:rounded-[50%] [&_small]:text-[9px] [&_small]:text-[#6a725b] [&_strong]:text-[11px] [&_strong]:font-medium [&>div:first-child]:flex [&>div:first-child]:items-center [&>div:first-child]:justify-between [&>div:first-child]:text-[11px] [&>div>span]:flex [&>div>span]:items-center [&>div>span]:gap-[7px] [&>div>span]:text-[#647453]"
                key={category.key}
              >
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
                <div className="mt-[9px] h-[5px] overflow-hidden rounded-[3px] bg-[#f0f3eb] [&_span]:block [&_span]:h-full [&_span]:rounded-[3px]">
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
          <p className="text-[9px] leading-[1.8] text-[#697261] mobile:text-[10px]">
            Shared services include configured registry and environment resources. Credits can
            appear as negative costs.
          </p>
        </section>
      </div>
      <div className="mx-0 my-[21px] flex gap-[12px] rounded-[8px] border border-solid border-[#e1e8d6] bg-[#eef2e8] px-[20px] py-[17px] text-[#647451] [&_p]:text-[10px] [&_p]:leading-[1.85] mobile:[&_p]:text-[10px] [&_strong]:font-[550] [&_strong]:text-[#627551] [&_svg]:mt-[2px] [&_svg]:shrink-0">
        <Icon name="info" size={18} />
        <p>
          <strong>Billing and performance answer different questions.</strong> Azure costs can
          arrive hours later and may include other usage of a shared resource. Foundry charges are
          not split by backend or model here. Token counts below describe this browser session, not
          your Azure invoice.
        </p>
      </div>
      <section className="overflow-hidden rounded-[10px] border border-solid border-line bg-white">
        <div className="flex shrink-0 items-center justify-between gap-[12px] border-b [border-bottom-style:solid] border-b-[#edf0e9] px-[21px] py-[20px] compact:px-[16px] compact:py-[20px] mobile:flex-wrap mobile:items-start mobile:px-[13px] mobile:py-[20px] [&_p]:mt-[5px] [&_p]:text-[10px] [&_p]:text-[#68735b]">
          <div>
            <h3>
              {'Session comparison '}
              <span className="ml-[6px] rounded-[4px] bg-[#f0f4e9] px-[7px] py-[3px] align-middle text-[9px] font-normal text-[#64754d]">
                {session.attempts} requests
              </span>
            </h3>
            <p>Measured end to end in this tab. Includes network time and backend startup.</p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-[8px] rounded-[6px] border border-solid border-[#dce2d8] bg-white px-[13px] py-[9px] text-[11px] font-medium whitespace-nowrap text-[#465a4c] [&:hover:not(:disabled)]:border-[#c2d0bf] [&:hover:not(:disabled)]:bg-[#eff4ed]"
            disabled={!samples.length}
            onClick={() => exportMeasurements(samples)}
          >
            <Icon name="download" size={16} />
            Export session
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap [&_td]:border-b [&_td]:[border-bottom-style:solid] [&_td]:border-b-[#eff2e9] [&_td]:px-[20px] [&_td]:py-[16px] [&_td]:text-[11px] [&_td]:text-[#617553] [&_td]:tabular-nums [&_th]:border-b [&_th]:[border-bottom-style:solid] [&_th]:border-b-[#ecf0e4] [&_th]:bg-[#fafbf7] [&_th]:px-[20px] [&_th]:py-[13px] [&_th]:text-[9px] [&_th]:font-medium [&_th]:text-[#677357]">
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
                        <span
                          className={`inline-flex items-center gap-[6px] ${backend === 'always-on' ? 'text-[#55718f]' : 'text-[#557848]'}`}
                        >
                          <Icon name={backend === 'autoscale' ? 'bolt' : 'server'} size={14} />
                          {backendLabels[backend]}
                        </span>
                      </td>
                      <td>{modelLabels[model]}</td>
                      <td>
                        {stats.completed} <span className="text-muted">/ {stats.attempts}</span>
                      </td>
                      <td>{formatDuration(stats.averageMs)}</td>
                      <td>{formatDuration(stats.p95Ms)}</td>
                      <td>
                        {formatNumber(stats.inputTokens)} <span className="text-muted">/</span>{' '}
                        {formatNumber(stats.outputTokens)}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <div className="px-[20px] py-[14px] text-[9px] leading-[1.8] text-[#687357] mobile:text-[9px]">
          {samples.length
            ? 'Only completed requests contribute to latency and token totals. Small samples are not representative benchmarks.'
            : 'Send a few messages in the playground to start comparing.'}{' '}
          No background requests are sent to keep the autoscale backend awake.
        </div>
      </section>
      {ready && (
        <details className="mt-[18px] overflow-hidden rounded-[10px] border border-solid border-line bg-white [&_summary]:cursor-pointer [&_summary]:px-[20px] [&_summary]:py-[17px] [&_summary]:text-[12px] [&_summary_span]:ml-[10px] [&_summary_span]:text-[10px] mobile:[&_summary_span]:mx-0 mobile:[&_summary_span]:mt-[4px] mobile:[&_summary_span]:mb-0 mobile:[&_summary_span]:block">
          <summary>
            View daily billing data{' '}
            <span className="text-muted">Accessible table · {report.daily.length} days</span>
          </summary>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-left whitespace-nowrap [&_td]:border-b [&_td]:[border-bottom-style:solid] [&_td]:border-b-[#eff2e9] [&_td]:px-[20px] [&_td]:py-[16px] [&_td]:text-[11px] [&_td]:text-[#617553] [&_td]:tabular-nums [&_th]:border-b [&_th]:[border-bottom-style:solid] [&_th]:border-b-[#ecf0e4] [&_th]:bg-[#fafbf7] [&_th]:px-[20px] [&_th]:py-[13px] [&_th]:text-[9px] [&_th]:font-medium [&_th]:text-[#677357]">
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
      <p className="mt-[16px] text-[9px] leading-[1.8] text-[#697259] mobile:text-[9px]">
        Source: Azure Cost Management · Foundry usage is billed through Azure.
        {report?.fetched_at &&
          ` Last fetched ${new Date(report.fetched_at).toLocaleString()}.`}{' '}
        Billing responses are cached for 15 minutes.
      </p>
    </>
  );
}
