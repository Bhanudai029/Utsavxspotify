
import React, { useState, useCallback } from 'react';
import { UploadStatus } from '../types';
import { Spinner } from './Spinner';
import { UploadCloudIcon, CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon } from './Icons';

interface ImageUploaderProps {
  status: UploadStatus;
  imageUrl: string | null;
  error: string | null;
  onUpload: (file: File) => void;
  onReset: () => void;
}

const IdleView: React.FC<{ onFileSelect: (file: File) => void; isDragging: boolean }> = ({ onFileSelect, isDragging }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <label
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ease-in-out
      ${isDragging 
        ? 'border-sky-400 bg-sky-900/50' 
        : 'border-slate-600 bg-slate-800/50 hover:bg-slate-800/80 hover:border-slate-500'}`
      }
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <UploadCloudIcon className="w-10 h-10 mb-4 text-slate-400" />
        <p className="mb-2 text-sm text-slate-400">
          <span className="font-semibold text-sky-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-slate-500">PNG, JPG, GIF up to 10MB</p>
      </div>
      <input id="dropzone-file" type="file" className="hidden" accept="image/png, image/jpeg, image/gif" onChange={handleFileChange} />
    </label>
  );
};

const UploadingView: React.FC = () => (
  <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg border-slate-600 bg-slate-800/50">
    <Spinner />
    <p className="mt-4 text-lg text-slate-300 animate-pulse">Uploading...</p>
  </div>
);

const SuccessView: React.FC<{ imageUrl: string; onReset: () => void }> = ({ imageUrl, onReset }) => (
  <div className="flex flex-col items-center justify-center w-full h-auto p-4 border-2 border-dashed rounded-lg border-green-500 bg-green-900/20">
    <div className="flex items-center text-green-400 mb-4">
      <CheckCircleIcon className="w-6 h-6 mr-2" />
      <p className="font-semibold">Upload Successful!</p>
    </div>
    <img src={imageUrl} alt="Uploaded preview" className="max-w-full max-h-80 rounded-lg shadow-lg mb-4" />
    <button
      onClick={onReset}
      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-colors"
    >
      <RefreshCwIcon className="w-4 h-4 mr-2" />
      Upload Another Image
    </button>
  </div>
);

const ErrorView: React.FC<{ error: string; onReset: () => void }> = ({ error, onReset }) => (
  <div className="flex flex-col items-center justify-center w-full h-64 p-4 border-2 border-dashed rounded-lg border-red-500 bg-red-900/20">
    <div className="flex items-center text-red-400 mb-4">
      <AlertTriangleIcon className="w-6 h-6 mr-2" />
      <p className="font-semibold">Upload Failed</p>
    </div>
    <p className="text-center text-sm text-red-300 mb-6 max-w-md">{error}</p>
    <button
      onClick={onReset}
      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500 transition-colors"
    >
      <RefreshCwIcon className="w-4 h-4 mr-2" />
      Try Again
    </button>
  </div>
);

export const ImageUploader: React.FC<ImageUploaderProps> = ({ status, imageUrl, error, onUpload, onReset }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEvent = useCallback((e: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  }, [onUpload]);

  const renderContent = () => {
    switch (status) {
      case UploadStatus.UPLOADING:
        return <UploadingView />;
      case UploadStatus.SUCCESS:
        return imageUrl ? <SuccessView imageUrl={imageUrl} onReset={onReset} /> : <ErrorView error="Image URL is missing." onReset={onReset} />;
      case UploadStatus.ERROR:
        return <ErrorView error={error || 'An unknown error occurred.'} onReset={onReset} />;
      case UploadStatus.IDLE:
      default:
        return <IdleView onFileSelect={onUpload} isDragging={isDragging} />;
    }
  };

  return (
    <div
      className="w-full"
      onDragEnter={(e) => handleDragEvent(e, true)}
      onDragLeave={(e) => handleDragEvent(e, false)}
      onDragOver={(e) => handleDragEvent(e, true)}
      onDrop={handleDrop}
    >
      {renderContent()}
    </div>
  );
};
