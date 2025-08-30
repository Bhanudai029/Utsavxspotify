import { motion } from 'framer-motion';
import { Share2, Music, Calendar, LogOut, Camera, Upload, Trash2, Check } from 'lucide-react';
import { currentUser as sampleCurrentUser, sampleTracks } from '../data';
import { useUser } from '../contexts/UserContext';
import ProtectedComponent from '../components/ProtectedComponent';
import { useState, useRef, useEffect } from 'react';
import { compressImage, validateImageFile, getOptimalCompressionSettings } from '../lib/imageUtils';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  return (
    <ProtectedComponent
      requireAuth={true}
      authTitle="Access Your Profile"
      authMessage="Login to view your music profile and personalized settings"
    >
      <ProfileContent />
    </ProtectedComponent>
  );
};

const ProfileContent = () => {
  const { currentUser, logout, updateProfileImage, getUserStats, userStats: preloadedUserStats, isStatsLoading: preloadedStatsLoading, preloadUserStats } = useUser();
  const navigate = useNavigate();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [imageRefreshKey, setImageRefreshKey] = useState(0); // Force image refresh
  const [userStats, setUserStats] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);



  // Detect mobile device
  useEffect(() => {
    const checkMobile = (): boolean => {
      // Check user agent
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i;
      
      // Check touch capability and screen size
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const smallScreen = window.innerWidth <= 768;
      
      // Check if it's a mobile device based on multiple factors
      const isMobileUA = mobileRegex.test(userAgent);
      const isMobileTouch = hasTouch && smallScreen;
      
      // Additional check for iPad detection (which reports as MacIntel)
      const isIPad = /iPad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const result = isMobileUA || isMobileTouch || isIPad;
      console.log('📱 Mobile detection:', {
        userAgent: userAgent.substring(0, 50) + '...',
        isMobileUA,
        hasTouch,
        smallScreen,
        isIPad,
        result
      });
      
      return result;
    };
    
    setIsMobile(checkMobile());
    
    // Re-check on window resize
    const handleResize = () => {
      setIsMobile(checkMobile());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Watch for profile image changes and force refresh
  useEffect(() => {
    console.log('🔍 Profile data changed:', {
      hasUser: !!currentUser,
      profileImage: currentUser?.profileImage ? currentUser.profileImage.substring(0, 50) + '...' : 'none',
      displayName: currentUser?.displayName
    });
    
    if (currentUser?.profileImage) {
      console.log('🖼️ Profile image changed, forcing refresh:', currentUser.profileImage.substring(0, 50) + '...');
      setImageRefreshKey(prev => prev + 1);
    }
  }, [currentUser?.profileImage, currentUser?.displayName]);
  
  // Load user stats when currentUser changes - use preloaded data when available
  useEffect(() => {
    const loadUserStats = async () => {
      if (!currentUser?.id) {
        setUserStats({ followers: 0, following: 0 });
        setIsLoadingStats(false);
        return;
      }
      
      // Check if we have preloaded stats available
      if (preloadedUserStats && !preloadedStatsLoading) {
        console.log('📊 Using preloaded user stats for instant display:', preloadedUserStats);
        setUserStats({
          followers: preloadedUserStats.followersCount,
          following: preloadedUserStats.followingCount
        });
        setIsLoadingStats(false);
        return;
      }
      
      // If preloaded stats are being loaded, wait a bit
      if (preloadedStatsLoading) {
        console.log('🔄 Waiting for preloaded stats...');
        // Set a short timeout to check again
        const checkTimer = setTimeout(() => {
          if (preloadedUserStats) {
            setUserStats({
              followers: preloadedUserStats.followersCount,
              following: preloadedUserStats.followingCount
            });
            setIsLoadingStats(false);
          } else {
            // Fall back to loading stats manually
            loadStatsManually();
          }
        }, 500);
        
        return () => clearTimeout(checkTimer);
      }
      
      // Fall back to manual loading if no preloaded data
      loadStatsManually();
    };
    
    const loadStatsManually = async () => {
      if (!currentUser?.id) return;
      
      try {
        console.log('🔄 Loading user stats manually (fallback)...');
        setIsLoadingStats(true);
        const stats = await getUserStats(currentUser.id);
        setUserStats({
          followers: stats.followersCount,
          following: stats.followingCount
        });
        console.log('📊 User stats loaded manually:', stats);
      } catch (error) {
        console.error('Error loading user stats:', error);
        setUserStats({ followers: 0, following: 0 });
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    loadUserStats();
  }, [currentUser?.id, preloadedUserStats, preloadedStatsLoading, getUserStats]);
  
  // Refresh stats when page gains focus (user navigates back from other pages)
  useEffect(() => {
    const handleFocus = async () => {
      if (currentUser?.id && !isLoadingStats) {
        console.log('🔄 Page focused, refreshing user stats...');
        try {
          // Trigger preload refresh in UserContext
          preloadUserStats();
          
          // Also update local state
          const stats = await getUserStats(currentUser.id);
          setUserStats({
            followers: stats.followersCount,
            following: stats.followingCount
          });
          console.log('📊 Stats refreshed on focus:', stats);
        } catch (error) {
          console.error('Error refreshing stats on focus:', error);
        }
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.id, getUserStats, isLoadingStats, preloadUserStats]);
  
  // Get profile image URL or default placeholder
  const getUserProfileImageUrl = () => {
    const profileImage = currentUser?.profileImage;
    const defaultImage = '/PPplaceholder-modified.png';
    
    console.log('🖼️ Getting profile image URL:', {
      hasProfileImage: !!profileImage,
      imageType: profileImage ? (profileImage.startsWith('data:image/') ? 'base64' : 'url') : 'none',
      imageLength: profileImage ? profileImage.length : 0
    });
    
    // If no profile image, use default
    if (!profileImage || profileImage === defaultImage) {
      console.log('🖼️ Using default profile image');
      return defaultImage;
    }
    
    // Add cache-busting parameter for uploaded images to ensure fresh display
    const timestamp = Date.now();
    console.log('🖼️ Adding cache-buster to profile image:', timestamp);
    
    // For base64 images, add the parameter as a fragment
    if (profileImage.startsWith('data:image/')) {
      return `${profileImage}#t=${timestamp}`;
    } else {
      // For regular URLs, add query parameter
      return `${profileImage}${profileImage.includes('?') ? '&' : '?'}t=${timestamp}`;
    }
  };

  // Check if user has a custom profile image (not the default placeholder)
  const userHasCustomProfileImage = () => {
    return currentUser?.profileImage && currentUser.profileImage !== '/PPplaceholder-modified.png';
  };
  
  // Permanent crop styling for profile placeholder
  const getProfileImageStyle = () => {
    // Reduced scale for better visibility: scale(1.0), x(0px), y(0px)
    return {
      transform: 'scale(1.0) translate(0px, 0px)',
      transformOrigin: 'center center'
    };
  };
  
  // Delete profile image function with retry logic
  const handleDeleteProfileImage = async () => {
    if (!currentUser || !userHasCustomProfileImage()) return;
    
    setIsDeletingImage(true);
    setShowDeleteConfirm(false);
    setUploadError('');
    
    const attemptDelete = async (retryCount = 0): Promise<void> => {
      try {
        const result = await updateProfileImage('');
        
        if (result.success) {
          console.log('Profile image deleted successfully!');
          setUploadProgress('Profile picture removed successfully!');
          setImageRefreshKey(prev => prev + 1); // Force image refresh
          setTimeout(() => setUploadProgress(''), 3000);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error: any) {
        console.error('Error deleting profile image:', error);
        
        if (retryCount < 2) {
          console.log(`Retrying delete (attempt ${retryCount + 2}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return attemptDelete(retryCount + 1);
        } else {
          const errorMessage = error.message || 'Failed to delete profile image. Please try again.';
          setUploadError(errorMessage);
          setTimeout(() => setUploadError(''), 5000);
        }
      }
    };
    
    try {
      await attemptDelete();
    } finally {
      setIsDeletingImage(false);
    }
  };
  
  // Optimize image loading with cache check
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.opacity = '1';
    console.log('🖼️ Profile image loaded successfully, src:', img.src.substring(0, 50) + '...');
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    console.warn('⚠️ Failed to load profile image, using fallback. Src was:', img.src.substring(0, 50) + '...');
    // Force fallback to default image
    img.src = '/PPplaceholder-modified.png';
  };
  
  // Handle image upload with mobile-optimized compression and retry logic
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('📁 handleImageUpload called, file:', file);
    
    if (!file) {
      console.log('📁 No file selected');
      return;
    }
    
    console.log(`📱 Mobile upload detected: ${isMobile}`);
    console.log(`📁 File info: ${file.name}, ${Math.round(file.size / 1024)}KB, ${file.type}`);
    
    // Clear previous states
    setUploadError('');
    setUploadProgress('');
    setUploadSuccess(false);
    
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file');
      setTimeout(() => setUploadError(''), 8000);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
      return;
    }
    
    setIsUploadingImage(true);
    setUploadProgress('Preparing image...');
    
    const attemptUpload = async (retryCount = 0): Promise<void> => {
      try {
        // Get mobile-optimized compression settings
        let compressionSettings = getOptimalCompressionSettings(file.size, isMobile);
        
        // Extra aggressive compression for mobile to ensure smaller size
        if (isMobile) {
          compressionSettings = {
            maxWidth: Math.min(compressionSettings.maxWidth || 400, 300),
            maxHeight: Math.min(compressionSettings.maxHeight || 400, 300),
            quality: Math.min(compressionSettings.quality || 0.8, 0.6),
            format: 'jpeg' as const
          };
          console.log('📱 Using mobile-optimized compression:', compressionSettings);
        }
        
        setUploadProgress('Processing image...');
        
        // Compress image with timeout for mobile
        const compressionPromise = compressImage(file, compressionSettings);
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Image compression timed out')), isMobile ? 15000 : 10000);
        });
        
        const compressedImageUrl = await Promise.race([compressionPromise, timeoutPromise]);
        
        // Check compressed size
        const compressedSize = (compressedImageUrl.length * 3) / 4;
        console.log(`📷 Compressed to ${Math.round(compressedSize / 1024)}KB`);
        
        // If still too large for mobile, compress more aggressively
        if (isMobile && compressedSize > 500 * 1024) { // 500KB limit for mobile
          console.log('📱 File still too large for mobile, applying extra compression...');
          const extraCompressionSettings = {
            maxWidth: 250,
            maxHeight: 250,
            quality: 0.5,
            format: 'jpeg' as const
          };
          
          setUploadProgress('Optimizing for mobile...');
          const recompressedImageUrl = await compressImage(file, extraCompressionSettings);
          
          const recompressedSize = (recompressedImageUrl.length * 3) / 4;
          console.log(`📱 Re-compressed to ${Math.round(recompressedSize / 1024)}KB`);
          
          // Use the recompressed version
          setUploadProgress('Uploading optimized image...');
          const result = await updateProfileImage(recompressedImageUrl);
          
          if (result.success) {
            console.log('✅ Mobile profile image updated successfully!');
            setUploadProgress('Profile picture updated successfully!');
            setUploadSuccess(true);
            setImageRefreshKey(prev => prev + 1); // Force image refresh
            setTimeout(() => {
              setUploadProgress('');
              setUploadSuccess(false);
            }, 3000);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } else {
          setUploadProgress('Uploading image...');
          
          // Upload compressed image with mobile timeout
          const uploadPromise = updateProfileImage(compressedImageUrl);
          const uploadTimeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) => {
            setTimeout(() => reject(new Error('Upload timed out')), isMobile ? 30000 : 20000);
          });
          
          const result = await Promise.race([uploadPromise, uploadTimeoutPromise]);
          
          if (result.success) {
            console.log('✅ Profile image updated successfully!');
            setUploadProgress('Profile picture updated successfully!');
            setUploadSuccess(true);
            setImageRefreshKey(prev => prev + 1); // Force image refresh
            setTimeout(() => {
              setUploadProgress('');
              setUploadSuccess(false);
            }, 3000);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        }
      } catch (error: any) {
        console.error('❌ Error uploading image:', error);
        
        if (retryCount < (isMobile ? 3 : 2)) { // Extra retry for mobile
          const delay = isMobile ? 2000 * (retryCount + 1) : 1000 * (retryCount + 1);
          console.log(`🔄 Retrying upload (attempt ${retryCount + 2}/${isMobile ? 4 : 3})...`);
          setUploadProgress(`Retrying upload (${retryCount + 2}/${isMobile ? 4 : 3})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptUpload(retryCount + 1);
        } else {
          let errorMessage = error.message || 'Failed to upload image. Please try again.';
          
          // Mobile-specific error messages
          if (isMobile) {
            if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
              errorMessage = 'Upload timed out. Please check your mobile connection and try again.';
            } else if (error.message?.includes('network') || error.message?.includes('Network')) {
              errorMessage = 'Network issue detected. Please check your mobile data/WiFi and try again.';
            } else if (error.message?.includes('too large')) {
              errorMessage = 'Image is too large for mobile upload. Please select a smaller image.';
            } else {
              errorMessage = 'Mobile upload failed. Please ensure you have a stable connection and try again.';
            }
          }
          
          setUploadError(errorMessage);
          setUploadProgress('');
          setUploadSuccess(false);
          setTimeout(() => setUploadError(''), isMobile ? 10000 : 5000);
        }
      }
    };
    
    try {
      await attemptUpload();
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };
  
  // Handle click on camera button with mobile optimization and debugging
  const handleCameraClick = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const debugMsg = `📱 [${timestamp}] Camera clicked, mobile: ${isMobile}`;
    console.log(debugMsg);
    setDebugInfo(debugMsg);
    
    if (isUploadingImage || isDeletingImage) {
      console.log('Upload/delete in progress, ignoring click');
      return;
    }
    
    // Clear any previous states
    setUploadError('');
    setUploadProgress('');
    setUploadSuccess(false);
    
    if (fileInputRef.current) {
      // Reset the input value to allow selecting the same file again
      fileInputRef.current.value = '';
      
      try {
        // Simplified approach that works better across devices
        fileInputRef.current.click();
        console.log(`${isMobile ? '📱' : '🔧'} File input clicked`);
      } catch (error) {
        console.error('❌ File input click failed:', error);
        setUploadError('Failed to open file selector. Please try again.');
        setTimeout(() => setUploadError(''), 5000);
      }
    } else {
      console.error('❌ File input ref is null');
      setUploadError('File selector not available. Please refresh the page.');
      setTimeout(() => setUploadError(''), 5000);
    }
  };
  
  // Merge real user data with sample data structure, using actual user stats
  const userData = {
    ...sampleCurrentUser,
    name: currentUser?.displayName || currentUser?.name || sampleCurrentUser.name,
    email: currentUser?.name ? `${currentUser.name}@example.com` : sampleCurrentUser.email,
    followers: userStats.followers,
    following: userStats.following
  };

  const handleLogout = () => {
    logout();
  };

  // Navigate to followers page
  const handleFollowersClick = () => {
    if (currentUser?.id) {
      navigate('/followers');
    }
  };

  // Navigate to following page
  const handleFollowingClick = () => {
    if (currentUser?.id) {
      navigate('/following');
    }
  };
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <motion.div 
      className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-center p-6 pb-4 relative"
        variants={itemVariants}
      >
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <div className="absolute right-6 flex items-center gap-2">
          <motion.button 
            onClick={handleLogout}
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors"
            whileTap={{ scale: 0.95 }}
            title="Logout"
          >
            <LogOut className="text-white" size={20} />
          </motion.button>
          <motion.button 
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <Share2 className="text-white" size={24} />
          </motion.button>
        </div>
      </motion.div>

      {/* Profile Info */}
      <motion.div 
        className="px-6 mb-8"
        variants={itemVariants}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Profile Image with Permanent Crop */}
          <motion.div 
            className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 relative group"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-full h-full rounded-full overflow-hidden shadow-2xl relative">
              <img 
                src={getUserProfileImageUrl()} 
                alt={userData.name}
                className="w-full h-full object-cover transition-all duration-300"
                style={{
                  ...getProfileImageStyle(),
                  opacity: 0.9 // Start with slight transparency for smooth loading
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="eager" // Prioritize loading since it might be preloaded
                decoding="async"
                key={`${currentUser?.profileImage || 'default'}-${imageRefreshKey}`} // Force re-render when image changes
              />
              
              {/* Sync indicator for cross-device updates */}
              {currentUser?.profileImage && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-spotify-black opacity-90" 
                     title="Profile synced across devices" />
              )}
            </div>
            
            {/* Upload Button - Always visible on mobile, hover-only on desktop */}
            <motion.button
              onClick={handleCameraClick}
              disabled={isUploadingImage || isDeletingImage}
              className={`absolute -bottom-2 -left-2 w-12 h-12 ${uploadSuccess ? 'bg-green-500' : 'bg-spotify-green'} text-black rounded-full flex items-center justify-center hover:bg-spotify-green/90 disabled:opacity-50 shadow-lg border-2 border-spotify-black opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 cursor-pointer`}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: isMobile ? 1.0 : 1.1 }}
              title={uploadSuccess ? "Profile picture uploaded successfully!" : (userHasCustomProfileImage() ? "Change profile picture" : "Upload profile picture")}
              style={{ 
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none'
              }}
            >
              {isUploadingImage ? (
                <Upload className="w-6 h-6 animate-spin" />
              ) : uploadSuccess ? (
                <Check className="w-6 h-6" />
              ) : (
                <Camera className="w-6 h-6" />
              )}
            </motion.button>
            

            
            {/* Delete Button - Always visible on mobile if user has custom image, hover-only on desktop */}
            {userHasCustomProfileImage() && (
              <motion.button
                onClick={() => {
                  setUploadError('');
                  setUploadProgress('');
                  setUploadSuccess(false);
                  setShowDeleteConfirm(true);
                }}
                disabled={isUploadingImage || isDeletingImage}
                className="absolute -bottom-2 -right-2 w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 disabled:opacity-50 shadow-lg border-2 border-spotify-black opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: isMobile ? 1.0 : 1.1 }}
                title="Delete profile picture"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none'
                }}
              >
                {isDeletingImage ? (
                  <Upload className="w-6 h-6 animate-spin" />
                ) : (
                  <Trash2 className="w-6 h-6" />
                )}
              </motion.button>
            )}
            
            {/* Hidden file input with mobile optimization */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
              multiple={false}
              style={{ display: 'none', position: 'absolute', left: '-9999px' }}
              onFocus={() => console.log('🔄 File input focused')}
              onBlur={() => console.log('🔄 File input blurred')}
            />
            
            {/* Debug info for mobile (only show in development) */}
            {isMobile && debugInfo && process.env.NODE_ENV === 'development' && (
              <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs max-w-xs truncate z-20">
                {debugInfo}
              </div>
            )}
            
            {/* Upload/Delete Status Messages - Toast Style */}
            {(uploadProgress || uploadError) && (
              <motion.div 
                className="fixed top-4 left-4 right-4 z-50 flex justify-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {uploadProgress && (
                  <div className="bg-spotify-green text-black px-6 py-4 rounded-lg text-sm font-medium shadow-xl max-w-xs w-full text-center">
                    {uploadProgress}
                  </div>
                )}
                {uploadError && (
                  <div className="bg-red-600 text-white px-6 py-4 rounded-lg text-sm font-medium shadow-xl max-w-xs w-full text-center">
                    {uploadError}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
          
          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <motion.div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div 
                className="bg-spotify-gray rounded-lg p-6 max-w-sm w-full mx-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">Delete Profile Picture</h3>
                    <p className="text-spotify-light-gray text-sm">This action cannot be undone</p>
                  </div>
                </div>
                
                <p className="text-spotify-light-gray text-sm mb-6">
                  Are you sure you want to delete your profile picture? Your profile will revert to the default placeholder.
                </p>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-spotify-dark text-white py-2 px-4 rounded-lg hover:bg-spotify-black transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteProfileImage}
                    disabled={isDeletingImage}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeletingImage ? (
                      <>
                        <Upload className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {/* Profile Details */}
          <div className="text-center flex-1 mt-6">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">{userData.name}</h1>
            <div className="flex justify-center items-center gap-6 md:gap-8">
              <motion.button 
                className="transition-all duration-200 hover:scale-105 cursor-pointer"
                whileTap={{ scale: 0.95 }}
                onClick={handleFollowersClick}
                disabled={isLoadingStats}
              >
                <span className="text-white font-bold text-lg">
                  {isLoadingStats ? '...' : formatFollowers(userData.followers)}
                </span>
                <span className="text-spotify-light-gray text-sm ml-1 hover:underline">followers</span>
              </motion.button>
              
              <motion.button 
                className="transition-all duration-200 hover:scale-105 cursor-pointer"
                whileTap={{ scale: 0.95 }}
                onClick={handleFollowingClick}
                disabled={isLoadingStats}
              >
                <span className="text-white font-bold text-lg">
                  {isLoadingStats ? '...' : userData.following}
                </span>
                <span className="text-spotify-light-gray text-sm ml-1 hover:underline">following</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Playlists */}
      <motion.div 
        className="px-6 mb-8"
        variants={itemVariants}
      >
        <h3 className="text-xl font-bold text-white mb-4">Made for you</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {userData.playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              className="bg-spotify-gray rounded-lg overflow-hidden cursor-pointer group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="relative">
                <img 
                  src={playlist.image} 
                  alt={playlist.name}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <Music className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </div>
              <div className="p-4">
                <h4 className="text-white font-medium text-sm truncate mb-1">{playlist.name}</h4>
                <p className="text-spotify-light-gray text-xs truncate">
                  {playlist.tracks ? playlist.tracks.length : 0} songs • By {playlist.createdBy}
                </p>
              </div>
            </motion.div>
          ))}
          
          {/* Create Playlist */}
          <motion.div
            className="bg-spotify-gray rounded-lg cursor-pointer flex flex-col items-center justify-center p-6 min-h-[200px] group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="w-16 h-16 bg-spotify-light-gray rounded-full flex items-center justify-center mb-4 group-hover:bg-white transition-colors">
              <span className="text-spotify-black text-2xl font-bold">+</span>
            </div>
            <h4 className="text-spotify-light-gray font-medium text-sm text-center group-hover:text-white transition-colors">Create Playlist</h4>
          </motion.div>
        </div>
      </motion.div>

      {/* Recently Played */}
      <motion.div 
        className="px-6 mb-8"
        variants={itemVariants}
      >
        <h3 className="text-xl font-bold text-white mb-4">Recently Played</h3>
        <div className="space-y-2">
          {userData.recentlyPlayed.slice(0, 5).map((track, index) => (
            <motion.div
              key={track.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-spotify-gray transition-colors cursor-pointer"
              whileHover={{ backgroundColor: 'rgba(40, 40, 40, 0.5)' }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center flex-1">
                <img 
                  src={track.image} 
                  alt={track.title}
                  className="w-12 h-12 object-cover rounded-md mr-3"
                />
                <div className="flex-1">
                  <h4 className="text-white font-medium text-sm truncate">{track.title}</h4>
                  <p className="text-spotify-light-gray text-xs truncate">{track.artist}</p>
                </div>
              </div>
              <div className="text-spotify-light-gray text-xs hidden md:block">
                {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Top Songs This Month */}
      <motion.div 
        className="px-6 pb-8"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Top Songs This Month</h3>
          <Calendar className="w-5 h-5 text-spotify-light-gray" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {sampleTracks.slice(0, 6).map((track, index) => (
            <motion.div
              key={track.id}
              className="bg-spotify-gray rounded-lg overflow-hidden cursor-pointer group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="relative">
                <img 
                  src={track.image} 
                  alt={track.title}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <Music className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </div>
              <div className="p-3">
                <h4 className="text-white font-medium text-xs truncate mb-1">{track.title}</h4>
                <p className="text-spotify-light-gray text-xs truncate">{track.artist}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Profile;