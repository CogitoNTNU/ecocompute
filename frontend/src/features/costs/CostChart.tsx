import type { CostReport } from '../../lib/contracts';
import { money } from '../../lib/measurements';

export const categories = [
  { key: 'autoscale', dataKey: 'autoscale', label: 'Autoscale', color: '#3b8068' },
  { key: 'always-on', dataKey: 'always_on', label: 'Always-on', color: '#7698c3' },
  { key: 'foundry', dataKey: 'foundry', label: 'Foundry', color: '#a38cbe' },
  { key: 'shared', dataKey: 'shared', label: 'Shared services', color: '#c4a470' },
] as const;

export function CostChart({ report }: { report: CostReport }) {
  const width = 720,
    height = 235,
    left = 62,
    right = 18,
    top = 16,
    bottom = 35;
  const available = categories.filter((category) =>
    report.configured_categories.includes(category.key),
  );
  const values = report.daily.flatMap((point) =>
    available.map((category) => point[category.dataKey]),
  );
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0.01, ...values);
  const x = (index: number) =>
    left + (index / Math.max(1, report.daily.length - 1)) * (width - left - right);
  const y = (value: number) =>
    top + ((maximum - value) / (maximum - minimum)) * (height - top - bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => minimum + (maximum - minimum) * fraction);
  const dates = [
    ...new Set([0, Math.floor((report.daily.length - 1) / 2), report.daily.length - 1]),
  ];
  return (
    <div className="cost-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">Daily Azure-reported costs</title>
        <desc id="chart-desc">
          Daily costs by infrastructure and Foundry. Exact amounts are available in the daily data
          table below. Missing daily rows are displayed as zero reported cost.
        </desc>
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={left}
              y1={y(value)}
              x2={width - right}
              y2={y(value)}
              stroke="#e9ece7"
              strokeDasharray="3 4"
            />
            <text x={left - 10} y={y(value) + 4} textAnchor="end" fill="#7e8982" fontSize="10">
              {money(value, report.currency)}
            </text>
          </g>
        ))}
        {available.map((category) => (
          <polyline
            key={category.key}
            points={report.daily
              .map((point, index) => `${x(index)},${y(point[category.dataKey])}`)
              .join(' ')}
            fill="none"
            stroke={category.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        ))}
        {dates.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
            fill="#7e8982"
            fontSize="11"
          >
            {new Date(`${report.daily[index]?.date}T00:00:00Z`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        {available.map((category) => (
          <span key={category.key}>
            <i style={{ background: category.color }} />
            {category.label}
          </span>
        ))}
      </div>
    </div>
  );
}
