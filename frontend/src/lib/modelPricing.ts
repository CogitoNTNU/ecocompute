import type { AppConfig } from './contracts';

type Model = AppConfig['models'][number];

export function estimatedModelCost(model: Model, inputTokens: number, outputTokens: number) {
  if (model.input_usd_per_million === null || model.output_usd_per_million === null) return null;
  return (
    (inputTokens * model.input_usd_per_million + outputTokens * model.output_usd_per_million) /
    1_000_000
  );
}

export function formatEstimatedUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}
