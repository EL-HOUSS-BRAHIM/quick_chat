/**
 * Tests for string-helpers.js utility module
 */
import { 
  truncate, 
  slugify,
  highlightSearchTerm,
  formatNumber,
  textToHtml,
  generateRandomString,
  pluralize,
  formatCount
} from '../string-helpers.js';

describe('string-helpers', () => {
  describe('truncate', () => {
    test('should not truncate when string length is less than maxLength', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    test('should truncate correctly when preserveWords is false', () => {
      expect(truncate('hello world', 7, false)).toBe('hell...');
    });

    test('should truncate at word boundary when preserveWords is true', () => {
      expect(truncate('hello world', 7)).toBe('hello...');
    });

    test('should handle empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });

    test('should handle null input', () => {
      expect(truncate(null, 10)).toBe(null);
    });
  });

  describe('slugify', () => {
    test('should convert string to URL-friendly format', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    test('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    test('should handle consecutive spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    test('should handle consecutive hyphens', () => {
      expect(slugify('Hello---World')).toBe('hello-world');
    });

    test('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });

    test('should handle null input', () => {
      expect(slugify(null)).toBe('');
    });
  });

  describe('highlightSearchTerm', () => {
    test('should wrap search terms with highlight spans', () => {
      expect(highlightSearchTerm('hello world', 'world')).toBe('hello <span class="highlight">world</span>');
    });

    test('should handle case-insensitive search', () => {
      expect(highlightSearchTerm('Hello World', 'world')).toBe('Hello <span class="highlight">World</span>');
    });

    test('should escape HTML in text', () => {
      expect(highlightSearchTerm('<div>hello</div>', 'hello')).toBe('&lt;div&gt;<span class="highlight">hello</span>&lt;/div&gt;');
    });

    test('should use custom highlight class if provided', () => {
      expect(highlightSearchTerm('hello world', 'world', 'custom-highlight')).toBe('hello <span class="custom-highlight">world</span>');
    });

    test('should handle empty search term', () => {
      expect(highlightSearchTerm('hello world', '')).toBe('hello world');
    });

    test('should handle empty text', () => {
      expect(highlightSearchTerm('', 'world')).toBe('');
    });
  });

  describe('formatNumber', () => {
    test('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
    });

    test('should handle large numbers', () => {
      expect(formatNumber(1234567890)).toBe('1,234,567,890');
    });

    test('should handle non-numbers', () => {
      expect(formatNumber('abc')).toBe('0');
    });
  });

  describe('textToHtml', () => {
    test('should convert line breaks to <br> tags', () => {
      expect(textToHtml('hello\nworld')).toBe('hello<br>world');
    });

    test('should convert URLs to links', () => {
      expect(textToHtml('visit https://example.com today')).toBe(
        'visit <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a> today'
      );
    });

    test('should escape HTML', () => {
      expect(textToHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });

    test('should handle empty input', () => {
      expect(textToHtml('')).toBe('');
    });

    test('should handle null input', () => {
      expect(textToHtml(null)).toBe('');
    });
  });

  describe('generateRandomString', () => {
    test('should generate string of specified length', () => {
      expect(generateRandomString(10).length).toBe(10);
    });

    test('should generate string of default length if not specified', () => {
      expect(generateRandomString().length).toBe(10);
    });

    test('should include special characters when specified', () => {
      const randomString = generateRandomString(100, true);
      expect(/[!@#$%^&*()[\]{}|;:,.<>?_+=-]/.test(randomString)).toBe(true);
    });
  });

  describe('pluralize', () => {
    test('should return singular form when count is 1', () => {
      expect(pluralize('item', 'items', 1)).toBe('item');
    });

    test('should return plural form when count is not 1', () => {
      expect(pluralize('item', 'items', 0)).toBe('items');
      expect(pluralize('item', 'items', 2)).toBe('items');
    });
  });

  describe('formatCount', () => {
    test('should format count with singular form when count is 1', () => {
      expect(formatCount(1, 'item')).toBe('1 item');
    });

    test('should format count with plural form when count is not 1', () => {
      expect(formatCount(0, 'item')).toBe('0 items');
      expect(formatCount(2, 'item')).toBe('2 items');
    });

    test('should use custom plural form if provided', () => {
      expect(formatCount(2, 'person', 'people')).toBe('2 people');
    });
  });
});
