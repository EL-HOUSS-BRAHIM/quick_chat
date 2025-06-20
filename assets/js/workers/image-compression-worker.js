/**
 * Image Compression Web Worker
 * Handles image compression in background thread to avoid blocking UI
 */

// Import required libraries if available
let imageCompression;
try {
  importScripts('/node_modules/browser-image-compression/dist/browser-image-compression.js');
  imageCompression = window.imageCompression;
} catch (error) {
  console.warn('Image compression library not available, using canvas fallback');
}

/**
 * Compress image using available method
 */
async function compressImage(file, options = {}) {
  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: false, // Already in worker
    quality: 0.8
  };

  const finalOptions = { ...defaultOptions, ...options };

  try {
    if (imageCompression) {
      // Use library if available
      return await imageCompression(file, finalOptions);
    } else {
      // Fallback to canvas compression
      return await canvasCompress(file, finalOptions);
    }
  } catch (error) {
    throw new Error(`Image compression failed: ${error.message}`);
  }
}

/**
 * Canvas-based image compression fallback
 */
async function canvasCompress(file, options) {
  return new Promise((resolve, reject) => {
    const canvas = new OffscreenCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    
    img.onload = () => {
      const { width, height } = calculateDimensions(
        img.width, 
        img.height, 
        options.maxWidthOrHeight
      );
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.convertToBlob({
        type: file.type,
        quality: options.quality
      }).then(blob => {
        const compressedFile = new File([blob], file.name, {
          type: file.type,
          lastModified: Date.now()
        });
        resolve(compressedFile);
      }).catch(reject);
    };
    
    img.onerror = () => reject(new Error('Image loading failed'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate optimal dimensions
 */
function calculateDimensions(originalWidth, originalHeight, maxSize) {
  let width = originalWidth;
  let height = originalHeight;
  
  if (width > height) {
    if (width > maxSize) {
      height = (height * maxSize) / width;
      width = maxSize;
    }
  } else {
    if (height > maxSize) {
      width = (width * maxSize) / height;
      height = maxSize;
    }
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

/**
 * Handle messages from main thread
 */
self.onmessage = async function(event) {
  const { id, file, options } = event.data;
  
  try {
    const compressedFile = await compressImage(file, options);
    
    // Send success response
    self.postMessage({
      id,
      compressedBlob: compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionRatio: Math.round((1 - compressedFile.size / file.size) * 100)
    });
  } catch (error) {
    // Send error response
    self.postMessage({
      id,
      error: error.message
    });
  }
};
