/**
 * Tests for file-helpers.js utility module
 */
import {
  getFileIconClass,
  formatFileSize,
  isAllowedFileType,
  getFileExtension
} from '../file-helpers.js';

describe('file-helpers', () => {
  describe('getFileIconClass', () => {
    test('should return image icon class for image types', () => {
      expect(getFileIconClass('image/png')).toBe('file-icon-image');
      expect(getFileIconClass('image/jpeg')).toBe('file-icon-image');
      expect(getFileIconClass('image/gif')).toBe('file-icon-image');
    });

    test('should return video icon class for video types', () => {
      expect(getFileIconClass('video/mp4')).toBe('file-icon-video');
      expect(getFileIconClass('video/quicktime')).toBe('file-icon-video');
    });

    test('should return audio icon class for audio types', () => {
      expect(getFileIconClass('audio/mpeg')).toBe('file-icon-audio');
      expect(getFileIconClass('audio/wav')).toBe('file-icon-audio');
    });

    test('should return PDF icon class for PDF files', () => {
      expect(getFileIconClass('application/pdf')).toBe('file-icon-pdf');
    });

    test('should return doc icon class for word documents', () => {
      expect(getFileIconClass('application/msword')).toBe('file-icon-doc');
      expect(getFileIconClass('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('file-icon-doc');
    });

    test('should return xls icon class for excel documents', () => {
      expect(getFileIconClass('application/vnd.ms-excel')).toBe('file-icon-xls');
      expect(getFileIconClass('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('file-icon-xls');
    });

    test('should return ppt icon class for powerpoint documents', () => {
      expect(getFileIconClass('application/vnd.ms-powerpoint')).toBe('file-icon-ppt');
      expect(getFileIconClass('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('file-icon-ppt');
    });

    test('should return archive icon class for compressed files', () => {
      expect(getFileIconClass('application/zip')).toBe('file-icon-archive');
      expect(getFileIconClass('application/x-rar-compressed')).toBe('file-icon-archive');
      expect(getFileIconClass('application/x-tar')).toBe('file-icon-archive');
    });

    test('should return text icon class for text files', () => {
      expect(getFileIconClass('text/plain')).toBe('file-icon-text');
      expect(getFileIconClass('text/html')).toBe('file-icon-text');
      expect(getFileIconClass('application/javascript')).toBe('file-icon-text');
    });

    test('should return generic icon class for unknown types', () => {
      expect(getFileIconClass('application/octet-stream')).toBe('file-icon-generic');
    });

    test('should return generic icon class for null or undefined', () => {
      expect(getFileIconClass(null)).toBe('file-icon-generic');
      expect(getFileIconClass(undefined)).toBe('file-icon-generic');
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(100)).toBe('100 Bytes');
    });

    test('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    test('should format megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2097152)).toBe('2 MB');
    });

    test('should format gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    test('should respect decimals parameter', () => {
      expect(formatFileSize(1500, 0)).toBe('1 KB');
      expect(formatFileSize(1500, 1)).toBe('1.5 KB');
      expect(formatFileSize(1500, 2)).toBe('1.46 KB');
    });
  });

  describe('isAllowedFileType', () => {
    test('should return true for allowed MIME types', () => {
      const file = { type: 'image/jpeg', name: 'photo.jpg' };
      const allowedTypes = ['image/jpeg', 'image/png'];
      expect(isAllowedFileType(file, allowedTypes)).toBe(true);
    });

    test('should return false for disallowed MIME types', () => {
      const file = { type: 'application/exe', name: 'program.exe' };
      const allowedTypes = ['image/jpeg', 'image/png'];
      expect(isAllowedFileType(file, allowedTypes)).toBe(false);
    });

    test('should check extensions when MIME type not in allowed list', () => {
      const file = { type: 'application/octet-stream', name: 'document.docx' };
      const allowedTypes = ['.docx', '.pdf'];
      expect(isAllowedFileType(file, allowedTypes)).toBe(true);
    });

    test('should be case insensitive for MIME types', () => {
      const file = { type: 'IMAGE/JPEG', name: 'photo.jpg' };
      const allowedTypes = ['image/jpeg'];
      expect(isAllowedFileType(file, allowedTypes)).toBe(true);
    });

    test('should be case insensitive for extensions', () => {
      const file = { type: 'application/octet-stream', name: 'DOCUMENT.DOCX' };
      const allowedTypes = ['.docx'];
      expect(isAllowedFileType(file, allowedTypes)).toBe(true);
    });

    test('should handle null or empty parameters', () => {
      expect(isAllowedFileType(null, ['image/jpeg'])).toBe(false);
      expect(isAllowedFileType({ type: 'image/jpeg', name: 'photo.jpg' }, null)).toBe(false);
      expect(isAllowedFileType({ type: 'image/jpeg', name: 'photo.jpg' }, [])).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    test('should return correct extension with dot', () => {
      expect(getFileExtension('document.pdf')).toBe('.pdf');
      expect(getFileExtension('image.jpg')).toBe('.jpg');
      expect(getFileExtension('archive.tar.gz')).toBe('.gz');
    });

    test('should return lowercase extension', () => {
      expect(getFileExtension('document.PDF')).toBe('.pdf');
      expect(getFileExtension('image.JPG')).toBe('.jpg');
    });

    test('should return empty string for files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    test('should handle null or undefined input', () => {
      expect(getFileExtension(null)).toBe('');
      expect(getFileExtension(undefined)).toBe('');
    });

    test('should handle non-string input', () => {
      expect(getFileExtension(42)).toBe('');
      expect(getFileExtension({})).toBe('');
    });
  });
});
