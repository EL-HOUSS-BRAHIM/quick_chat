/**
 * Tests for core utility functions
 */
import { formatDate, escapeHtml, debounce, generateRandomId } from '../utils';

describe('Utility Functions', () => {
  describe('formatDate', () => {
    test('returns "Invalid date" for invalid date input', () => {
      expect(formatDate('not-a-date')).toBe('Invalid date');
    });

    test('formats date with relative time for recent dates', () => {
      const now = new Date();
      const oneMinAgo = new Date(now.getTime() - 60000);
      
      expect(formatDate(oneMinAgo)).toMatch(/minute ago/);
    });

    test('formats date with regular format for older dates', () => {
      const oldDate = new Date('2023-01-01T12:00:00');
      const result = formatDate(oldDate, { relative: false });
      
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    test('includes time when specified', () => {
      const date = new Date('2023-01-01T12:30:00');
      const result = formatDate(date, { relative: false, includeTime: true });
      
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    test('excludes time when specified', () => {
      const date = new Date('2023-01-01T12:30:00');
      const result = formatDate(date, { relative: false, includeTime: false });
      
      expect(result).not.toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('escapeHtml', () => {
    test('escapes HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      
      expect(escapeHtml(input)).toBe(expected);
    });

    test('returns empty string for null or undefined input', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
    
    test('converts non-string inputs to string', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(true)).toBe('true');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('only executes function once when called multiple times within delay', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateRandomId', () => {
    test('generates string of specified length', () => {
      expect(generateRandomId(10)).toHaveLength(10);
      expect(generateRandomId(20)).toHaveLength(20);
    });

    test('generates different IDs on successive calls', () => {
      const id1 = generateRandomId();
      const id2 = generateRandomId();
      
      expect(id1).not.toBe(id2);
    });

    test('uses provided prefix when specified', () => {
      const id = generateRandomId(10, 'test-');
      
      expect(id).toMatch(/^test-/);
    });
  });
});
