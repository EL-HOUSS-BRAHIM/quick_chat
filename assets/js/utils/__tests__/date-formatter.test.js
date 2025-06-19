/**
 * Tests for date-formatter.js utility module
 */
import {
  formatMessageDate,
  formatTime,
  formatFullDate,
  getRelativeTimeString,
  formatChatTimestamp
} from '../date-formatter.js';

describe('date-formatter', () => {
  // Mock current date for consistent testing
  const originalDate = global.Date;
  const mockDate = new Date('2025-06-19T12:00:00Z');

  beforeAll(() => {
    // Mock Date to return fixed date for 'new Date()'
    global.Date = class extends Date {
      constructor(date) {
        if (date) {
          return new originalDate(date);
        }
        return mockDate;
      }
      static now() {
        return mockDate.getTime();
      }
    };
  });

  afterAll(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  describe('formatMessageDate', () => {
    test('should format today as "Today at HH:MM AM/PM"', () => {
      const today = new Date('2025-06-19T14:30:00Z');
      expect(formatMessageDate(today)).toMatch(/Today at \d{1,2}:\d{2} [AP]M/);
    });

    test('should format today without time when includeTime is false', () => {
      const today = new Date('2025-06-19T14:30:00Z');
      expect(formatMessageDate(today, false)).toBe('Today');
    });

    test('should format yesterday as "Yesterday at HH:MM AM/PM"', () => {
      const yesterday = new Date('2025-06-18T14:30:00Z');
      expect(formatMessageDate(yesterday)).toMatch(/Yesterday at \d{1,2}:\d{2} [AP]M/);
    });

    test('should format yesterday without time when includeTime is false', () => {
      const yesterday = new Date('2025-06-18T14:30:00Z');
      expect(formatMessageDate(yesterday, false)).toBe('Yesterday');
    });

    test('should format other dates with full date format', () => {
      const pastDate = new Date('2025-06-10T14:30:00Z');
      expect(formatMessageDate(pastDate)).toMatch(/[A-Za-z]{3}, [A-Za-z]{3} \d{1,2} at \d{1,2}:\d{2} [AP]M/);
    });
  });

  describe('formatTime', () => {
    // Update tests to use local timezone for comparison
    test('should format time in 12-hour format with AM', () => {
      const morning = new Date('2025-06-19T09:30:00Z');
      const hours = morning.getHours() % 12 || 12;
      expect(formatTime(morning)).toBe(`${hours}:30 ${morning.getHours() < 12 ? 'AM' : 'PM'}`);
    });

    test('should format time in 12-hour format with PM', () => {
      const afternoon = new Date('2025-06-19T14:30:00Z');
      const hours = afternoon.getHours() % 12 || 12;
      expect(formatTime(afternoon)).toBe(`${hours}:30 ${afternoon.getHours() < 12 ? 'AM' : 'PM'}`);
    });

    test('should pad minutes with leading zero when needed', () => {
      const time = new Date('2025-06-19T14:05:00Z');
      const hours = time.getHours() % 12 || 12;
      expect(formatTime(time)).toBe(`${hours}:05 ${time.getHours() < 12 ? 'AM' : 'PM'}`);
    });

    test('should convert 0 hours to 12 AM', () => {
      const midnight = new Date('2025-06-19T00:00:00Z');
      const hours = midnight.getHours() % 12 || 12;
      expect(formatTime(midnight)).toBe(`${hours}:00 ${midnight.getHours() < 12 ? 'AM' : 'PM'}`);
    });

    test('should convert 12 hours to 12 PM', () => {
      const noon = new Date('2025-06-19T12:00:00Z');
      const hours = noon.getHours() % 12 || 12;
      expect(formatTime(noon)).toBe(`${hours}:00 ${noon.getHours() < 12 ? 'AM' : 'PM'}`);
    });
  });

  describe('formatFullDate', () => {
    test('should format date with time by default', () => {
      const date = new Date('2025-06-10T14:30:00Z');
      expect(formatFullDate(date)).toMatch(/[A-Za-z]{3}, [A-Za-z]{3} \d{1,2} at \d{1,2}:\d{2} [AP]M/);
    });

    test('should format date without time when includeTime is false', () => {
      const date = new Date('2025-06-10T14:30:00Z');
      expect(formatFullDate(date, false)).toMatch(/[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}/);
      expect(formatFullDate(date, false)).not.toMatch(/at \d{1,2}:\d{2} [AP]M/);
    });

    test('should include year when different from current year', () => {
      const pastYear = new Date('2024-06-10T14:30:00Z');
      expect(formatFullDate(pastYear)).toMatch(/2024/);
    });

    test('should not include year when same as current year', () => {
      const currentYear = new Date('2025-06-10T14:30:00Z');
      expect(formatFullDate(currentYear)).not.toMatch(/2025/);
    });
  });

  describe('getRelativeTimeString', () => {
    test('should return "just now" for very recent times', () => {
      const justNow = new Date(mockDate.getTime());
      expect(getRelativeTimeString(justNow)).toBe('just now');
    });

    test('should return seconds ago for recent times', () => {
      const secondsAgo = new Date(mockDate.getTime() - 30 * 1000);
      expect(getRelativeTimeString(secondsAgo)).toBe('30 seconds ago');
    });

    test('should return minutes ago for older times', () => {
      const minutesAgo = new Date(mockDate.getTime() - 5 * 60 * 1000);
      expect(getRelativeTimeString(minutesAgo)).toBe('5 minutes ago');
    });

    test('should use singular form for 1 minute', () => {
      const oneMinuteAgo = new Date(mockDate.getTime() - 60 * 1000);
      expect(getRelativeTimeString(oneMinuteAgo)).toBe('1 minute ago');
    });

    test('should return hours ago for older times', () => {
      const hoursAgo = new Date(mockDate.getTime() - 3 * 60 * 60 * 1000);
      expect(getRelativeTimeString(hoursAgo)).toBe('3 hours ago');
    });

    test('should use singular form for 1 hour', () => {
      const oneHourAgo = new Date(mockDate.getTime() - 60 * 60 * 1000);
      expect(getRelativeTimeString(oneHourAgo)).toBe('1 hour ago');
    });

    test('should return days ago for older times', () => {
      const daysAgo = new Date(mockDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      expect(getRelativeTimeString(daysAgo)).toBe('2 days ago');
    });

    test('should use singular form for 1 day', () => {
      const oneDayAgo = new Date(mockDate.getTime() - 24 * 60 * 60 * 1000);
      expect(getRelativeTimeString(oneDayAgo)).toBe('1 day ago');
    });

    test('should return full date for dates older than a week', () => {
      const weekAgo = new Date(mockDate.getTime() - 8 * 24 * 60 * 60 * 1000);
      expect(getRelativeTimeString(weekAgo)).toMatch(/[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}/);
    });
  });

  describe('formatChatTimestamp', () => {
    test('should show only time for messages from today', () => {
      const today = new Date('2025-06-19T14:30:00Z');
      expect(formatChatTimestamp(today)).toMatch(/\d{1,2}:\d{2} [AP]M/);
      expect(formatChatTimestamp(today)).not.toMatch(/[A-Za-z]{3}/);
    });

    test('should show day name and time for messages within the last week', () => {
      const fourDaysAgo = new Date('2025-06-15T14:30:00Z');
      expect(formatChatTimestamp(fourDaysAgo)).toMatch(/[A-Za-z]{3} \d{1,2}:\d{2} [AP]M/);
    });

    test('should show full date for older messages', () => {
      const twoWeeksAgo = new Date('2025-06-05T14:30:00Z');
      expect(formatChatTimestamp(twoWeeksAgo)).toMatch(/[A-Za-z]{3}, [A-Za-z]{3} \d{1,2} at \d{1,2}:\d{2} [AP]M/);
    });
  });
});
