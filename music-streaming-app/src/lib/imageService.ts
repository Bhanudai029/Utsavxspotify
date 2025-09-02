// Image optimization and caching service for better performance on Netlify
class ImageService {
  private static instance: ImageService;
  private imageCache = new Map<string, string>();
  private preloadCache = new Set<string>();

  private constructor() {}

  static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  /**
   * Optimize image URL for Netlify and Supabase
   */
  optimizeImageUrl(originalUrl: string, options: {
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
    width?: number;
    height?: number;
  } = {}): string {
    if (!originalUrl) {
      console.warn('ImageService: Empty URL provided for optimization');
      return originalUrl;
    }

    const {
      quality = 85,
      format = 'webp',
      width,
      height
    } = options;

    // Check cache first
    const cacheKey = `${originalUrl}-${JSON.stringify(options)}`;
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    let optimizedUrl = originalUrl;

    // Only optimize Supabase images, leave other URLs as-is
    if (originalUrl.includes('supabase.co')) {
      try {
        const url = new URL(originalUrl);
        const params = new URLSearchParams();
        
        // Add optimization parameters
        params.set('quality', quality.toString());
        params.set('format', format);
        
        if (width) params.set('width', width.toString());
        if (height) params.set('height', height.toString());
        
        // Add caching headers
        params.set('cache', '3600'); // 1 hour cache
        
        url.search = params.toString();
        optimizedUrl = url.toString();
        
        console.log('ImageService: Optimized Supabase URL:', originalUrl, '->', optimizedUrl);
      } catch (error) {
        console.error('ImageService: Error optimizing Supabase URL:', error);
        // Fall back to original URL if optimization fails
        optimizedUrl = originalUrl;
      }
    } else {
      console.log('ImageService: Non-Supabase URL, using as-is:', originalUrl);
    }

    // Cache the result
    this.imageCache.set(cacheKey, optimizedUrl);
    return optimizedUrl;
  }

  /**
   * Preload images for better UX
   */
  preloadImage(url: string, priority: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!url) {
        console.warn('ImageService: Empty URL provided for preload');
        resolve();
        return;
      }

      if (this.preloadCache.has(url)) {
        resolve();
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        console.log('ImageService: Successfully preloaded image:', url);
        this.preloadCache.add(url);
        resolve();
      };
      
      img.onerror = (error) => {
        console.error('ImageService: Failed to preload image:', url, error);
        reject(new Error(`Failed to preload image: ${url}`));
      };

      // Set loading attributes based on priority
      if (priority) {
        img.loading = 'eager';
        img.decoding = 'sync';
      } else {
        img.loading = 'lazy';
        img.decoding = 'async';
      }

      // Use optimized URL
      img.src = this.optimizeImageUrl(url, {
        quality: 85,
        format: 'webp'
      });
    });
  }

  /**
   * Preload multiple images
   */
  async preloadImages(urls: string[], priority: boolean = false): Promise<void> {
    const promises = urls.map(url => this.preloadImage(url, priority));
    await Promise.allSettled(promises);
  }

  /**
   * Clear cache (useful for memory management)
   */
  clearCache(): void {
    this.imageCache.clear();
    this.preloadCache.clear();
  }

  /**
   * Get cache size for debugging
   */
  getCacheSize(): { imageCache: number; preloadCache: number } {
    return {
      imageCache: this.imageCache.size,
      preloadCache: this.preloadCache.size
    };
  }

  /**
   * Create responsive image URLs for different screen sizes
   */
  createResponsiveImageUrls(originalUrl: string): {
    small: string;
    medium: string;
    large: string;
  } {
    return {
      small: this.optimizeImageUrl(originalUrl, { quality: 75, width: 100, height: 100 }),
      medium: this.optimizeImageUrl(originalUrl, { quality: 80, width: 200, height: 200 }),
      large: this.optimizeImageUrl(originalUrl, { quality: 85, width: 400, height: 400 })
    };
  }

  /**
   * Detect if browser supports WebP
   */
  supportsWebP(): Promise<boolean> {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => {
        resolve(webP.height === 2);
      };
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  }
}

export default ImageService;