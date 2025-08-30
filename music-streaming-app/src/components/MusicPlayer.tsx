import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMusicPlayer } from '../App';
import { useUser } from '../contexts/UserContext';
import OptimizedImage from './OptimizedImage';
import ImageService from '../lib/imageService';

interface Track {
  id: string;
  name: string;
  artist: string;
  image: string;
  duration: number; // in seconds
}

interface MusicPlayerProps {
  // These props are kept for compatibility but we'll use context for real data
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

const MusicPlayer = ({ 
  currentTrack, 
  isPlaying: _isPlaying, // Keep prop for compatibility but don't use it
  onPlayPause: _onPlayPause, // Keep prop for compatibility but don't use it
  onNext: _onNext, 
  onPrevious: _onPrevious
}: MusicPlayerProps) => {
  // Use the real audio context for accurate state
  const audioContext = useMusicPlayer();
  const { likedSongs, toggleLikedSong, isAuthenticated } = useUser();
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, color: string, shape: string, icon: string}>>([]);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [volumeSliderRef, setVolumeSliderRef] = useState<HTMLInputElement | null>(null);
  const [previousVolume, setPreviousVolume] = useState(0.5); // Store previous volume for unmute
  const [showMobileVolumeSlider, setShowMobileVolumeSlider] = useState(false); // Mobile volume slider visibility

  // Check if current track is liked
  const isLiked = currentTrack ? likedSongs.includes(currentTrack.id) : false;

  // Preload next and previous track images for smooth transitions
  useEffect(() => {
    if (audioContext.queue && audioContext.queue.length > 1) {
      const imageService = ImageService.getInstance();
      const currentIndex = audioContext.currentIndex;
      const nextIndex = (currentIndex + 1) % audioContext.queue.length;
      const prevIndex = currentIndex === 0 ? audioContext.queue.length - 1 : currentIndex - 1;
      
      // Preload next and previous track images
      const imagesToPreload = [];
      
      if (audioContext.queue[nextIndex]) {
        imagesToPreload.push(audioContext.queue[nextIndex].image);
      }
      
      if (audioContext.queue[prevIndex]) {
        imagesToPreload.push(audioContext.queue[prevIndex].image);
      }
      
      // Preload up to 3 upcoming tracks for better UX
      for (let i = 1; i <= 3; i++) {
        const upcomingIndex = (currentIndex + i) % audioContext.queue.length;
        if (audioContext.queue[upcomingIndex] && upcomingIndex !== currentIndex) {
          imagesToPreload.push(audioContext.queue[upcomingIndex].image);
        }
      }
      
      // Use ImageService to preload optimized images
      imageService.preloadImages(imagesToPreload, false).catch(console.warn);
    }
  }, [audioContext.currentIndex, audioContext.queue]);

  // Toggle mute functionality
  const toggleMute = () => {
    if (audioContext.volume === 0) {
      // Unmute: restore previous volume or default to 0.5
      audioContext.setVolume(previousVolume > 0 ? previousVolume : 0.5);
    } else {
      // Mute: store current volume and set to 0
      setPreviousVolume(audioContext.volume);
      audioContext.setVolume(0);
    }
  };

  // Use real audio progress from context
  const currentTime = Math.floor(audioContext.currentTime);
  const duration = Math.floor(audioContext.duration) || (currentTrack?.duration || 0);

  // Update volume slider CSS custom property when volume changes
  useEffect(() => {
    if (volumeSliderRef) {
      const volumePercent = Math.round(audioContext.volume * 100);
      volumeSliderRef.style.setProperty('--val', volumePercent + '%');
    }
  }, [audioContext.volume, volumeSliderRef]);

  // Tooltip hover logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (hoveredElement) {
      timeout = setTimeout(() => {
        setShowTooltip(hoveredElement);
      }, 2000); // 2 seconds delay
    } else {
      setShowTooltip(null);
    }
    return () => clearTimeout(timeout);
  }, [hoveredElement]);

  const handleMouseEnter = (elementName: string) => {
    setHoveredElement(elementName);
    
    // Special handling for volume slider hover
    if (elementName === 'volume-slider') {
      // No delay for volume slider tooltip
      setShowTooltip(elementName);
    }
  };

  const handleMouseLeave = () => {
    setHoveredElement(null);
    setShowTooltip(null);
  };

  // Add volume slider specific hover handlers
  const handleVolumeSliderEnter = () => {
    setHoveredElement('volume-slider');
    setShowTooltip('volume-slider');
  };

  const handleVolumeSliderLeave = () => {
    setHoveredElement(null);
    setShowTooltip(null);
  };

  // Remove the old simulation effect since we're using real audio now
  // The real audio progress comes from the audioContext

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const newTime = Math.floor(percentage * duration);
    // Use the real audio seek function
    audioContext.seek(newTime);
  };

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-20 left-0 right-0 bg-spotify-dark border-t border-spotify-gray px-4 py-3 z-50"
      >
        {/* Mobile Layout (< 768px) */}
        <div className="md:hidden w-full block">
          {/* Top Row - Song Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center flex-1 min-w-0">
              <OptimizedImage
                src={currentTrack.image}
                alt={currentTrack.name}
                className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                priority={true}
              />
              <div className="ml-3 min-w-0 flex-1">
                <h4 className="text-white text-sm font-medium truncate">
                  {currentTrack.name}
                </h4>
                <p className="text-spotify-light-gray text-xs truncate">
                  {currentTrack.artist}
                </p>
              </div>
            </div>
            <motion.button
              onClick={async () => {
                if (!currentTrack || !isAuthenticated) {
                  console.warn('Cannot toggle liked song: No track selected or user not authenticated');
                  return;
                }
                
                try {
                  const isCurrentlyLiked = likedSongs.includes(currentTrack.id);
                  
                  // Start animation immediately for favoriting (optimistic UI)
                  if (!isCurrentlyLiked) {
                    // Create limited particles with proper burst pattern
                    const newParticles = [];
                    const colors = ['#1DB954', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#DDA0DD'];
                    const shapes = ['star', 'heart', 'sparkle', 'circle'];
                    
                    for (let i = 0; i < 8; i++) { // Limited to 8 particles
                    // Ensure particles spread evenly in a circle
                    const angle = (i / 8) * 360 + (Math.random() * 45 - 22.5); // Even spread with slight randomness
                    const radius = Math.random() * 15 + 25; // 25-40px ensures they clear the heart
                    const x = Math.cos(angle * (Math.PI / 180)) * radius;
                    const y = Math.sin(angle * (Math.PI / 180)) * radius;
                    
                    newParticles.push({
                      id: i,
                      x: x,
                      y: y,
                      color: colors[Math.floor(Math.random() * colors.length)],
                      shape: shapes[Math.floor(Math.random() * shapes.length)],
                      icon: ''
                    });
                  }
                  
                  setParticles(newParticles);
                  
                  // Clean up particles after animation
                  setTimeout(() => {
                    setParticles([]);
                  }, 800);
                  }
                  
                  // Now perform the actual Firebase operation
                  await toggleLikedSong(currentTrack.id);
                } catch (error) {
                  console.error('Error toggling liked song:', error);
                }
              }}
              className="flex-shrink-0 p-2 relative overflow-visible"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.1 }}
            >
              {/* Heart SVG with beat animation */}
              <motion.div
                className="relative w-[20px] h-[20px]"
                animate={{
                  scale: isLiked && particles.length > 0 ? [1, 1.3, 1] : 1
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.175, 0.885, 0.32, 1.275]
                }}
              >
                <svg 
                  viewBox="0 0 24 24" 
                  className={`w-[20px] h-[20px] transition-all duration-300 ${
                    isLiked 
                      ? 'fill-spotify-green stroke-spotify-green' 
                      : 'fill-transparent stroke-spotify-light-gray stroke-2 hover:stroke-white'
                  }`}
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </motion.div>
              
              {/* Limited magical particles that burst away from heart */}
              {particles.map((particle) => (
                <motion.div
                  key={particle.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    color: particle.color,
                    zIndex: 1
                  }}
                  initial={{
                    scale: 0,
                    x: 0,
                    y: 0,
                    opacity: 1,
                    rotate: 0
                  }}
                  animate={{
                    scale: [0, 1.5, 1],
                    x: particle.x,
                    y: particle.y,
                    opacity: [1, 1, 0],
                    rotate: [0, 180, 360]
                  }}
                  transition={{
                    duration: 1,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                >
                  {particle.shape === 'circle' && (
                    <div 
                      className="w-1.5 h-1.5 rounded-full" 
                      style={{ 
                        backgroundColor: particle.color,
                        boxShadow: `0 0 6px ${particle.color}40`
                      }}
                    />
                  )}
                  {particle.shape === 'star' && (
                    <span style={{ 
                      color: particle.color, 
                      textShadow: `0 0 4px ${particle.color}`,
                      filter: 'brightness(1.2)'
                    }}>★</span>
                  )}
                  {particle.shape === 'heart' && (
                    <span style={{ 
                      color: particle.color, 
                      textShadow: `0 0 4px ${particle.color}`,
                      filter: 'brightness(1.1)'
                    }}>♥</span>
                  )}
                  {particle.shape === 'sparkle' && (
                    <span style={{ 
                      color: particle.color, 
                      textShadow: `0 0 6px ${particle.color}`,
                      filter: 'brightness(1.3)'
                    }}>✨</span>
                  )}
                </motion.div>
              ))}
            </motion.button>
          </div>
          
          {/* Middle Row - Control Buttons */}
          <div className="flex items-center justify-center gap-4 mb-3">
            {/* Volume Control */}
            <div className="relative">
              <motion.button
                onClick={toggleMute}
                onTouchStart={() => {
                  // Long press detection for mobile
                  const longPressTimer = setTimeout(() => {
                    setShowMobileVolumeSlider(true);
                  }, 500); // 500ms long press
                  
                  // Store timer to clear it if touch ends early
                  (window as any).volumeLongPressTimer = longPressTimer;
                }}
                onTouchEnd={() => {
                  // Clear long press timer if touch ends early
                  if ((window as any).volumeLongPressTimer) {
                    clearTimeout((window as any).volumeLongPressTimer);
                  }
                }}
                className={`transition-colors ${
                  audioContext.volume === 0 
                    ? 'text-spotify-light-gray hover:text-white' 
                    : 'text-white hover:text-spotify-green'
                }`}
                whileTap={{ scale: 0.9 }}
              >
                {audioContext.volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </motion.button>
              
              {/* Mobile Volume Slider Popup */}
              <AnimatePresence>
                {showMobileVolumeSlider && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-spotify-dark border border-spotify-gray rounded-lg p-4 z-50 shadow-xl"
                    onTouchMove={(e) => e.stopPropagation()} // Prevent page scrolling
                    onTouchStart={(e) => e.stopPropagation()} // Prevent page scrolling
                    onTouchEnd={(e) => e.stopPropagation()} // Prevent page scrolling
                  >
                    {/* Header with title and close button */}
                    <div className="flex justify-between items-start mb-3 relative min-h-[24px]">
                      <span className="text-white text-sm font-medium pt-1 pr-8">Volume</span>
                      <motion.button
                        onClick={() => setShowMobileVolumeSlider(false)}
                        className="text-spotify-light-gray hover:text-white text-xl font-bold absolute top-0 right-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-spotify-gray"
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                      >
                        ×
                      </motion.button>
                    </div>
                    
                    {/* Vertical Volume Slider */}
                    <div className="flex flex-col items-center">
                      <div 
                        className="h-32 w-6 bg-spotify-gray rounded-full relative mb-2 touch-none"
                        onTouchMove={(e) => {
                          e.preventDefault(); // Prevent page scrolling
                          e.stopPropagation();
                          
                          const rect = e.currentTarget.getBoundingClientRect();
                          const touch = e.touches[0];
                          const y = touch.clientY - rect.top;
                          const height = rect.height;
                          
                          // Calculate volume (inverted because top = 100%, bottom = 0%)
                          const volume = Math.max(0, Math.min(1, 1 - (y / height)));
                          audioContext.setVolume(volume);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={audioContext.volume}
                          onChange={(e) => audioContext.setVolume(parseFloat(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer vertical-slider touch-none"
                          style={{
                            transform: 'rotate(-90deg)',
                            transformOrigin: 'center',
                            width: '128px',
                            height: '24px',
                            left: '-52px',
                            top: '52px',
                            pointerEvents: 'none' // Disable pointer events to use touch events instead
                          }}
                        />
                        {/* Visual slider track */}
                        <div 
                          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 bg-spotify-green rounded-full transition-all duration-150"
                          style={{ height: `${audioContext.volume * 100}%` }}
                        />
                        {/* Slider thumb */}
                        <div 
                          className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white rounded-full border-2 border-spotify-green transition-all duration-150 shadow-lg"
                          style={{ bottom: `${audioContext.volume * 100}%`, marginBottom: '-8px' }}
                        />
                      </div>
                      
                      {/* Volume percentage */}
                      <span className="text-spotify-light-gray text-xs">
                        {Math.round(audioContext.volume * 100)}%
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Background overlay to close slider */}
              <AnimatePresence>
                {showMobileVolumeSlider && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowMobileVolumeSlider(false)}
                    onTouchStart={() => setShowMobileVolumeSlider(false)}
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 touch-none"
                  />
                )}
              </AnimatePresence>
            </div>
            
            <motion.button
              onClick={audioContext.previousTrack}
              className={`transition-colors ${
                audioContext.queue.length > 1 && !audioContext.isTrackChanging
                  ? 'text-white hover:text-spotify-green cursor-pointer' 
                  : 'text-spotify-light-gray cursor-default'
              }`}
              whileTap={{ scale: audioContext.queue.length > 1 && !audioContext.isTrackChanging ? 0.9 : 1 }}
              disabled={audioContext.queue.length <= 1 || audioContext.isTrackChanging}
            >
              <SkipBack className="w-6 h-6" />
            </motion.button>
            
            <motion.button
              onClick={() => audioContext.togglePlayPause()}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              whileTap={{ scale: 0.95 }}
            >
              {audioContext.isPlaying ? (
                <Pause className="w-5 h-5 text-black" />
              ) : (
                <Play className="w-5 h-5 text-black" fill="currentColor" />
              )}
            </motion.button>
            
            <motion.button
              onClick={audioContext.nextTrack}
              className={`transition-colors ${
                audioContext.queue.length > 1 && !audioContext.isTrackChanging
                  ? 'text-white hover:text-spotify-green cursor-pointer' 
                  : 'text-spotify-light-gray cursor-default'
              }`}
              whileTap={{ scale: audioContext.queue.length > 1 && !audioContext.isTrackChanging ? 0.9 : 1 }}
              disabled={audioContext.queue.length <= 1 || audioContext.isTrackChanging}
            >
              <SkipForward className="w-6 h-6" />
            </motion.button>
            
            <motion.button
              onClick={audioContext.toggleRepeat}
              className={`transition-colors ${
                audioContext.isRepeat 
                  ? 'text-spotify-green' 
                  : 'text-spotify-light-gray hover:text-white'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <div className="relative">
                {/* Background circle when repeat is active */}
                <AnimatePresence>
                  {audioContext.isRepeat && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.2 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 bg-spotify-green rounded-full"
                      style={{
                        width: '24px',
                        height: '24px',
                        left: '-4px',
                        top: '-4px'
                      }}
                    />
                  )}
                </AnimatePresence>
                <Repeat className="w-5 h-5 relative z-10" />
              </div>
            </motion.button>
          </div>
          
          {/* Bottom Row - Progress Bar */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs text-spotify-light-gray min-w-[35px]">
              {formatTime(currentTime)}
            </span>
            <div 
              className="flex-1 h-1 bg-spotify-gray rounded-full cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-spotify-green rounded-full relative"
                style={{ 
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` 
                }}
              >
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-xs text-spotify-light-gray min-w-[35px]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Desktop Layout (≥ 768px) */}
        <div className="hidden md:flex items-center justify-between max-w-full">
          {/* Left - Song Info */}
          <div className="flex items-center flex-shrink-0 min-w-0 w-80 ml-8">
            <OptimizedImage
              src={currentTrack.image}
              alt={currentTrack.name}
              className="w-14 h-14 rounded-md object-cover flex-shrink-0"
              priority={true}
            />
            <div className="ml-4 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-white text-sm font-medium truncate">
                  {currentTrack.name}
                </h4>
                <motion.button
                  onClick={async () => {
                    if (!currentTrack || !isAuthenticated) {
                      console.warn('Cannot toggle liked song: No track selected or user not authenticated');
                      return;
                    }
                    
                    try {
                      const isCurrentlyLiked = likedSongs.includes(currentTrack.id);
                      
                      // Start animation immediately for favoriting (optimistic UI)
                      if (!isCurrentlyLiked) {
                        // Create limited particles with proper burst pattern
                        const newParticles = [];
                        const colors = ['#1DB954', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#DDA0DD'];
                        const shapes = ['star', 'heart', 'sparkle', 'circle'];
                        
                        for (let i = 0; i < 8; i++) { // Limited to 8 particles
                        // Ensure particles spread evenly in a circle
                        const angle = (i / 8) * 360 + (Math.random() * 45 - 22.5); // Even spread with slight randomness
                        const radius = Math.random() * 15 + 25; // 25-40px ensures they clear the heart
                        const x = Math.cos(angle * (Math.PI / 180)) * radius;
                        const y = Math.sin(angle * (Math.PI / 180)) * radius;
                        
                        newParticles.push({
                          id: i,
                          x: x,
                          y: y,
                          color: colors[Math.floor(Math.random() * colors.length)],
                          shape: shapes[Math.floor(Math.random() * shapes.length)],
                          icon: ''
                        });
                      }
                      
                      setParticles(newParticles);
                      
                      // Clean up particles after animation
                      setTimeout(() => {
                        setParticles([]);
                      }, 800);
                    }
                    
                    // Now perform the actual Firebase operation
                    await toggleLikedSong(currentTrack.id);
                  } catch (error) {
                    console.error('Error toggling liked song:', error);
                  }
                }}
                  className="flex-shrink-0 p-1 relative overflow-visible"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.1 }}
                >
                  {/* Heart SVG with beat animation */}
                  <motion.div
                    className="relative w-[18px] h-[18px]"
                    animate={{
                      scale: isLiked && particles.length > 0 ? [1, 1.3, 1] : 1
                    }}
                    transition={{
                      duration: 0.6,
                      ease: [0.175, 0.885, 0.32, 1.275]
                    }}
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      className={`w-[18px] h-[18px] transition-all duration-300 ${
                        isLiked 
                          ? 'fill-spotify-green stroke-spotify-green' 
                          : 'fill-transparent stroke-spotify-light-gray stroke-2 hover:stroke-white'
                      }`}
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </motion.div>
                  
                  {/* Limited magical particles that burst away from heart */}
                  {particles.map((particle) => (
                    <motion.div
                      key={particle.id}
                      className="absolute pointer-events-none select-none"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px',
                        color: particle.color,
                        zIndex: 1
                      }}
                      initial={{
                        scale: 0,
                        x: 0,
                        y: 0,
                        opacity: 1,
                        rotate: 0
                      }}
                      animate={{
                        scale: [0, 1.5, 1],
                        x: particle.x,
                        y: particle.y,
                        opacity: [1, 1, 0],
                        rotate: [0, 180, 360]
                      }}
                      transition={{
                        duration: 1,
                        ease: [0.25, 0.46, 0.45, 0.94]
                      }}
                    >
                      {particle.shape === 'circle' && (
                        <div 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ 
                            backgroundColor: particle.color,
                            boxShadow: `0 0 6px ${particle.color}40`
                          }}
                        />
                      )}
                      {particle.shape === 'star' && (
                        <span style={{ 
                          color: particle.color, 
                          textShadow: `0 0 4px ${particle.color}`,
                          filter: 'brightness(1.2)'
                        }}>★</span>
                      )}
                      {particle.shape === 'heart' && (
                        <span style={{ 
                          color: particle.color, 
                          textShadow: `0 0 4px ${particle.color}`,
                          filter: 'brightness(1.1)'
                        }}>♥</span>
                      )}
                      {particle.shape === 'sparkle' && (
                        <span style={{ 
                          color: particle.color, 
                          textShadow: `0 0 6px ${particle.color}`,
                          filter: 'brightness(1.3)'
                        }}>✨</span>
                      )}
                    </motion.div>
                  ))}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Center - Controls and Progress */}
          <div className="flex flex-col items-center flex-1 max-w-md mx-4">
            {/* Control Buttons */}
            <div className="flex items-center gap-4 mb-2">
              <motion.button
                onClick={() => {}}
                className="text-spotify-light-gray hover:text-white transition-colors relative"
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => handleMouseEnter('shuffle')}
                onMouseLeave={handleMouseLeave}
              >
                <Shuffle className="w-4 h-4" />
                {showTooltip === 'shuffle' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.8, y: 0 }}
                    className="absolute pointer-events-none"
                    style={{
                      top: '-32px',
                      left: '0',
                      right: '0',
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="bg-spotify-gray text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Shuffle
                    </div>
                  </motion.div>
                )}
              </motion.button>
              
              <motion.button
                onClick={audioContext.previousTrack}
                className={`transition-colors relative ${
                  audioContext.queue.length > 1 && !audioContext.isTrackChanging
                    ? 'text-white hover:text-spotify-green cursor-pointer' 
                    : 'text-spotify-light-gray cursor-default'
                }`}
                whileTap={{ scale: audioContext.queue.length > 1 && !audioContext.isTrackChanging ? 0.9 : 1 }}
                onMouseEnter={() => handleMouseEnter('previous')}
                onMouseLeave={handleMouseLeave}
                disabled={audioContext.queue.length <= 1 || audioContext.isTrackChanging}
              >
                <SkipBack className="w-5 h-5" />
                {showTooltip === 'previous' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.8, y: 0 }}
                    className="absolute pointer-events-none"
                    style={{
                      top: '-32px',
                      left: '0',
                      right: '0',
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="bg-spotify-gray text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {audioContext.queue.length > 1 ? `Previous (${audioContext.currentIndex > 0 ? audioContext.queue[audioContext.currentIndex - 1]?.name || 'Track' : audioContext.queue[audioContext.queue.length - 1]?.name || 'Last Track'})` : 'No previous track'}
                    </div>
                  </motion.div>
                )}
              </motion.button>
              
              <motion.button
                onClick={() => audioContext.togglePlayPause()}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform relative"
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => handleMouseEnter('play')}
                onMouseLeave={handleMouseLeave}
              >
                {audioContext.isPlaying ? (
                  <Pause className="w-4 h-4 text-black" />
                ) : (
                  <Play className="w-4 h-4 text-black" fill="currentColor" />
                )}
                {showTooltip === 'play' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.8, y: 0 }}
                    className="absolute pointer-events-none"
                    style={{
                      top: '-40px',
                      left: '0',
                      right: '0',
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="bg-spotify-gray text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {audioContext.isPlaying ? 'Pause' : 'Play'}
                    </div>
                  </motion.div>
                )}
              </motion.button>
              
              <motion.button
                onClick={audioContext.nextTrack}
                className={`transition-colors relative ${
                  audioContext.queue.length > 1 && !audioContext.isTrackChanging
                    ? 'text-white hover:text-spotify-green cursor-pointer' 
                    : 'text-spotify-light-gray cursor-default'
                }`}
                whileTap={{ scale: audioContext.queue.length > 1 && !audioContext.isTrackChanging ? 0.9 : 1 }}
                onMouseEnter={() => handleMouseEnter('next')}
                onMouseLeave={handleMouseLeave}
                disabled={audioContext.queue.length <= 1 || audioContext.isTrackChanging}
              >
                <SkipForward className="w-5 h-5" />
                {showTooltip === 'next' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.8, y: 0 }}
                    className="absolute pointer-events-none"
                    style={{
                      top: '-32px',
                      left: '0',
                      right: '0',
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="bg-spotify-gray text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {audioContext.queue.length > 1 ? `Next (${audioContext.currentIndex < audioContext.queue.length - 1 ? audioContext.queue[audioContext.currentIndex + 1]?.name || 'Track' : audioContext.queue[0]?.name || 'First Track'})` : 'No next track'}
                    </div>
                  </motion.div>
                )}
              </motion.button>
              
              <motion.button
                onClick={audioContext.toggleRepeat}
                className={`transition-colors relative ${
                  audioContext.isRepeat 
                    ? 'text-spotify-green' 
                    : 'text-spotify-light-gray hover:text-white'
                }`}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => handleMouseEnter('repeat')}
                onMouseLeave={handleMouseLeave}
              >
                <div className="relative">
                  {/* Background circle when repeat is active */}
                  <AnimatePresence>
                    {audioContext.isRepeat && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.2 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-spotify-green rounded-full"
                        style={{
                          width: '24px',
                          height: '24px',
                          left: '-4px',
                          top: '-4px'
                        }}
                      />
                    )}
                  </AnimatePresence>
                  <Repeat className="w-4 h-4 relative z-10" />
                </div>
                {showTooltip === 'repeat' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.8, y: 0 }}
                    className="absolute pointer-events-none"
                    style={{
                      top: '-32px',
                      left: '0',
                      right: '0',
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="bg-spotify-gray text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {audioContext.isRepeat ? 'Repeat: On' : 'Repeat: Off'}
                    </div>
                  </motion.div>
                )}
              </motion.button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-spotify-light-gray min-w-[35px]">
                {formatTime(currentTime)}
              </span>
              <div 
                className="flex-1 h-1 bg-spotify-gray rounded-full cursor-pointer relative"
                onClick={handleProgressClick}
              >
                <div 
                  className="h-full bg-spotify-green rounded-full relative"
                  style={{ 
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` 
                  }}
                >
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <span className="text-xs text-spotify-light-gray min-w-[35px]">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Right - Redesigned Spotify-Style Volume Slider with Icon */}
          <div className="flex items-center gap-3 flex-shrink-0 w-36 min-w-[144px] md:w-40 md:min-w-[160px]">
            {/* Volume Icon with Smart Mute Detection */}
            <motion.div
              className="relative flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // Toggle mute/unmute
                if (audioContext.volume > 0) {
                  audioContext.setVolume(0);
                } else {
                  audioContext.setVolume(0.5); // Set to 50% when unmuting
                }
              }}
            >
              <motion.div
                animate={{
                  scale: audioContext.volume === 0 ? 0.9 : 1,
                  color: audioContext.volume === 0 ? "#6B7280" : "#9CA3AF"
                }}
                whileHover={{
                  color: "#FFFFFF",
                  scale: 1.1
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 25 
                }}
                className="cursor-pointer"
              >
                {audioContext.volume === 0 ? (
                  <VolumeX className="w-4 h-4 md:w-5 md:h-5 transition-all duration-200" />
                ) : (
                  <Volume2 className="w-4 h-4 md:w-5 md:h-5 transition-all duration-200" />
                )}
              </motion.div>
            </motion.div>
            
            {/* Native Range Slider - Exact Copy of Perfect Example */}
            <div 
              className="flex-1 relative"
              onMouseEnter={handleVolumeSliderEnter}
              onMouseLeave={handleVolumeSliderLeave}
            >
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(audioContext.volume * 100)}
                onChange={(e) => {
                  const newVolume = parseInt(e.target.value) / 100;
                  audioContext.setVolume(newVolume);
                  // Update CSS custom property like the perfect example
                  e.target.style.setProperty('--val', e.target.value + '%');
                }}
                ref={(input) => {
                  setVolumeSliderRef(input);
                  if (input) {
                    // Set initial CSS custom property
                    input.style.setProperty('--val', Math.round(audioContext.volume * 100) + '%');
                  }
                }}
                className="volume-slider w-full"
              />
              
              {/* Volume Percentage Tooltip */}
              <AnimatePresence>
                {showTooltip === 'volume-slider' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute pointer-events-none z-30"
                    style={{
                      top: '-45px',
                      left: `${Math.max(15, Math.min(65, audioContext.volume * 100))}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <motion.div 
                      className="bg-black border border-green-500 text-white text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap backdrop-blur-sm"
                      animate={{
                        backgroundColor: audioContext.volume === 0 ? "#2d3748" : "#000000",
                        borderColor: audioContext.volume === 0 ? "#718096" : "#1db954"
                      }}
                      style={{
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)"
                      }}
                    >
                      <motion.span 
                        className="font-bold"
                        animate={{
                          color: audioContext.volume === 0 ? "#a0aec0" : "#1db954"
                        }}
                      >
                        {Math.round(audioContext.volume * 100)}%
                      </motion.span>
                      {audioContext.volume === 0 && (
                        <span className="ml-1 text-gray-400">Muted</span>
                      )}
                      <div 
                        className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent"
                        style={{
                          borderTopColor: audioContext.volume === 0 ? "#718096" : "#1db954"
                        }}
                      />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MusicPlayer;