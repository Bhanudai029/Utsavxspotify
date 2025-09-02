
import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { uploadImage } from './services/cloudinaryService';
import { UploadStatus } from './types';
import type { CloudinaryUploadResponse } from './types';

function App() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(UploadStatus.IDLE);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploadStatus(UploadStatus.UPLOADING);
    setError(null);
    setUploadedImageUrl(null);

    try {
      const result: CloudinaryUploadResponse = await uploadImage(file);
      if (result.secure_url) {
        setUploadedImageUrl(result.secure_url);
        setUploadStatus(UploadStatus.SUCCESS);
      } else {
        throw new Error('Upload succeeded but no secure URL was returned.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Upload failed:', errorMessage);
      setError(errorMessage);
      setUploadStatus(UploadStatus.ERROR);
    }
  }, []);
  
  const handleReset = useCallback(() => {
    setUploadStatus(UploadStatus.IDLE);
    setUploadedImageUrl(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
            Cloudinary Image Uploader
          </h1>
          <p className="text-slate-400 mt-2">
            Drag & drop an image below to upload it directly to your Cloudinary storage.
          </p>
        </header>

        <main>
          <ImageUploader 
            status={uploadStatus}
            imageUrl={uploadedImageUrl}
            error={error}
            onUpload={handleUpload}
            onReset={handleReset}
          />
        </main>

        <footer className="text-center mt-8 text-slate-500 text-sm">
          <p>Powered by React, Tailwind CSS, and the Cloudinary API.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
