import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { storage, ensureAuth, auth } from './firebase';
import { FirebaseDebugger } from '../utils/firebaseDebugger';

export interface ImageUploadOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  folder?: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
}

class FirebaseImageService {
  private static instance: FirebaseImageService;

  private constructor() {}

  static getInstance(): FirebaseImageService {
    if (!FirebaseImageService.instance) {
      FirebaseImageService.instance = new FirebaseImageService();
    }
    return FirebaseImageService.instance;
  }

  /**
   * Upload an image file to Firebase Storage with improved authentication and error handling
   */
  async uploadImage(
    file: File, 
    fileName: string, 
    options: ImageUploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    try {
      // Enhanced pre-upload diagnostics
      console.log('🔑 Ensuring Firebase authentication before upload...');
      console.log('📊 Pre-upload diagnostics:');
      console.log('   • Current user:', auth.currentUser ? `${auth.currentUser.uid} (${auth.currentUser.isAnonymous ? 'anonymous' : 'authenticated'})` : 'none');
      console.log('   • Auth state ready:', auth.currentUser !== null);
      console.log('   • File validation starting...');
      
      // Try authentication but don't fail if it doesn't work (public storage rules)
      try {
        await ensureAuth();
        console.log('✅ Firebase authentication ready, starting upload...');
        console.log('   • User ID:', auth.currentUser?.uid);
        console.log('   • Auth method:', auth.currentUser?.isAnonymous ? 'Anonymous' : 'Authenticated');
      } catch (authError) {
        console.warn('⚠️  Authentication failed, but continuing with public storage rules:', authError);
        console.warn('   • Will attempt upload using public storage rules');
        console.warn('   • This may work if Firebase Storage allows public writes');
      }
      
      const { folder = 'song-images' } = options;
      
      // Validate file first
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid image file');
      }
      
      // Create a reference to the file location with better path handling
      const fileExtension = file.type.split('/')[1] || 'jpg';
      const sanitizedFileName = this.sanitizeFileName(fileName);
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const fullPath = `${folder}/${sanitizedFileName}-${timestamp}-${randomId}.${fileExtension}`;
      const storageRef = ref(storage, fullPath);
      
      console.log('📁 Upload path:', fullPath);
      console.log('📄 File info:', {
        name: file.name,
        size: file.size,
        type: file.type,
        sanitized: sanitizedFileName
      });
      console.log('🔧 Storage reference details:', {
        bucket: storageRef.bucket,
        fullPath: storageRef.fullPath,
        name: storageRef.name
      });

      // Create file metadata with proper content type and CORS headers
      const metadata = {
        contentType: file.type,
        cacheControl: 'public,max-age=3600',
        contentDisposition: 'inline',
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          userId: auth.currentUser?.uid || 'anonymous',
          source: 'song-management'
        }
      };

      console.log('🚀 Starting resumable upload with metadata:', metadata);

      // Upload the file with progress monitoring and improved timeout handling
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      // Start real-time upload monitor
      const monitor = FirebaseDebugger.startUploadMonitor(file.name, file.size);

      return new Promise((resolve, reject) => {
        let progressTimeout: NodeJS.Timeout;
        let lastProgressTime = Date.now();
        let lastBytesTransferred = 0;
        const PROGRESS_TIMEOUT = 60000; // 1 minute without progress
        const TOTAL_TIMEOUT = 300000; // 5 minutes total timeout
        const MIN_PROGRESS_BYTES = 1024; // Minimum bytes to consider as progress
        
        // Set up total timeout
        const totalTimeout = setTimeout(() => {
          console.log('⏰ Upload total timeout reached after 5 minutes');
          console.log('❌ TIMEOUT ANALYSIS:');
          console.log('   • This timeout typically happens when upload gets stuck at 20%');
          console.log('   • Common causes: Firebase authentication issues, storage rules, network problems');
          console.log('   • The system will now try fallback strategies automatically');
          uploadTask.cancel();
          monitor.stop();
          reject(new Error('Upload timeout: The upload took too long to complete. This might be due to network issues or Firebase configuration problems. Please try again with a smaller image.'));
        }, TOTAL_TIMEOUT);
        
        // Progress timeout function with byte progress check
        const resetProgressTimeout = () => {
          if (progressTimeout) clearTimeout(progressTimeout);
          progressTimeout = setTimeout(() => {
            console.log('⏰ Upload progress timeout reached - no meaningful progress detected for 1 minute');
            console.log('❌ STALLED UPLOAD ANALYSIS:');
            console.log('   • Upload has been stalled for 60 seconds without progress');
            console.log('   • This often indicates the upload is stuck at authentication phase (~20%)');
            console.log('   • Will cancel and try next fallback strategy');
            uploadTask.cancel();
            monitor.stop();
            reject(new Error('Upload stalled: No progress detected. This might indicate authentication issues or network problems. Please refresh the page and try again.'));
          }, PROGRESS_TIMEOUT);
        };
        
        // Initial progress timeout
        resetProgressTimeout();
        
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Handle progress with better detection
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const currentTime = Date.now();
            const bytesProgress = snapshot.bytesTransferred - lastBytesTransferred;
            const timeSinceLastProgress = currentTime - lastProgressTime;
            const uploadSpeed = bytesProgress > 0 ? (bytesProgress / (timeSinceLastProgress / 1000)) : 0;
            
            console.log(`🔄 Firebase Upload progress: ${progress.toFixed(1)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes, +${bytesProgress} bytes in ${timeSinceLastProgress}ms, ${(uploadSpeed / 1024).toFixed(2)} KB/s)`);
            
            // Detailed state analysis
            console.log(`📊 Upload State Analysis:`);
            console.log(`   • State: ${snapshot.state}`);
            console.log(`   • Total Size: ${(snapshot.totalBytes / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   • Transferred: ${(snapshot.bytesTransferred / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   • Remaining: ${((snapshot.totalBytes - snapshot.bytesTransferred) / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   • Upload Speed: ${(uploadSpeed / 1024).toFixed(2)} KB/s`);
            console.log(`   • Time since last progress: ${(timeSinceLastProgress / 1000).toFixed(1)}s`);
            
            // Check for stalled upload (common at 20%)
            if (progress > 15 && progress < 25 && timeSinceLastProgress > 10000) {
              console.warn('⚠️ UPLOAD APPEARS STALLED AT ~20% - This is the common issue!');
              console.warn('   • This usually indicates Firebase authentication or storage rule issues');
              console.warn('   • Will timeout and retry with different strategy in 60 seconds');
            }
            
            // Check for very slow progress
            if (bytesProgress > 0 && uploadSpeed < 1024 && progress > 10) { // Less than 1KB/s after 10%
              console.warn('⚠️ VERY SLOW UPLOAD DETECTED!');
              console.warn(`   • Current speed: ${(uploadSpeed / 1024).toFixed(2)} KB/s`);
              console.warn('   • This may indicate network issues or Firebase throttling');
            }
            
            // Reset progress timeout on any meaningful progress or state change
            if (bytesProgress > 0 || timeSinceLastProgress > 1000) {
              lastProgressTime = currentTime;
              lastBytesTransferred = snapshot.bytesTransferred;
              resetProgressTimeout();
            }
            
            // Always call progress callback
            onProgress?.({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              progress
            });
            
            // Update monitor
            monitor.update(snapshot.bytesTransferred);
            
            // Enhanced state change logging
            if (snapshot.state === 'running') {
              console.log('🏃 Upload is running - data transfer in progress');
            } else if (snapshot.state === 'paused') {
              console.log('⏸️ Upload is paused - may indicate network or auth issues');
            }
          },
          (error) => {
            // Clean up timeouts and monitor
            clearTimeout(totalTimeout);
            if (progressTimeout) clearTimeout(progressTimeout);
            monitor.stop();
            
            // Handle upload error with specific error messages
            console.error('❌ Firebase image upload error:', error);
            console.error('Error details:', {
              code: error.code,
              message: error.message,
              serverResponse: error.serverResponse
            });
            
            let errorMessage = 'Image upload failed';
            if (error.code) {
              switch (error.code) {
                case 'storage/unauthorized':
                  errorMessage = 'Access denied. Please check Firebase Storage rules and authentication. Try refreshing the page.';
                  break;
                case 'storage/canceled':
                  errorMessage = 'Upload was cancelled or timed out.';
                  break;
                case 'storage/quota-exceeded':
                  errorMessage = 'Storage quota exceeded. Please contact administrator.';
                  break;
                case 'storage/unauthenticated':
                  errorMessage = 'Authentication required. Please refresh the page and try again.';
                  break;
                case 'storage/retry-limit-exceeded':
                  errorMessage = 'Upload failed due to network issues. Please check your connection and try again.';
                  break;
                case 'storage/invalid-format':
                  errorMessage = 'Invalid image format. Please use JPEG, PNG, or WebP.';
                  break;
                case 'storage/invalid-argument':
                  errorMessage = 'Invalid upload parameters. Please try with a different image.';
                  break;
                case 'storage/object-not-found':
                  errorMessage = 'Upload destination not found. Please refresh and try again.';
                  break;
                case 'storage/server-file-wrong-size':
                  errorMessage = 'File size mismatch. Please try uploading again.';
                  break;
                case 'storage/unknown':
                  errorMessage = 'Unknown storage error. This might be a Firebase configuration issue.';
                  break;
                default:
                  errorMessage = `Upload failed: ${error.message || 'Unknown storage error'}`;
              }
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            reject(new Error(errorMessage));
          },
          async () => {
            // Handle successful upload
            try {
              // Clean up timeouts and monitor
              clearTimeout(totalTimeout);
              if (progressTimeout) clearTimeout(progressTimeout);
              monitor.stop();
              
              console.log('✅ Upload completed, getting download URL...');
              
              // Get download URL with retry mechanism
              let downloadURL: string;
              let urlAttempts = 0;
              const maxUrlAttempts = 3;
              
              while (urlAttempts < maxUrlAttempts) {
                try {
                  urlAttempts++;
                  downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                  break;
                } catch (urlError) {
                  console.warn(`⚠️ URL retrieval attempt ${urlAttempts} failed:`, urlError);
                  if (urlAttempts >= maxUrlAttempts) {
                    throw urlError;
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              console.log('✅ Firebase image uploaded successfully:', downloadURL!);
              
              // Verify the URL is accessible
              try {
                const response = await fetch(downloadURL!, { method: 'HEAD' });
                if (!response.ok) {
                  console.warn('⚠️ Upload URL may not be accessible:', response.status);
                }
              } catch (verifyError) {
                console.warn('⚠️ Could not verify upload URL accessibility:', verifyError);
                // Don't fail the upload for this
              }
              
              resolve(downloadURL!);
            } catch (error) {
              console.error('❌ Error getting download URL:', error);
              reject(new Error(`Failed to get download URL: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          }
        );
      });
    } catch (error) {
      console.error('❌ Firebase image upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload with retry mechanism and improved authentication handling
   */
  async uploadImageWithRetry(
    file: File,
    fileName: string,
    options: ImageUploadOptions = {},
    onProgress?: (progress: UploadProgress) => void,
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/${maxRetries}`);
        
        // Ensure authentication is ready before each attempt
        console.log('Ensuring authentication before upload attempt...');
        await ensureAuth();
        console.log('Authentication confirmed for attempt', attempt);
        
        const result = await this.uploadImage(file, fileName, options, onProgress);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown upload error');
        console.warn(`Upload attempt ${attempt} failed:`, lastError.message);
        
        // Handle specific auth errors
        if (lastError.message.includes('unauthenticated') || lastError.message.includes('unauthorized')) {
          console.log('🔐 Authentication error detected, forcing re-authentication...');
          // Force re-authentication by resetting the auth state
          try {
            // Clear auth state first
            if (auth.currentUser) {
              console.log('🚪 Signing out current user...');
              await auth.signOut();
            }
            
            // Wait a moment for state to clear
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to sign in again
            console.log('🔑 Attempting fresh anonymous authentication...');
            await signInAnonymously(auth);
            console.log('✅ Re-authentication successful');
          } catch (authError) {
            console.warn('⚠️ Re-authentication failed, but storage rules allow public access:', authError);
            // Continue anyway since storage rules are public
          }
        }
        
        if (attempt === maxRetries) {
          throw new Error(`Upload failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
  async uploadImageSimple(file: File, fileName: string, folder = 'song-images'): Promise<string> {
    try {
      // Ensure authentication is complete but don't fail on auth errors
      console.log('🔑 Ensuring authentication for simple upload...');
      try {
        await ensureAuth();
        console.log('✅ Authentication ready for simple upload');
      } catch (authError) {
        console.warn('⚠️ Simple upload auth failed, but continuing with public storage rules:', authError);
      }
      
      const fileExtension = file.type.split('/')[1] || 'jpg';
      const sanitizedFileName = this.sanitizeFileName(fileName);
      const fullPath = `${folder}/${sanitizedFileName}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fullPath);

      // Create file metadata with proper headers
      const metadata = {
        contentType: file.type,
        cacheControl: 'public,max-age=3600',
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          userId: auth.currentUser?.uid || 'anonymous'
        }
      };

      console.log('🚀 Starting simple upload with metadata:', metadata);
      
      // Upload file with timeout protection
      const uploadPromise = uploadBytes(storageRef, file, metadata);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Simple upload timeout: Please try again')), 180000); // Increased to 3 minutes
      });
      
      const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('✅ Firebase simple image upload successful:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Firebase simple image upload failed:', error);
      
      // Handle specific errors with better messaging
      if (error instanceof Error) {
        if (error.message.includes('unauthenticated') || error.message.includes('unauthorized')) {
          throw new Error('Authentication required. Please refresh the page and try again.');
        }
        if (error.message.includes('quota')) {
          throw new Error('Storage quota exceeded. Please try again later.');
        }
        if (error.message.includes('network') || error.message.includes('timeout')) {
          throw new Error('Network error or timeout. Please check your internet connection and try again.');
        }
        if (error.message.includes('permission-denied') || error.message.includes('access denied')) {
          throw new Error('Storage access denied. Checking storage configuration...');
        }
      }
      
      throw error;
    }
  }

  /**
   * Delete an image from Firebase Storage
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      // Extract the path from the Firebase URL
      const url = new URL(imageUrl);
      const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
      
      const imageRef = ref(storage, path);
      await deleteObject(imageRef);
      
      console.log('Firebase image deleted successfully:', path);
      return true;
    } catch (error) {
      console.error('Firebase image deletion failed:', error);
      return false;
    }
  }

  /**
   * Validate image file
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'Please select a valid image file' };
    }

    const maxSize = 15 * 1024 * 1024; // 15MB (will be compressed automatically before upload)
    if (file.size > maxSize) {
      return { valid: false, error: 'Image file is too large. Please select an image smaller than 15MB (it will be optimized automatically)' };
    }

    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      return { valid: false, error: 'Unsupported image format. Please use JPEG, PNG, or WebP' };
    }

    if (file.size < 1024) {
      return { valid: false, error: 'Image file appears to be corrupted or too small' };
    }

    return { valid: true };
  }

  /**
   * Sanitize file name for storage
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Compress image before upload (optional)
   */
  async compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          file.type,
          quality
        );
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Upload image without authentication (relies on public storage rules)
   * Use this as a fallback when authentication fails
   */
  async uploadImageNoAuth(file: File, fileName: string, folder = 'song-images'): Promise<string> {
    try {
      console.log('🚫 Attempting upload without authentication (using public storage rules)');
      
      // Validate file first
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid image file');
      }
      
      const fileExtension = file.type.split('/')[1] || 'jpg';
      const sanitizedFileName = this.sanitizeFileName(fileName);
      const fullPath = `${folder}/${sanitizedFileName}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fullPath);

      // Simple metadata without user info
      const metadata = {
        contentType: file.type,
        cacheControl: 'public,max-age=3600',
        customMetadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          uploadMethod: 'noauth'
        }
      };

      console.log('🚀 Starting no-auth upload to:', fullPath);
      
      // Direct upload without auth checks
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('✅ No-auth upload successful:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ No-auth upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload with multiple fallback strategies
   */
  async uploadImageWithFallbacks(
    file: File,
    fileName: string,
    options: ImageUploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    const { folder = 'song-images' } = options;
    
    console.log('🎯 Starting upload with fallback strategies for:', fileName);
    console.log('📁 File details:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type
    });
    
    const startTime = Date.now();
    console.log('🕰️ Upload session started at:', new Date().toISOString());
    
    // Strategy 1: Try normal upload with retry
    try {
      console.log('🎯 Strategy 1: Normal upload with retry (includes resumable upload)');
      console.log('   • This strategy uses Firebase authentication and resumable uploads');
      console.log('   • Best for large files and provides detailed progress tracking');
      console.log('   • May fail due to authentication or storage rule issues');
      
      const result = await this.uploadImageWithRetry(file, fileName, options, onProgress, 2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Strategy 1 succeeded in ${duration}s:`, result);
      return result;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`⚠️ Strategy 1 failed after ${duration}s:`, error instanceof Error ? error.message : error);
      console.warn('   → Trying Strategy 2 (Simple Upload)');
    }
    
    // Strategy 2: Try simple upload with basic authentication
    try {
      console.log('🎯 Strategy 2: Simple upload (basic authentication)');
      console.log('   • This strategy uses simpler Firebase upload method');
      console.log('   • Less feature-rich but more reliable for network issues');
      console.log('   • Uses uploadBytes instead of uploadBytesResumable');
      
      // Reset progress for new strategy
      onProgress?.({
        bytesTransferred: 0,
        totalBytes: file.size,
        progress: 0
      });
      
      const strategyStartTime = Date.now();
      const result = await this.uploadImageSimple(file, fileName, folder);
      const duration = ((Date.now() - strategyStartTime) / 1000).toFixed(1);
      console.log(`✅ Strategy 2 succeeded in ${duration}s:`, result);
      
      // Simulate progress completion for simple upload
      onProgress?.({
        bytesTransferred: file.size,
        totalBytes: file.size,
        progress: 100
      });
      
      return result;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`⚠️ Strategy 2 failed after ${duration}s:`, error instanceof Error ? error.message : error);
      console.warn('   → Trying Strategy 3 (No-Auth Upload)');
    }
    
    // Strategy 3: Try no-auth upload (relies on public storage rules)
    try {
      console.log('🎯 Strategy 3: No-auth upload (public storage rules)');
      console.log('   • This strategy bypasses Firebase authentication entirely');
      console.log('   • Relies on public storage rules allowing writes');
      console.log('   • Last resort when authentication is problematic');
      console.log('   • Should work if Firebase storage rules allow public writes');
      
      // Reset progress for new strategy
      onProgress?.({
        bytesTransferred: 0,
        totalBytes: file.size,
        progress: 0
      });
      
      const strategyStartTime = Date.now();
      const result = await this.uploadImageNoAuth(file, fileName, folder);
      const duration = ((Date.now() - strategyStartTime) / 1000).toFixed(1);
      console.log(`✅ Strategy 3 succeeded in ${duration}s:`, result);
      
      // Simulate progress completion
      onProgress?.({
        bytesTransferred: file.size,
        totalBytes: file.size,
        progress: 100
      });
      
      return result;
    } catch (error) {
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`❌ Strategy 3 failed after ${totalDuration}s total:`, error instanceof Error ? error.message : error);
      console.error('   → All upload strategies have been exhausted!');
    }
    
    // If all strategies fail, provide comprehensive error message
    const errorMessage = `All upload methods failed. This could be due to:
1. Firebase Storage rules not allowing uploads
2. Network connectivity issues
3. File format or size problems
4. Firebase configuration issues

Please check:
- Your internet connection
- Firebase Storage rules allow writes to 'song-images' folder
- Image file is valid (JPEG, PNG, WebP under 15MB)
- Firebase project configuration is correct`;
    
    throw new Error(errorMessage);
  }
}

export default FirebaseImageService;