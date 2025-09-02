import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react';
import FirebaseImageService from '../lib/firebaseImageService';

// Real Firebase upload test component
const FirebaseUploadTest: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setSuccess('');
      setUploadedUrl('');
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');
    setUploadedUrl('');
    setUploadProgress(0);

    try {
      console.log('🚀 Starting Firebase upload test using real upload...');
      console.log('📄 File details:', {
        name: selectedFile.name,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        type: selectedFile.type
      });
      
      const firebaseImageService = FirebaseImageService.getInstance();
      const testFileName = `test-${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
      
      // Upload to test-uploads folder instead of song-images
      const downloadURL = await firebaseImageService.uploadImageWithFallbacks(
        selectedFile,
        testFileName,
        { folder: 'test-uploads' },
        (progress) => {
          setUploadProgress(progress.progress);
          console.log(`📊 Upload progress: ${progress.progress.toFixed(1)}% (${progress.bytesTransferred}/${progress.totalBytes} bytes)`);
        }
      );
      
      setUploadedUrl(downloadURL);
      setSuccess(`✅ Upload completed successfully! Image accessible at: ${downloadURL}`);
      console.log('✅ Upload completed successfully:', downloadURL);
      
    } catch (error: any) {
      console.error('❌ Firebase upload failed:', error);
      setError('Firebase upload failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const resetTest = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    setError('');
    setSuccess('');
    setUploadedUrl('');
  };

  return (
    <div className="p-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        🔥 Firebase Upload Test (Real Upload)
      </h2>
      
      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-gray-300 text-sm font-medium mb-3">
          Select Image to Test Upload
        </label>
        <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="test-file-upload"
          />
          <label
            htmlFor="test-file-upload"
            className="cursor-pointer flex flex-col items-center space-y-3"
          >
            <Upload className="w-12 h-12 text-purple-400" />
            <span className="text-white font-medium">
              {selectedFile ? selectedFile.name : 'Click to select image'}
            </span>
            {selectedFile && (
              <span className="text-sm text-gray-400">
                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Upload Button */}
      <div className="mb-6 text-center">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
        >
          {isUploading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span>Test Firebase Upload</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Upload Progress</span>
            <span className="text-sm text-gray-300">{uploadProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <motion.div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full"
              style={{ width: `${uploadProgress}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg flex items-start space-x-3"
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">Upload Successful!</div>
            <div className="text-sm mt-1">{success}</div>
            
            {/* URL Display and Actions */}
            {uploadedUrl && (
              <div className="mt-3 space-y-2">
                <div className="bg-black/20 p-3 rounded border">
                  <div className="text-xs text-gray-400 mb-1">Download URL:</div>
                  <div className="text-xs font-mono break-all text-green-200">{uploadedUrl}</div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(uploadedUrl)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
                  >
                    Copy URL
                  </button>
                  <a
                    href={uploadedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded transition-colors flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Image</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg flex items-start space-x-3"
        >
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Upload Failed</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        </motion.div>
      )}

      {/* Reset Button */}
      {(success || error) && (
        <div className="text-center">
          <button
            onClick={resetTest}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            Reset Test
          </button>
        </div>
      )}

      {/* Debug Info */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Debug Information:</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <div>Test Mode: Real Firebase upload to test-uploads folder</div>
          <div>Purpose: Testing actual Firebase Storage upload and URL generation</div>
          <div>Storage Rules: Configured to allow public uploads</div>
          <div>Status: Ready for real Firebase testing</div>
          <div>Note: Check browser console for detailed upload logs</div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseUploadTest;