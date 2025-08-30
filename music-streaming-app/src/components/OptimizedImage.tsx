import React, { useState, useRef, useEffect } from 'react';
import ImageService from '../lib/imageService';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
  placeholder?: React.ReactNode;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  onLoad,
  onError,
  priority = false,
  placeholder
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Preload image for better UX
  useEffect(() => {
    if (!src) return;

    const imageService = ImageService.getInstance();
    
    // Only optimize external URLs (like Supabase), not local files
    const shouldOptimize = src.includes('supabase.co') || src.startsWith('http');
    const optimizedSrc = shouldOptimize ? imageService.optimizeImageUrl(src, {
      quality: priority ? 90 : 85,
      format: 'webp'
    }) : src;

    // For priority images, set the source immediately without preloading
    if (priority) {
      setImageSrc(optimizedSrc);
      setImageLoaded(true);
      return;
    }

    // For non-priority images, use preloading
    const img = new Image();
    
    img.onload = () => {
      setImageSrc(optimizedSrc);
      setImageLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      // Fallback to original URL if optimized fails
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        setImageSrc(src);
        setImageLoaded(true);
        onLoad?.();
      };
      fallbackImg.onerror = () => {
        setImageError(true);
        setImageLoaded(true);
        onError?.();
      };
      fallbackImg.src = src;
    };

    img.src = optimizedSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, priority, onLoad, onError]);

  // Default placeholder with music note icon
  const defaultPlaceholder = (
    <div className={`bg-spotify-gray animate-pulse flex items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 24 24" 
        className="w-6 h-6 text-spotify-light-gray opacity-30"
        fill="currentColor"
      >
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  );

  // Error fallback with music note icon
  const errorFallback = (
    <div className={`bg-spotify-gray flex items-center justify-center ${fallbackClassName || className}`}>
      <svg 
        viewBox="0 0 24 24" 
        className="w-6 h-6 text-spotify-light-gray opacity-50"
        fill="currentColor"
      >
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  );

  if (imageError) {
    return errorFallback;
  }

  if (!imageLoaded || !imageSrc) {
    return placeholder || defaultPlaceholder;
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      onLoad={() => {
        setImageLoaded(true);
        onLoad?.();
      }}
      onError={() => {
        setImageError(true);
        onError?.();
      }}
    />
  );
};

export default OptimizedImage;