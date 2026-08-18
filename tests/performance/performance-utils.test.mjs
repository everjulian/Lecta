import { describe, expect, it } from 'vitest';
import { percentile, summarize, syntheticSentence } from '../../scripts/performance-utils.mjs';

describe('performance baseline utilities', () => {
  it('calculates deterministic nearest-rank percentiles', () => {
    const values = [10, 1, 5, 2, 8, 3, 9, 4, 7, 6];
    expect(percentile(values, 50)).toBe(5);
    expect(percentile(values, 95)).toBe(10);
    expect(summarize(values)).toMatchObject({ samples: 10, p50: 5, p95: 10 });
  });

  it('generates deterministic synthetic content without user data', () => {
    expect(syntheticSentence(17)).toBe(syntheticSentence(17));
    expect(syntheticSentence(17)).toContain('Fixture sintético 17');
  });
});
