import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Shield, Music, Upload, Edit3, Trash2, Plus, Save, X, Play, Pause, Eye, EyeOff, Volume2, Clock, AlertCircle, CheckCircle, Crop, TestTube } from 'lucide-react';
import { sampleTracks } from '../data';
import SongManagementService from '../lib/songManagementService';
import ImageResizer from '../components/ImageResizer';
import OptimizedImage from '../components/OptimizedImage';
import FirebaseImageService from '../lib/firebaseImageService';
import FirebaseUploadTest from '../components/FirebaseUploadTest';
import { FirebaseDebugger } from '../utils/firebaseDebugger';
import type { Track } from '../types';
import type { SongUpload } from '../lib/songManagementService';

interface SongFormData {
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre: string;
  releaseDate: string;
  image: File | null;
  audioUrl: string;
  imagePreview?: string;
}

const SongManagementAdmin = () => {
  console.log('🔍 SongManagementAdmin component is rendering...');
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [songs, setSongs] = useState<Track[]>(sampleTracks);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingSong, setEditingSong] = useState<Track | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [showImageResizer, setShowImageResizer] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<File | null>(null);
  const [showFirebaseTest, setShowFirebaseTest] = useState(false);
  
  const [songForm, setSongForm] = useState<SongFormData>({
    title: '',
    artist: '',
    album: '',
    duration: 0,
    genre: '',
    releaseDate: new Date().toISOString().split('T')[0],
    image: null,
    audioUrl: ''
  });

  // Secure admin password with additional security measures (same as existing admin)
  const ADMIN_PASSWORD = '29102910';
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

  // Security functions (same as existing admin)
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>"'&]/g, '') // Remove potentially harmful characters
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .trim()
      .slice(0, 50); // Limit length
  };

  const getFailedAttempts = (): number => {
    const attempts = localStorage.getItem('songAdminFailedAttempts');
    return attempts ? parseInt(attempts, 10) : 0;
  };

  const getLastFailedAttempt = (): number => {
    const timestamp = localStorage.getItem('songAdminLastFailedAttempt');
    return timestamp ? parseInt(timestamp, 10) : 0;
  };

  const isAccountLocked = (): boolean => {
    const failedAttempts = getFailedAttempts();
    const lastAttempt = getLastFailedAttempt();
    const now = Date.now();
    
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      if (now - lastAttempt < LOCKOUT_DURATION) {
        return true;
      } else {
        // Reset failed attempts after lockout period
        localStorage.removeItem('songAdminFailedAttempts');
        localStorage.removeItem('songAdminLastFailedAttempt');
        return false;
      }
    }
    return false;
  };

  const recordFailedAttempt = (): void => {
    const currentAttempts = getFailedAttempts();
    localStorage.setItem('songAdminFailedAttempts', (currentAttempts + 1).toString());
    localStorage.setItem('songAdminLastFailedAttempt', Date.now().toString());
  };

  const clearFailedAttempts = (): void => {
    localStorage.removeItem('songAdminFailedAttempts');
    localStorage.removeItem('songAdminLastFailedAttempt');
  };

  const validatePassword = (password: string): boolean => {
    return password === ADMIN_PASSWORD;
  };

  const getRemainingLockoutTime = (): number => {
    const lastAttempt = getLastFailedAttempt();
    const elapsed = Date.now() - lastAttempt;
    const remaining = LOCKOUT_DURATION - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
  };

  // Authentication check and load songs on component mount
  useEffect(() => {
    const songAdminAuth = sessionStorage.getItem('songAdminAuth');
    const authTime = sessionStorage.getItem('songAdminAuthTime');
    
    if (songAdminAuth && authTime) {
      const authAge = Date.now() - parseInt(authTime);
      const MAX_SESSION_AGE = 2 * 60 * 60 * 1000; // 2 hours
      
      if (authAge < MAX_SESSION_AGE && songAdminAuth === 'authenticated_song_admin_2024') {
        setIsAuthenticated(true);
      } else {
        sessionStorage.removeItem('songAdminAuth');
        sessionStorage.removeItem('songAdminAuthTime');
      }
    }
  }, []);

  // Load songs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadSongs();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isAccountLocked()) {
      const remainingTime = getRemainingLockoutTime();
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      setError(`Account locked. Try again in ${minutes}:${seconds.toString().padStart(2, '0')}`);
      return;
    }

    const sanitizedPassword = sanitizeInput(adminPassword);
    
    if (!validatePassword(sanitizedPassword)) {
      recordFailedAttempt();
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - getFailedAttempts();
      
      if (remainingAttempts <= 0) {
        setError('Account locked due to too many failed attempts. Try again in 15 minutes.');
      } else {
        setError(`Invalid password. ${remainingAttempts} attempts remaining.`);
      }
      setAdminPassword('');
      return;
    }

    clearFailedAttempts();
    sessionStorage.setItem('songAdminAuth', 'authenticated_song_admin_2024');
    sessionStorage.setItem('songAdminAuthTime', Date.now().toString());
    setIsAuthenticated(true);
    setAdminPassword('');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('songAdminAuth');
    sessionStorage.removeItem('songAdminAuthTime');
    setIsAuthenticated(false);
    setAdminPassword('');
    setError('');
  };

  const songService = SongManagementService.getInstance();

  // Helper function to format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Load songs from Firebase on component mount
  const loadSongs = async () => {
    try {
      const firestoreSongs = await songService.getAllSongs();
      // Merge with existing sample tracks, prioritizing Firestore data
      const combinedSongs = [...firestoreSongs, ...sampleTracks.filter(track => 
        !firestoreSongs.some(fsTrack => fsTrack.title === track.title && fsTrack.artist === track.artist)
      )];
      setSongs(combinedSongs);
    } catch (error) {
      console.error('Error loading songs:', error);
      setSongs(sampleTracks); // Fallback to sample tracks
    }
  };

  // Song management functions
  const handleFileUpload = async (file: File, type: 'image') => {
    if (type === 'image') {
      const validation = songService.validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file');
        return;
      }
      
      // Check if file is too large and needs compression before cropping
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`📁 Original file size: ${fileSizeMB.toFixed(2)}MB`);
      
      if (fileSizeMB > 5) {
        setError('');
        setUploadProgress(5);
        console.log('🗜️ File is larger than 5MB, compressing before upload...');
        
        try {
          // Compress the file first to reduce size
          const compressedFile = await compressImageBeforeUpload(file);
          console.log(`✅ Compressed from ${fileSizeMB.toFixed(2)}MB to ${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB`);
          setImageToCrop(compressedFile);
        } catch (compressionError) {
          console.error('❌ Compression failed:', compressionError);
          setError('Failed to compress image. Please try a smaller image file.');
          setUploadProgress(0);
          return;
        }
      } else {
        setImageToCrop(file);
      }
      
      setShowImageResizer(true);
    }
  };

  // Helper function to compress images before upload
  const compressImageBeforeUpload = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const timeout = setTimeout(() => {
        reject(new Error('Image compression timed out'));
      }, 30000); // 30 second timeout
      
      img.onload = () => {
        try {
          clearTimeout(timeout);
          
          // Calculate dimensions to stay under 5MB while maintaining quality
          let { width, height } = img;
          const maxDimension = 1200; // Reasonable max dimension for song covers
          
          // Scale down if too large
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          if (!ctx) {
            throw new Error('Canvas context not available');
          }
          
          // High quality settings for song covers
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with high quality and reduce if needed
          let quality = 0.85;
          
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const sizeInMB = blob.size / (1024 * 1024);
                  console.log(`🗜️ Compression attempt: ${width}x${height}, quality: ${quality.toFixed(2)}, size: ${sizeInMB.toFixed(2)}MB`);
                  
                  if (sizeInMB <= 4.5 || quality <= 0.3) { // Target under 4.5MB with minimum quality of 0.3
                    const compressedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    });
                    resolve(compressedFile);
                  } else {
                    // Reduce quality and try again
                    quality = Math.max(0.3, quality - 0.1);
                    if (quality <= 0.3 && sizeInMB > 4.5) {
                      // If we've hit minimum quality, reduce dimensions
                      const newRatio = Math.sqrt(4.5 / sizeInMB); // Roughly target 4.5MB
                      width = Math.round(width * newRatio);
                      height = Math.round(height * newRatio);
                      canvas.width = width;
                      canvas.height = height;
                      ctx.drawImage(img, 0, 0, width, height);
                      quality = 0.7; // Reset quality for new dimensions
                    }
                    tryCompress();
                  }
                } else {
                  reject(new Error('Failed to compress image'));
                }
              },
              'image/jpeg',
              quality
            );
          };
          
          tryCompress();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load image for compression'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const resetForm = () => {
    // Cancel any ongoing upload
    if (uploadAbortController) {
      uploadAbortController.abort();
      setUploadAbortController(null);
    }
    
    setSongForm({
      title: '',
      artist: '',
      album: '',
      duration: 0,
      genre: '',
      releaseDate: new Date().toISOString().split('T')[0],
      image: null,
      audioUrl: '',
      imagePreview: undefined
    });
    setIsAddingNew(false);
    setEditingSong(null);
    setShowImageResizer(false);
    setImageToCrop(null);
    setIsUploading(false);
    setUploadProgress(0);
    setError('');
  };

  const handleImageResized = (resizedFile: File) => {
    setSongForm(prev => ({ 
      ...prev, 
      image: resizedFile,
      imagePreview: URL.createObjectURL(resizedFile)
    }));
    setShowImageResizer(false);
    setImageToCrop(null);
  };

  const handleResizeCancel = () => {
    setShowImageResizer(false);
    setImageToCrop(null);
  };

  const handleCancelUpload = () => {
    if (uploadAbortController) {
      uploadAbortController.abort();
      setUploadAbortController(null);
    }
    setIsUploading(false);
    setUploadProgress(0);
    setError('Upload cancelled by user.');
  };

  const handleSaveSong = async () => {
    if (!songForm.title || !songForm.artist || (!songForm.audioUrl && !editingSong)) {
      setError('Please fill in all required fields and provide an audio URL.');
      return;
    }

    if (!songForm.imagePreview && !editingSong) {
      setError('Please upload a song image. The image is required for all songs.');
      return;
    }

    // Validate audio URL format
    if (songForm.audioUrl && !songForm.audioUrl.match(/^https?:\/\/.+\.(mp3|wav|ogg|aac|m4a)(\?.*)?$/i)) {
      setError('Please provide a valid audio URL ending with .mp3, .wav, .ogg, .aac, or .m4a');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      if (editingSong) {
        // Update existing song - since we're not using the original service structure,
        // we'll need to update this manually or modify the service
        setError('Editing with audio URLs is not yet implemented. Please create a new song instead.');
        setIsUploading(false);
        return;
      } else {
        // Add new song directly to Firebase since we're not uploading files
        let imageUrl = 'https://via.placeholder.com/400x400/6366f1/ffffff?text=No+Image'; // Default placeholder
        
        // Upload image if provided
        let finalImageUrl = 'https://via.placeholder.com/400x400/6366f1/ffffff?text=No+Image';
        
        if (songForm.image) {
          setUploadProgress(10);
          const sanitizedTitle = songForm.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_').toLowerCase();
          
          try {
            console.log('🔍 Starting Firebase upload diagnosis...');
            
            // Run diagnostics first
            try {
              await FirebaseDebugger.diagnoseFirebaseIssues();
            } catch (diagError) {
              console.warn('⚠️ Diagnostics failed, but continuing:', diagError);
            }
            
            console.log('🚀 Starting image upload to Firebase...');
            console.log('📁 Firebase config check:', { 
              hasFirebase: typeof FirebaseImageService !== 'undefined',
              hasGetInstance: typeof FirebaseImageService?.getInstance === 'function'
            });
            
            const firebaseImageService = FirebaseImageService.getInstance();
            console.log('✅ Firebase service instance created successfully');
            
            setUploadProgress(20);
            
            // Enhanced logging for upload start
            FirebaseDebugger.logUploadStart(songForm.image, sanitizedTitle);
            console.log('📄 Uploading file details:', {
              name: sanitizedTitle,
              size: `${(songForm.image.size / 1024 / 1024).toFixed(2)} MB`,
              type: songForm.image.type,
              originalName: songForm.image.name
            });
            
            // Use the upload method with fallback strategies and enhanced progress tracking
            finalImageUrl = await firebaseImageService.uploadImageWithFallbacks(
              songForm.image,
              sanitizedTitle,
              { folder: 'song-images' },
              (progress) => {
                // Update progress during image upload (20% to 60%)
                const imageProgress = 20 + (progress.progress * 0.4); // 20% + 40% of image upload progress
                setUploadProgress(Math.round(imageProgress));
                
                // Enhanced progress logging
                FirebaseDebugger.logUploadProgress(progress.progress, progress.bytesTransferred, progress.totalBytes);
                console.log(`📈 Image upload progress: ${progress.progress.toFixed(1)}% (Overall: ${imageProgress.toFixed(1)}%) - ${(progress.bytesTransferred / 1024 / 1024).toFixed(2)}/${(progress.totalBytes / 1024 / 1024).toFixed(2)} MB`);
              }
            );
            
            console.log('✅ Image uploaded successfully to Firebase:', finalImageUrl);
            setUploadProgress(60);
            
            // Verify the uploaded image URL
            try {
              const response = await fetch(finalImageUrl, { method: 'HEAD' });
              if (response.ok) {
                console.log('✅ Upload URL verified as accessible');
              } else {
                console.warn('⚠️ Upload URL may have access issues:', response.status);
              }
            } catch (verifyError) {
              console.warn('⚠️ Could not verify upload URL:', verifyError);
            }
            
          } catch (imageError) {
            console.error('❌ Error uploading image to Firebase:', imageError);
            
            // Enhanced error analysis and reporting
            FirebaseDebugger.logUploadError(imageError);
            
            // Provide comprehensive error messages with enhanced troubleshooting
            let errorMessage = 'Failed to upload image to Firebase';
            if (imageError instanceof Error) {
              const errorMsg = imageError.message.toLowerCase();
              
              if (errorMsg.includes('storage/unauthorized') || errorMsg.includes('access denied')) {
                errorMessage = 'Firebase Storage access denied. This might be due to authentication issues or storage rules.';
              } else if (errorMsg.includes('storage/quota-exceeded') || errorMsg.includes('quota')) {
                errorMessage = 'Firebase Storage quota exceeded. Please check your Firebase storage limits.';
              } else if (errorMsg.includes('storage/unauthenticated') || errorMsg.includes('authentication')) {
                errorMessage = 'Firebase authentication required.';
              } else if (errorMsg.includes('storage/retry-limit-exceeded') || errorMsg.includes('network')) {
                errorMessage = 'Upload failed due to network issues.';
              } else if (errorMsg.includes('storage/invalid-format') || errorMsg.includes('format')) {
                errorMessage = 'Invalid image format. Please use JPEG, PNG, or WebP.';
              } else if (errorMsg.includes('upload stalled') || errorMsg.includes('stuck') || errorMsg.includes('timeout')) {
                errorMessage = 'Upload timeout or stuck. This is often due to authentication issues or network problems.';
              } else if (errorMsg.includes('all upload methods failed')) {
                errorMessage = 'All upload methods failed. Please check your Firebase configuration and network connection.';
              } else {
                errorMessage = `Upload failed: ${imageError.message}`;
              }
            }
            
            // Enhanced error message with specific troubleshooting
            const troubleshootingTips = [
              '• Refresh the page and try again',
              '• The image has been automatically compressed for optimal upload',
              '• Check your internet connection stability', 
              '• Try uploading from a different network if possible',
              '• Make sure the image file is not corrupted',
              '• Contact support if the issue persists'
            ].join('\n');
            
            setError(`${errorMessage}\n\nTroubleshooting Steps:\n${troubleshootingTips}`);
            setIsUploading(false);
            setUploadProgress(0);
            return;
          }
        }
        
        // Create song metadata
        const songMetadata = {
          title: songForm.title,
          artist: songForm.artist,
          album: songForm.album,
          genre: songForm.genre,
          releaseDate: songForm.releaseDate,
          duration: songForm.duration,
          audioUrl: songForm.audioUrl,
          imageUrl: finalImageUrl,
          plays: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        setUploadProgress(70);
        console.log('Saving song metadata to Firestore...', songMetadata);

        try {
          // Save to Firebase Firestore
          const { collection, addDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          
          const docRef = await addDoc(collection(db, 'songs'), songMetadata);
          console.log('Song saved successfully with ID:', docRef.id);
          
          setUploadProgress(90);
          
          // Add a small delay to show the final progress
          await new Promise(resolve => setTimeout(resolve, 500));
          setUploadProgress(100);
          
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          setError(`Failed to save song: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown database error'}`);
          setIsUploading(false);
          setUploadProgress(0);
          return;
        }
      }

      // Reload songs from database
      await loadSongs();

      setTimeout(() => {
        resetForm();
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

    } catch (error) {
      console.error('Error saving song:', error);
      setError(error instanceof Error ? error.message : 'Failed to save song. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (confirm('Are you sure you want to delete this song? This action cannot be undone.')) {
      try {
        const result = await songService.deleteSong(songId);
        if (result.success) {
          await loadSongs(); // Reload songs from database
        } else {
          setError(result.error || 'Failed to delete song');
        }
      } catch (error) {
        console.error('Error deleting song:', error);
        setError('Failed to delete song. Please try again.');
      }
    }
  };

  const handleEditSong = (song: Track) => {
    setSongForm({
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      genre: song.genre,
      releaseDate: song.releaseDate,
      image: null,
      audioUrl: song.audioUrl || '',
      imagePreview: song.image
    });
    setEditingSong(song);
    setIsAddingNew(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20"
        >
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-purple-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Song Management</h1>
            <p className="text-gray-300">Secure Admin Access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter admin password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isAccountLocked()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Access Song Management
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Music className="w-8 h-8 text-purple-300" />
            <h1 className="text-2xl font-bold">Song Management Admin</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">Total Songs: {songs.length}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Add New Song Button */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => setIsAddingNew(true)}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Song</span>
          </button>
          
          <button
            onClick={() => setShowFirebaseTest(!showFirebaseTest)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-all duration-300"
          >
            <TestTube className="w-5 h-5" />
            <span>{showFirebaseTest ? 'Hide' : 'Show'} Firebase Test</span>
          </button>
        </div>

        {/* Firebase Upload Test Component */}
        {showFirebaseTest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <FirebaseUploadTest />
          </motion.div>
        )}

        {/* Song Form Modal */}
        {isAddingNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingSong ? 'Edit Song' : 'Add New Song'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Song Title *
                    </label>
                    <input
                      type="text"
                      value={songForm.title}
                      onChange={(e) => setSongForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter song title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Artist Name *
                    </label>
                    <input
                      type="text"
                      value={songForm.artist}
                      onChange={(e) => setSongForm(prev => ({ ...prev, artist: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter artist name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Album
                    </label>
                    <input
                      type="text"
                      value={songForm.album}
                      onChange={(e) => setSongForm(prev => ({ ...prev, album: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter album name"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Genre
                    </label>
                    <select
                      value={songForm.genre}
                      onChange={(e) => setSongForm(prev => ({ ...prev, genre: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      style={{
                        colorScheme: 'dark'
                      }}
                    >
                      <option value="" className="bg-gray-800 text-white">Select Genre</option>
                      <option value="Pop" className="bg-gray-800 text-white">Pop</option>
                      <option value="Rock" className="bg-gray-800 text-white">Rock</option>
                      <option value="Hip Hop" className="bg-gray-800 text-white">Hip Hop</option>
                      <option value="Electronic" className="bg-gray-800 text-white">Electronic</option>
                      <option value="Classical" className="bg-gray-800 text-white">Classical</option>
                      <option value="Jazz" className="bg-gray-800 text-white">Jazz</option>
                      <option value="R&B" className="bg-gray-800 text-white">R&B</option>
                      <option value="Country" className="bg-gray-800 text-white">Country</option>
                      <option value="Folk" className="bg-gray-800 text-white">Folk</option>
                      <option value="Indie" className="bg-gray-800 text-white">Indie</option>
                      <option value="Nepali Pop" className="bg-gray-800 text-white">Nepali Pop</option>
                      <option value="Kids" className="bg-gray-800 text-white">Kids</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Release Date
                    </label>
                    <input
                      type="date"
                      value={songForm.releaseDate}
                      onChange={(e) => setSongForm(prev => ({ ...prev, releaseDate: e.target.value }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Song Image *
                      <span className="text-xs text-gray-400 ml-2">(Required - Custom crop - 1:1 ratio)</span>
                    </label>
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center ${
                      songForm.imagePreview 
                        ? 'border-green-500/50 bg-green-500/5' 
                        : 'border-red-500/50 bg-red-500/5'
                    }`}>
                      {songForm.imagePreview ? (
                        <div>
                          <div className="mb-4">
                            <p className="text-xs text-gray-400 mb-2">Live Preview (as it appears in All Songs page):</p>
                            <div className="flex justify-center mb-3">
                              <div className="w-14 h-14 bg-gradient-to-br from-spotify-light-gray to-spotify-gray rounded-md overflow-hidden border border-spotify-gray shadow-sm">
                                <img
                                  src={songForm.imagePreview}
                                  alt="Live Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mb-4">Actual size: 56×56px (1:1 square ratio)</p>
                          </div>
                          <div className="mb-4 p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-gray-400 mb-2">Cropped Preview:</p>
                            <div className="aspect-square w-32 h-32 mx-auto bg-gray-800 rounded-lg overflow-hidden border-2 border-solid border-green-400/50">
                              <img
                                src={songForm.imagePreview}
                                alt="Cropped Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">✓ Custom cropped to 1:1 ratio</p>
                          </div>
                          <div className="flex items-center justify-center space-x-3">
                            <button
                              onClick={() => setSongForm(prev => ({ ...prev, image: null, imagePreview: undefined }))}
                              className="text-red-400 hover:text-red-300 text-sm flex items-center space-x-1"
                            >
                              <X className="w-4 h-4" />
                              <span>Remove Image</span>
                            </button>
                            <button
                              onClick={() => {
                                if (songForm.image) {
                                  setImageToCrop(songForm.image);
                                  setShowImageResizer(true);
                                }
                              }}
                              className="text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1"
                            >
                              <Crop className="w-4 h-4" />
                              <span>Re-crop</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-12 h-12 text-red-400 mx-auto mb-2" />
                          <p className="text-red-400 mb-2 font-medium">⚠️ Song Image Required</p>
                          <p className="text-xs text-gray-400 mb-4">
                            Upload any image - you'll be able to customize the crop area
                            <br />Final display size: 56×56px (1:1 square ratio)
                            <br />🎨 <strong>Manual cropping available!</strong>
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')}
                            className="hidden"
                            id="image-upload"
                          />
                          <label
                            htmlFor="image-upload"
                            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg cursor-pointer transition-colors"
                          >
                            Choose Image
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Audio URL *
                      <span className="text-xs text-gray-400 ml-2">(Supabase storage URL)</span>
                    </label>
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={songForm.audioUrl}
                        onChange={(e) => setSongForm(prev => ({ ...prev, audioUrl: e.target.value }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/song.mp3"
                        required
                      />
                      {songForm.audioUrl && (
                        <div className="p-3 bg-white/5 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <Volume2 className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-green-400">Audio URL Set</span>
                          </div>
                          <p className="text-xs text-gray-400 break-all mb-2">{songForm.audioUrl}</p>
                          {songForm.duration > 0 && (
                            <p className="text-sm text-gray-300">Duration: {formatDuration(songForm.duration)}</p>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>📋 <strong>How to get the URL:</strong></p>
                        <p>1. Upload your audio file to Supabase storage bucket "UtsavXmusic"</p>
                        <p>2. Make sure the file is publicly accessible</p>
                        <p>3. Copy the public URL and paste it above</p>
                        <p>4. Supported formats: MP3, WAV, OGG, AAC, M4A</p>
                      </div>
                    </div>
                  </div>

                  {/* Manual Duration Input */}
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Duration *
                      <span className="text-xs text-gray-400 ml-2">(Required for audio URLs)</span>
                    </label>
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={Math.floor(songForm.duration / 60)}
                          onChange={(e) => {
                            const minutes = parseInt(e.target.value) || 0;
                            const seconds = songForm.duration % 60;
                            setSongForm(prev => ({ ...prev, duration: minutes * 60 + seconds }));
                          }}
                          className="w-16 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          required
                        />
                        <span className="text-gray-300">min</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={songForm.duration % 60}
                          onChange={(e) => {
                            const seconds = parseInt(e.target.value) || 0;
                            const minutes = Math.floor(songForm.duration / 60);
                            setSongForm(prev => ({ ...prev, duration: minutes * 60 + seconds }));
                          }}
                          className="w-16 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          required
                        />
                        <span className="text-gray-300">sec</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Total: {formatDuration(songForm.duration)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      📁 Please enter the exact duration of your audio file. You can check this in your media player or file properties.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Uploading...</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-300">{uploadProgress}%</span>
                      <button
                        onClick={handleCancelUpload}
                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded border border-red-400/50 hover:border-red-300 transition-colors"
                        title="Cancel Upload"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {uploadProgress < 10 && 'Preparing upload...'}
                    {uploadProgress >= 5 && uploadProgress < 20 && 'Optimizing image size for upload...'}
                    {uploadProgress >= 20 && uploadProgress < 60 && 'Uploading compressed image to Firebase...'}
                    {uploadProgress >= 60 && uploadProgress < 90 && 'Saving song metadata...'}
                    {uploadProgress >= 90 && 'Finalizing...'}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Image Missing Warning */}
              {!songForm.imagePreview && !editingSong && (
                <div className="mt-4 bg-amber-500/20 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>Image Required:</strong> Please upload a song image before saving. 
                    The save button will be enabled once you add an image.
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-4 mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={resetForm}
                  className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSong}
                  disabled={isUploading || !songForm.title || !songForm.artist || !songForm.audioUrl || !songForm.duration || !songForm.imagePreview}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingSong ? 'Update Song' : 'Save Song'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Songs List */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold">Song Library</h2>
            <p className="text-gray-300 mt-1">Manage your music collection</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Song</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Artist</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Album</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Duration</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Genre</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song, index) => (
                  <motion.tr
                    key={song.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-spotify-gray">
                          <OptimizedImage
                            src={song.image}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            priority={false}
                          />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{song.title}</h3>
                          <p className="text-sm text-gray-400">Plays: {song.plays?.toLocaleString() || 0}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{song.artist}</td>
                    <td className="p-4 text-gray-300">{song.album}</td>
                    <td className="p-4 text-gray-300 flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(song.duration)}</span>
                    </td>
                    <td className="p-4">
                      <span className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded-full text-xs">
                        {song.genre}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditSong(song)}
                          className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                          title="Edit Song"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSong(song.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete Song"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Image Resizer Modal */}
      {showImageResizer && imageToCrop && (
        <ImageResizer
          imageFile={imageToCrop}
          onResize={handleImageResized}
          onCancel={handleResizeCancel}
          outputSize={400}
        />
      )}
    </div>
  );
};

export default SongManagementAdmin;