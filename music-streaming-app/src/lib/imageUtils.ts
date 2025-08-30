// Image utility functions for compression and optimization

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.8,
  format: 'jpeg'
};

/**
 * Compress and resize an image file with mobile optimization
 * @param file - The image file to process
 * @param options - Processing options
 * @returns Promise that resolves to compressed image as base64 string
 */
export const compressImage = async (
  file: File, 
  options: ImageProcessingOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Add timeout for mobile devices
    const timeout = setTimeout(() => {
      reject(new Error('Image processing timed out'));
    }, 15000); // 15 second timeout
    
    img.onload = () => {
      try {
        clearTimeout(timeout);
        
        // Calculate new dimensions while maintaining aspect ratio
        const { width: newWidth, height: newHeight } = calculateNewDimensions(
          img.width, 
          img.height, 
          opts.maxWidth, 
          opts.maxHeight
        );
        
        // Set canvas dimensions
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        if (!ctx) {
          throw new Error('Canvas context not available');
        }
        
        // Enable image smoothing for better quality on mobile
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Convert to base64 with compression
        const mimeType = `image/${opts.format}`;
        const base64 = canvas.toDataURL(mimeType, opts.quality);
        
        // Check final size
        const finalSize = (base64.length * 3) / 4; // Approximate size in bytes
        console.log(`🖼️ Image compressed: ${Math.round(file.size / 1024)}KB → ${Math.round(finalSize / 1024)}KB`);
        
        // Additional check for mobile - if still too large, compress more
        if (finalSize > 800 * 1024) { // 800KB limit
          console.log('⚠️ Image still large after compression, applying additional compression...');
          const extraCompressedBase64 = canvas.toDataURL(mimeType, Math.max(opts.quality - 0.2, 0.3));
          const extraCompressedSize = (extraCompressedBase64.length * 3) / 4;
          console.log(`🔄 Extra compressed: ${Math.round(extraCompressedSize / 1024)}KB`);
          resolve(extraCompressedBase64);
        } else {
          resolve(base64);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image'));
    };
    
    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateNewDimensions(
  originalWidth: number, 
  originalHeight: number, 
  maxWidth: number, 
  maxHeight: number
): { width: number; height: number } {
  let { width, height } = { width: originalWidth, height: originalHeight };
  
  // Scale down if necessary
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Validate image file before processing with mobile considerations
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select a valid image file' };
  }
  
  // Check file size (max 15MB for input, more lenient for mobile uploads)
  const maxInputSize = 15 * 1024 * 1024; // 15MB
  if (file.size > maxInputSize) {
    return { valid: false, error: 'Image file is too large. Please select an image smaller than 15MB' };
  }
  
  // Check supported formats
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: 'Unsupported image format. Please use JPEG, PNG, or WebP' };
  }
  
  // Additional check for very small files (might be corrupted)
  if (file.size < 1024) { // Less than 1KB
    return { valid: false, error: 'Image file appears to be corrupted or too small' };
  }
  
  return { valid: true };
};

/**
 * Get optimal compression settings based on image size and device type
 */
export const getOptimalCompressionSettings = (fileSize: number, isMobile: boolean = false): ImageProcessingOptions => {
  // Mobile devices need more aggressive compression due to:
  // - Slower networks
  // - Lower processing power
  // - Firestore size limits being more critical
  if (isMobile) {
    if (fileSize > 3 * 1024 * 1024) { // > 3MB on mobile
      return {
        maxWidth: 250,
        maxHeight: 250,
        quality: 0.5,
        format: 'jpeg'
      };
    } else if (fileSize > 1 * 1024 * 1024) { // > 1MB on mobile
      return {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.6,
        format: 'jpeg'
      };
    } else {
      return {
        maxWidth: 350,
        maxHeight: 350,
        quality: 0.7,
        format: 'jpeg'
      };
    }
  }
  
  // Desktop compression settings (original logic)
  if (fileSize > 5 * 1024 * 1024) { // > 5MB
    return {
      maxWidth: 300,
      maxHeight: 300,
      quality: 0.6,
      format: 'jpeg'
    };
  } else if (fileSize > 2 * 1024 * 1024) { // > 2MB
    return {
      maxWidth: 350,
      maxHeight: 350,
      quality: 0.7,
      format: 'jpeg'
    };
  } else {
    return {
      maxWidth: 400,
      maxHeight: 400,
      quality: 0.8,
      format: 'jpeg'
    };
  }
};

/**
 * Estimate final base64 size
 */
export const estimateBase64Size = (base64: string): number => {
  return (base64.length * 3) / 4; // Approximate size in bytes
};