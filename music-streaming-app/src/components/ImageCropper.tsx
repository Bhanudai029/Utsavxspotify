import { useState, useRef, useEffect } from 'react';
import { X, RotateCw, Move, ZoomIn, ZoomOut, Check, RefreshCw, Maximize2, Square } from 'lucide-react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  imageFile: File;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
  aspectRatio?: number; // Default 1 for square
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageFile,
  onCrop,
  onCancel,
  aspectRatio = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [imageUrl, setImageUrl] = useState<string>('');
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [fitMode, setFitMode] = useState<'auto' | 'manual'>('auto');
  const [minScale, setMinScale] = useState(0.1);
  const [maxScale, setMaxScale] = useState(3.0);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    
    return () => {
      window.removeEventListener('resize', updateContainerSize);
    };
  }, []);

  // Auto-fit when container size changes and we're in auto mode
  useEffect(() => {
    if (fitMode === 'auto' && imageNaturalSize.width && containerSize.width) {
      handleAutoFit();
    }
  }, [containerSize, fitMode, imageNaturalSize]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageNaturalSize({ width: naturalWidth, height: naturalHeight });
      
      // Calculate scale limits based on image size
      const minDimension = Math.min(naturalWidth, naturalHeight);
      const maxDimension = Math.max(naturalWidth, naturalHeight);
      setMinScale(Math.max(0.1, 200 / maxDimension)); // Minimum scale to keep image visible
      setMaxScale(Math.min(5.0, 2000 / minDimension)); // Maximum scale to prevent too much zoom
      
      // Initialize crop area to center of image
      const size = Math.min(naturalWidth, naturalHeight) * 0.8;
      setCropArea({
        x: (naturalWidth - size) / 2,
        y: (naturalHeight - size) / 2,
        width: size,
        height: size / aspectRatio
      });
      
      // Auto-fit by default
      handleAutoFit(naturalWidth, naturalHeight, size);
    }
  };

  const handleAutoFit = (imgWidth?: number, imgHeight?: number, cropSize?: number) => {
    const width = imgWidth || imageNaturalSize.width;
    const height = imgHeight || imageNaturalSize.height;
    const size = cropSize || cropArea.width;
    
    if (width && height && containerSize.width && containerSize.height) {
      // Calculate optimal scale to fit the crop area nicely in the container
      const containerAspect = containerSize.width / containerSize.height;
      const imageAspect = width / height;
      
      let optimalScale;
      if (imageAspect > containerAspect) {
        // Image is wider than container
        optimalScale = (containerSize.width * 0.8) / width;
      } else {
        // Image is taller than container
        optimalScale = (containerSize.height * 0.8) / height;
      }
      
      // Ensure the crop area is visible
      const minScaleForCrop = Math.max(
        (containerSize.width * 0.3) / size,
        (containerSize.height * 0.3) / size
      );
      
      optimalScale = Math.max(optimalScale, minScaleForCrop);
      optimalScale = Math.max(minScale, Math.min(maxScale, optimalScale));
      
      setScale(optimalScale);
      setFitMode('auto');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    
    setIsDragging(true);
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imageNaturalSize.width / rect.width;
    const scaleY = imageNaturalSize.height / rect.height;
    
    setDragStart({
      x: (e.clientX - rect.left) * scaleX - cropArea.x,
      y: (e.clientY - rect.top) * scaleY - cropArea.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imageNaturalSize.width / rect.width;
    const scaleY = imageNaturalSize.height / rect.height;
    
    const newX = Math.max(0, Math.min(
      imageNaturalSize.width - cropArea.width,
      (e.clientX - rect.left) * scaleX - dragStart.x
    ));
    
    const newY = Math.max(0, Math.min(
      imageNaturalSize.height - cropArea.height,
      (e.clientY - rect.top) * scaleY - dragStart.y
    ));
    
    setCropArea(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    handleZoom(delta);
  };

  const handleCropSizeChange = (delta: number) => {
    const newSize = Math.max(50, Math.min(
      Math.min(imageNaturalSize.width, imageNaturalSize.height),
      cropArea.width + delta
    ));
    
    const newHeight = newSize / aspectRatio;
    
    // Adjust position if crop area goes out of bounds
    const newX = Math.max(0, Math.min(imageNaturalSize.width - newSize, cropArea.x));
    const newY = Math.max(0, Math.min(imageNaturalSize.height - newHeight, cropArea.y));
    
    setCropArea({
      x: newX,
      y: newY,
      width: newSize,
      height: newHeight
    });
    
    // Switch to manual mode when user adjusts crop size
    setFitMode('manual');
  };

  const handleZoom = (delta: number) => {
    const newScale = Math.max(minScale, Math.min(maxScale, scale + delta));
    setScale(newScale);
    setFitMode('manual');
  };

  const handleZoomIn = () => handleZoom(0.1);
  const handleZoomOut = () => handleZoom(-0.1);

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
    setFitMode('manual');
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    const size = Math.min(imageNaturalSize.width, imageNaturalSize.height) * 0.8;
    setCropArea({
      x: (imageNaturalSize.width - size) / 2,
      y: (imageNaturalSize.height - size) / 2,
      width: size,
      height: size / aspectRatio
    });
    handleAutoFit();
  };

  const handleManualFit = () => {
    setFitMode('manual');
    // Keep current scale and position as-is for manual control
  };

  const handleAutoFitClick = () => {
    handleAutoFit();
  };

  const getCropOverlayStyle = () => {
    if (!imageRef.current || !imageNaturalSize.width) return {};
    
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = rect.width / imageNaturalSize.width;
    const scaleY = rect.height / imageNaturalSize.height;
    
    return {
      left: `${cropArea.x * scaleX}px`,
      top: `${cropArea.y * scaleY}px`,
      width: `${cropArea.width * scaleX}px`,
      height: `${cropArea.height * scaleY}px`,
    };
  };

  const handleCrop = async () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to final crop size (square)
    const outputSize = 400; // Output size for the cropped image
    canvas.width = outputSize;
    canvas.height = outputSize / aspectRatio;
    
    // Create a new image for processing
    const img = new Image();
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply transformations
      ctx.save();
      
      // Move to center of canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Apply rotation
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      
      // Apply scale
      ctx.scale(scale, scale);
      
      // Draw the cropped portion
      const sourceX = cropArea.x;
      const sourceY = cropArea.y;
      const sourceWidth = cropArea.width;
      const sourceHeight = cropArea.height;
      
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight,
        -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height
      );
      
      ctx.restore();
      
      // Convert canvas to blob and create file
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], imageFile.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          onCrop(croppedFile);
        }
      }, 'image/jpeg', 0.9);
    };
    
    img.src = imageUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Crop Image</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4 mb-6 flex-wrap">
          {/* Crop Size Controls */}
          <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2">
            <button
              onClick={() => handleCropSizeChange(-20)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Decrease crop area"
            >
              <Square className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300 px-2">Crop</span>
            <button
              onClick={() => handleCropSizeChange(20)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Increase crop area"
            >
              <Square className="w-5 h-5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Zoom out"
              disabled={scale <= minScale}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300 px-2">{Math.round(scale * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Zoom in"
              disabled={scale >= maxScale}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Fit Mode Controls */}
          <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2">
            <button
              onClick={handleAutoFitClick}
              className={`p-2 transition-colors ${
                fitMode === 'auto' 
                  ? 'text-green-400 bg-green-400/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Auto fit image"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300 px-1">|</span>
            <button
              onClick={handleManualFit}
              className={`p-2 transition-colors ${
                fitMode === 'manual' 
                  ? 'text-blue-400 bg-blue-400/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Manual control"
            >
              <Move className="w-4 h-4" />
            </button>
          </div>

          {/* Rotation Controls */}
          <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2">
            <button
              onClick={handleRotate}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300 px-2">{rotation}°</span>
          </div>

          {/* Reset Controls */}
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 bg-white/5 rounded-lg p-2 text-gray-400 hover:text-white transition-colors"
            title="Reset all adjustments"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Reset</span>
          </button>
        </div>

        {/* Image Preview and Processing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Original Image Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Original Image</h3>
            <div className="bg-black/20 rounded-lg p-4 flex items-center justify-center" style={{ height: '300px' }}>
              {imageUrl && (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Original preview"
                  className="max-w-full max-h-full object-contain select-none transition-transform duration-300"
                  style={getImageDisplayStyle()}
                  onLoad={handleImageLoad}
                  draggable={false}
                />
              )}
            </div>
            {originalDimensions.width > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-sm text-gray-300">Original: {originalDimensions.width}×{originalDimensions.height}px</p>
                <p className="text-xs text-gray-400">File size: {(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          {/* Resized Image Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">1:1 Resized Preview</h3>
            <div className="bg-black/20 rounded-lg p-4 flex items-center justify-center" style={{ height: '300px' }}>
              <div className="relative">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-full object-contain border-2 border-green-400/50 rounded-lg"
                  style={{ width: '200px', height: '200px' }}
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-sm text-green-300">Output: {outputSize}×{outputSize}px (1:1 ratio)</p>
              <p className="text-xs text-gray-400">Perfect square format</p>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-white mb-2">How Auto 1:1 Resizing Works:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Square className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-xs font-medium text-gray-300 mb-1">1. Auto Detection</h4>
              <p className="text-xs text-gray-400">Automatically detects image dimensions and calculates optimal scaling</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <RotateCw className="w-6 h-6 text-green-400" />
              </div>
              <h4 className="text-xs font-medium text-gray-300 mb-1">2. Smart Resizing</h4>
              <p className="text-xs text-gray-400">Maintains aspect ratio while fitting into perfect 1:1 square format</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Download className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-xs font-medium text-gray-300 mb-1">3. Ready to Use</h4>
              <p className="text-xs text-gray-400">Perfect {outputSize}×{outputSize}px square image ready for any platform</p>
            </div>
          </div>
        </div>

        {/* Hidden Processing Canvas */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyResize}
            disabled={isProcessing || !resizedImageUrl}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-all duration-300"
          >
            <Square className="w-4 h-4" />
            <span>{isProcessing ? 'Processing...' : 'Apply 1:1 Resize'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageResizer;