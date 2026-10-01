import { describe, expect, it } from 'vitest';
import { estimatedModelCost } from './modelPricing';
import type { AppConfig } from './contracts';

const model: AppConfig['models'][number] = {
  id: 'arbitrary-model',
  label: 'Arbitrary model',
  enabled: true,
  input_usd_per_million: 0.5,
  output_usd_per_million: 2,
};

describe('configured model estimate', () => {
  it('uses separate input and output rates', () => {
    expect(estimatedModelCost(model, 1000, 1000)).toBe(0.0025);
  });
  it('does not invent a price when rates are missing', () => {
    expect(estimatedModelCost({ ...model, input_usd_per_million: null }, 1000, 1000)).toBeNull();
  });
});
