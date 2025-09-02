import { useState, useRef, useEffect } from 'react';
import { X, Square, Download, RotateCw, RefreshCw } from 'lucide-react';

interface ImageResizerProps {
  imageFile: File;
  onResize: (resizedFile: File) => void;
  onCancel: () => void;
  outputSize?: number; // Default 400 for 400x400px output
}

const ImageResizer: React.FC<ImageResizerProps> = ({
  imageFile,
  onResize,
  onCancel,
  outputSize = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [imageUrl, setImageUrl] = useState<string>('');
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [resizedImageUrl, setResizedImageUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    
    return () => {
      URL.revokeObjectURL(url);
      if (resizedImageUrl) {
        URL.revokeObjectURL(resizedImageUrl);
      }
    };
  }, [imageFile]);

  // Auto-resize when image loads
  useEffect(() => {
    if (originalDimensions.width && originalDimensions.height) {
      handleAutoResize();
    }
  }, [originalDimensions, rotation]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setOriginalDimensions({ width: naturalWidth, height: naturalHeight });
    }
  };

  const handleAutoResize = async () => {
    if (!originalDimensions.width || !originalDimensions.height || !canvasRef.current || !imageRef.current) return;
    
    setIsProcessing(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas to square output size
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    const img = new Image();
    img.onload = () => {
      // Clear canvas with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);
      
      let { width: imgWidth, height: imgHeight } = originalDimensions;
      
      // Apply rotation adjustments
      if (rotation === 90 || rotation === 270) {
        [imgWidth, imgHeight] = [imgHeight, imgWidth];
      }
      
      // Calculate scaling to fit image into square while maintaining aspect ratio
      const scale = Math.min(outputSize / imgWidth, outputSize / imgHeight);
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;
      
      // Center the image in the square
      const x = (outputSize - scaledWidth) / 2;
      const y = (outputSize - scaledHeight) / 2;
      
      // Apply transformations
      ctx.save();
      
      if (rotation !== 0) {
        // Rotate around center of canvas
        ctx.translate(outputSize / 2, outputSize / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-outputSize / 2, -outputSize / 2);
      }
      
      // Draw the image
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      ctx.restore();
      
      // Update preview
      updatePreview();
      setIsProcessing(false);
    };
    
    img.src = imageUrl;
  };

  const updatePreview = () => {
    if (!canvasRef.current || !previewCanvasRef.current) return;
    
    const previewCanvas = previewCanvasRef.current;
    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;
    
    // Set preview canvas size
    previewCanvas.width = 120;
    previewCanvas.height = 120;
    
    // Draw the resized image on preview canvas
    previewCtx.drawImage(canvasRef.current, 0, 0, 120, 120);
    
    // Update the resized image URL for download
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        if (resizedImageUrl) {
          URL.revokeObjectURL(resizedImageUrl);
        }
        const newUrl = URL.createObjectURL(blob);
        setResizedImageUrl(newUrl);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setRotation(0);
  };

  const getImageDisplayStyle = () => {
    if (!originalDimensions.width || !originalDimensions.height) return {};
    
    const containerWidth = 400;
    const containerHeight = 300;
    
    let { width: imgWidth, height: imgHeight } = originalDimensions;
    
    // Apply rotation adjustments for display
    if (rotation === 90 || rotation === 270) {
      [imgWidth, imgHeight] = [imgHeight, imgWidth];
    }
    
    const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight, 1);
    
    return {
      width: `${imgWidth * scale}px`,
      height: `${imgHeight * scale}px`,
      transform: `rotate(${rotation}deg)`,
    };
  };

  const handleApplyResize = async () => {
    if (!canvasRef.current) return;
    
    // Convert canvas to blob and create file
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const resizedFile = new File([blob], imageFile.name.replace(/\.[^/.]+$/, '_resized.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        onResize(resizedFile);
      }
    }, 'image/jpeg', 0.9);
  };

  const downloadResizedImage = () => {
    if (!resizedImageUrl) return;
    
    const link = document.createElement('a');
    link.href = resizedImageUrl;
    link.download = imageFile.name.replace(/\.[^/.]+$/, '_resized_1x1.jpg');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Auto Resize to 1:1 Ratio</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4 mb-6 flex-wrap">
          {/* Rotation Controls */}
          <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2">
            <button
              onClick={handleRotate}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Rotate 90°"
              disabled={isProcessing}
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300 px-2">{rotation}°</span>
          </div>

          {/* Output Size Display */}
          <div className="flex items-center space-x-2 bg-white/5 rounded-lg p-2">
            <Square className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Output: {outputSize}x{outputSize}px</span>
          </div>

          {/* Reset Controls */}
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 bg-white/5 rounded-lg p-2 text-gray-400 hover:text-white transition-colors"
            title="Reset rotation"
            disabled={isProcessing}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Reset</span>
          </button>

          {/* Download Button */}
          {resizedImageUrl && (
            <button
              onClick={downloadResizedImage}
              className="flex items-center space-x-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg p-2 text-blue-300 hover:text-blue-200 transition-colors"
              title="Download resized image"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Download</span>
            </button>
          )}
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