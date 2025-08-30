/**
 * Image Preloader Utility
 * Handles efficient preloading of images for better user experience
 */

interface PreloadOptions {
  priority?: 'high' | 'low';
  timeout?: number;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

class ImagePreloader {
  private static instance: ImagePreloader;
  private preloadedImages: Set<string> = new Set();
  private preloadingImages: Map<string, Promise<void>> = new Map();

  static getInstance(): ImagePreloader {
    if (!ImagePreloader.instance) {
      ImagePreloader.instance = new ImagePreloader();
    }
    return ImagePreloader.instance;
  }

  /**
   * Preload a single image
   */
  async preloadImage(src: string, options: PreloadOptions = {}): Promise<void> {
    const { priority = 'low', timeout = 10000, onLoad, onError } = options;

    // Return immediately if already preloaded
    if (this.preloadedImages.has(src)) {
      onLoad?.();
      return Promise.resolve();
    }

    // Return existing promise if already preloading
    if (this.preloadingImages.has(src)) {
      return this.preloadingImages.get(src)!;
    }

    const preloadPromise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      // Set loading attributes based on priority
      if (priority === 'high') {
        img.loading = 'eager';
        img.decoding = 'sync';
      } else {
        img.loading = 'lazy';
        img.decoding = 'async';
      }

      const timeoutId = setTimeout(() => {
        const error = `Image preload timeout: ${src}`;
        onError?.(error);
        reject(new Error(error));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        this.preloadedImages.add(src);
        this.preloadingImages.delete(src);
        onLoad?.();
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        this.preloadingImages.delete(src);
        const error = `Failed to preload image: ${src}`;
        onError?.(error);
        reject(new Error(error));
      };

      img.src = src;
    });

    this.preloadingImages.set(src, preloadPromise);
    return preloadPromise;
  }

  /**
   * Preload multiple images with optional batching
   */
  async preloadImages(
    sources: string[], 
    options: PreloadOptions & { batchSize?: number } = {}
  ): Promise<void> {
    const { batchSize = 3, ...preloadOptions } = options;
    const batches: string[][] = [];
    
    // Create batches
    for (let i = 0; i < sources.length; i += batchSize) {
      batches.push(sources.slice(i, i + batchSize));
    }

    // Process batches sequentially to avoid overwhelming the browser
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(src => this.preloadImage(src, preloadOptions))
      );
    }
  }

  /**
   * Preload critical images that should be loaded immediately
   */
  async preloadCriticalImages(): Promise<void> {
    const criticalImages = [
      '/PPplaceholder.png', // Profile placeholder
      '/friends.png', // Friends navigation icon
      '/vite.svg', // App icon
    ];

    console.log('Starting critical image preload...');
    
    try {
      await this.preloadImages(criticalImages, {
        priority: 'high',
        timeout: 5000,
        batchSize: 2,
        onLoad: () => console.log('Critical image preloaded'),
        onError: (error) => console.warn('Critical image preload failed:', error)
      });
      console.log('Critical image preload completed');
    } catch (error) {
      console.warn('Some critical images failed to preload:', error);
    }
  }

  /**
   * Check if an image is already preloaded
   */
  isPreloaded(src: string): boolean {
    return this.preloadedImages.has(src);
  }

  /**
   * Clear preload cache
   */
  clearCache(): void {
    this.preloadedImages.clear();
    this.preloadingImages.clear();
  }

  /**
   * Get preload statistics
   */
  getStats() {
    return {
      preloaded: this.preloadedImages.size,
      preloading: this.preloadingImages.size,
      preloadedImages: Array.from(this.preloadedImages)
    };
  }
}

export default ImagePreloader;