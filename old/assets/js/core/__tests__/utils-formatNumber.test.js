import { formatNumber } from '../../core/utils.js';

describe('formatNumber', () => {
  it('formats integers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formats floats with default decimals', () => {
    expect(formatNumber(1234.567)).toBe('1,234.567');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(1234.567, { decimals: 1 })).toBe('1,234.6');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-9876543.21)).toBe('-9,876,543.21');
  });
});
