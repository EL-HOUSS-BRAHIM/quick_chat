/**
 * @file File handling utilities
 * @description Provides functions for working with files in the chat application
 * @module utils/file-helpers
 */

/**
 * Get the appropriate icon class for a file based on its MIME type
 * @param {string} mimeType - The MIME type of the file
 * @returns {string} CSS class for the icon
 */
export function getFileIconClass(mimeType) {
  if (!mimeType) return 'file-icon-generic';
  
  if (mimeType.startsWith('image/')) {
    return 'file-icon-image';
  } else if (mimeType.startsWith('video/')) {
    return 'file-icon-video';
  } else if (mimeType.startsWith('audio/')) {
    return 'file-icon-audio';
  } else if (mimeType === 'application/pdf') {
    return 'file-icon-pdf';
  } else if (mimeType.includes('word') || mimeType === 'application/msword') {
    return 'file-icon-doc';
  } else if (mimeType.includes('excel') || mimeType === 'application/vnd.ms-excel' || 
             mimeType.includes('spreadsheetml')) {
    return 'file-icon-xls';
  } else if (mimeType.includes('powerpoint') || mimeType === 'application/vnd.ms-powerpoint' || 
             mimeType.includes('presentationml')) {
    return 'file-icon-ppt';
  } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gzip')) {
    return 'file-icon-archive';
  } else if (mimeType.includes('text/') || mimeType.includes('javascript') || mimeType.includes('code')) {
    return 'file-icon-text';
  }
  
  return 'file-icon-generic';
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - The file size in bytes
 * @param {number} [decimals=2] - Number of decimal places to show
 * @returns {string} Formatted file size (e.g., "2.5 MB")
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Check if a file is an allowed type
 * @param {File} file - The file to check
 * @param {string[]} allowedTypes - Array of allowed MIME types or extensions
 * @returns {boolean} Whether the file is allowed
 */
export function isAllowedFileType(file, allowedTypes) {
  if (!file || !allowedTypes || !allowedTypes.length) {
    return false;
  }
  
  // Check the MIME type
  const mimeType = file.type.toLowerCase();
  if (allowedTypes.some(type => type.toLowerCase() === mimeType)) {
    return true;
  }
  
  // Check the extension
  const fileName = file.name.toLowerCase();
  const extension = '.' + fileName.split('.').pop();
  
  return allowedTypes.some(type => {
    if (type.startsWith('.')) {
      return type.toLowerCase() === extension;
    }
    return false;
  });
}

/**
 * Safely get a file extension
 * @param {string} filename - The filename to extract extension from
 * @returns {string} The file extension (lowercase, with dot)
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  const parts = filename.split('.');
  if (parts.length === 1) {
    return '';
  }
  
  return '.' + parts.pop().toLowerCase();
}

/**
 * Generate a thumbnail for an image or video file
 * @param {File} file - The file to generate thumbnail for
 * @param {Object} options - Options for thumbnail generation
 * @param {number} options.maxWidth - Maximum width of the thumbnail
 * @param {number} options.maxHeight - Maximum height of the thumbnail
 * @returns {Promise<string>} Promise resolving to the thumbnail data URL
 */
export function generateThumbnail(file, { maxWidth = 200, maxHeight = 200 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(height * maxWidth / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(width * maxHeight / height);
              height = maxHeight;
            }
          }
          
          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        // Seek to the first frame
        video.currentTime = 0.1;
      };
      
      video.onseeked = () => {
        // Calculate dimensions while maintaining aspect ratio
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * maxHeight / height);
            height = maxHeight;
          }
        }
        
        // Create canvas and draw video frame
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      
      video.onerror = () => reject(new Error('Failed to load video'));
      
      video.src = URL.createObjectURL(file);
    } else {
      reject(new Error('File type not supported for thumbnail generation'));
    }
  });
}

export default {
  getFileIconClass,
  formatFileSize,
  isAllowedFileType,
  getFileExtension,
  generateThumbnail
};
