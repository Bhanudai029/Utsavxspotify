import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import BottomNavigation from './components/BottomNavigation';
import MusicPlayer from './components/MusicPlayer';
import { UserProvider } from './contexts/UserContext';
import { sampleTracks } from './data';
import ImagePreloader from './lib/imagePreloader';
import Home from './pages/Home';
import Friends from './pages/Friends';
import Music from './pages/Music';
import Profile from './pages/Profile';
import AllSongs from './pages/AllSongs';
import LikedSongs from './pages/LikedSongs';
import AdminDashboard from './pages/AdminDashboard';
import Followers from './pages/Followers';
import Following from './pages/Following';
import FriendsTest from './pages/FriendsTest';

// Track interface
interface Track {
  id: string;
  name: string;
  artist: string;
  image: string;
  duration: number;
  audioUrl?: string;
}

interface MusicContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Track[];
  currentIndex: number;
  isRepeat: boolean;
  isTrackChanging: boolean;
  playTrack: (track: Track) => void;
  playTrackWithCustomQueue: (track: Track, customQueue: Track[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleRepeat: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusicPlayer = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusicPlayer must be used within a MusicProvider');
  }
  return context;
};

// AuthenticatedApp component - contains the main app logic
const AuthenticatedApp = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isRepeat, setIsRepeat] = useState(false);
  const [sessionPlayHistory, setSessionPlayHistory] = useState<string[]>([]); // Track play history
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create default queue from all available tracks (30+ songs)
  const defaultQueue: Track[] = sampleTracks.map(track => ({
    id: track.id,
    name: track.title,
    artist: track.artist,
    image: track.image,
    duration: track.duration,
    audioUrl: track.audioUrl
  }));

  // Initialize audio element
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    audioRef.current.addEventListener('timeupdate', () => {
      setCurrentTime(audioRef.current?.currentTime || 0);
    });
    audioRef.current.addEventListener('loadedmetadata', () => {
      setDuration(audioRef.current?.duration || 0);
    });
  }

  // Initialize queue on app start
  useEffect(() => {
    if (queue.length === 0 && defaultQueue.length > 0) {
      setQueue(defaultQueue);
      console.log('Initialized queue with', defaultQueue.length, 'tracks');
    }
  }, []);

  // Add event listeners to prevent text selection and dragging
  useEffect(() => {
    const preventSelection = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventDragStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners to document
    document.addEventListener('selectstart', preventSelection);
    document.addEventListener('dragstart', preventDragStart);
    document.addEventListener('contextmenu', preventContextMenu);

    // Cleanup event listeners on unmount
    return () => {
      document.removeEventListener('selectstart', preventSelection);
      document.removeEventListener('dragstart', preventDragStart);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);

  // Preload critical images for better user experience
  useEffect(() => {
    const initializeImagePreloader = async () => {
      const preloader = ImagePreloader.getInstance();
      
      // Start preloading critical images after app initialization
      setTimeout(async () => {
        try {
          await preloader.preloadCriticalImages();
          console.log('Image preloader initialized successfully');
          console.log('Preload stats:', preloader.getStats());
        } catch (error) {
          console.warn('Image preloader initialization failed:', error);
        }
      }, 800); // Delay to not interfere with initial app load
    };
    
    initializeImagePreloader();
  }, []);

  // Enhanced image preloading system
  useEffect(() => {
    const preloadImages = async () => {
      const currentQueue = queue.length > 0 ? queue : defaultQueue;
      if (currentQueue.length === 0) return;
      
      // Preload current, next 3, and previous 3 track images
      const imagesToPreload = [];
      const currentIdx = currentIndex;
      
      // Add current track image (highest priority)
      if (currentQueue[currentIdx]) {
        imagesToPreload.push({ url: currentQueue[currentIdx].image, priority: 'high' });
      }
      
      // Add next 3 tracks (high priority)
      for (let i = 1; i <= 3; i++) {
        const nextIdx = (currentIdx + i) % currentQueue.length;
        if (currentQueue[nextIdx]) {
          imagesToPreload.push({ url: currentQueue[nextIdx].image, priority: 'high' });
        }
      }
      
      // Add previous 3 tracks (medium priority)
      for (let i = 1; i <= 3; i++) {
        const prevIdx = currentIdx - i < 0 ? currentQueue.length + (currentIdx - i) : currentIdx - i;
        if (currentQueue[prevIdx]) {
          imagesToPreload.push({ url: currentQueue[prevIdx].image, priority: 'medium' });
        }
      }
      
      // Preload all images with priority handling
      const preloadPromises = imagesToPreload.map(({ url, priority }) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Don't fail the whole batch on single image error
          
          // Set loading priority
          if (priority === 'high') {
            img.loading = 'eager';
            img.decoding = 'sync';
          } else {
            img.loading = 'lazy';
            img.decoding = 'async';
          }
          
          img.src = url;
        });
      });
      
      // Wait for high priority images, then continue with medium priority in background
      const highPriorityPromises = preloadPromises.slice(0, 4); // Current + next 3
      await Promise.allSettled(highPriorityPromises);
      
      // Continue with medium priority images in background
      Promise.allSettled(preloadPromises.slice(4));
    };
    
    preloadImages();
  }, [currentIndex, queue, defaultQueue]);

  const playTrack = (track: Track) => {
    if (audioRef.current) {
      // Stop current audio
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Set new track
      setCurrentTrack(track);
      
      // Add to session play history if not already there
      setSessionPlayHistory(prev => {
        if (!prev.includes(track.id)) {
          return [...prev, track.id];
        }
        return prev;
      });
      
      // Always use the default queue (full track list) for consistent behavior
      const fullQueue = defaultQueue;
      
      // Set the full queue if it's not already set or if it's different
      if (queue.length === 0 || queue.length !== fullQueue.length) {
        setQueue(fullQueue);
        console.log('Setting full queue with', fullQueue.length, 'tracks');
      }
      
      // Find the track index in the full queue
      const trackIndex = fullQueue.findIndex(queueTrack => queueTrack.id === track.id);
      if (trackIndex !== -1) {
        // Track found in default queue, use its position
        setCurrentIndex(trackIndex);
        console.log(`Playing track "${track.name}" at position ${trackIndex} of ${fullQueue.length}`);
        console.log('Queue order:', fullQueue.map((t, i) => `${i}: ${t.name}`).join(', '));
      } else {
        // Track not in default queue (custom track), add it to the beginning
        // and shift the default queue
        const newQueue = [track, ...fullQueue];
        setQueue(newQueue);
        setCurrentIndex(0);
        console.log(`Added custom track "${track.name}" to position 0`);
      }
      
      // Use audioUrl directly if available, with better fallback handling
      const audioUrl = track.audioUrl || `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.name)}.mp3`;
      
      console.log('Attempting to play:', track.name);
      console.log('Audio URL:', audioUrl);
      
      // Add error handling for audio loading
      const handleLoadError = () => {
        console.error('Failed to load audio:', audioUrl);
        console.log('Attempting fallback URL...');
        
        // Try alternative URL construction
        const fallbackUrl = `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.artist + ' - ' + track.name)}.mp3`;
        console.log('Fallback URL:', fallbackUrl);
        
        audioRef.current!.src = fallbackUrl;
        audioRef.current!.load();
      };
      
      const handleCanPlay = () => {
        console.log('Audio can play:', track.name);
        audioRef.current!.play().then(() => {
          setIsPlaying(true);
          console.log('Audio started playing successfully:', track.name);
        }).catch((error) => {
          console.error('Error during play():', error);
          setIsPlaying(false);
        });
      };
      
      // Remove existing event listeners
      audioRef.current.removeEventListener('error', handleLoadError);
      audioRef.current.removeEventListener('canplay', handleCanPlay);
      
      // Add new event listeners
      audioRef.current.addEventListener('error', handleLoadError, { once: true });
      audioRef.current.addEventListener('canplay', handleCanPlay, { once: true });
      
      // Set source and load
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  };

  // New function to play track with custom queue (for liked songs, playlists, etc.)
  const playTrackWithCustomQueue = (track: Track, customQueue: Track[]) => {
    if (audioRef.current) {
      // Stop current audio
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Set new track
      setCurrentTrack(track);
      
      // Add to session play history if not already there
      setSessionPlayHistory(prev => {
        if (!prev.includes(track.id)) {
          return [...prev, track.id];
        }
        return prev;
      });
      
      // Set the custom queue (e.g., liked songs only)
      setQueue(customQueue);
      console.log('Setting custom queue with', customQueue.length, 'tracks');
      
      // Find the track index in the custom queue
      const trackIndex = customQueue.findIndex(queueTrack => queueTrack.id === track.id);
      if (trackIndex !== -1) {
        // Track found in custom queue, use its position
        setCurrentIndex(trackIndex);
        console.log(`Playing track "${track.name}" at position ${trackIndex} of ${customQueue.length} in custom queue`);
        console.log('Custom queue order:', customQueue.map((t, i) => `${i + 1}: ${t.name}`).join(', '));
      } else {
        // Track not in custom queue (shouldn't happen), add it to the beginning
        const newQueue = [track, ...customQueue];
        setQueue(newQueue);
        setCurrentIndex(0);
        console.log(`Added track "${track.name}" to position 0 in custom queue`);
      }
      
      // Use audioUrl directly if available, with better fallback handling
      const audioUrl = track.audioUrl || `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.name)}.mp3`;
      
      console.log('Attempting to play with custom queue:', track.name);
      console.log('Audio URL:', audioUrl);
      
      // Add error handling for audio loading
      const handleLoadError = () => {
        console.error('Failed to load audio:', audioUrl);
        console.log('Attempting fallback URL...');
        
        // Try alternative URL construction
        const fallbackUrl = `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.artist + ' - ' + track.name)}.mp3`;
        console.log('Fallback URL:', fallbackUrl);
        
        audioRef.current!.src = fallbackUrl;
        audioRef.current!.load();
      };
      
      const handleCanPlay = () => {
        console.log('Audio can play:', track.name);
        audioRef.current!.play().then(() => {
          setIsPlaying(true);
          console.log('Audio started playing successfully:', track.name);
        }).catch((error) => {
          console.error('Error during play():', error);
          setIsPlaying(false);
        });
      };
      
      // Remove existing event listeners
      audioRef.current.removeEventListener('error', handleLoadError);
      audioRef.current.removeEventListener('canplay', handleCanPlay);
      
      // Add new event listeners
      audioRef.current.addEventListener('error', handleLoadError, { once: true });
      audioRef.current.addEventListener('canplay', handleCanPlay, { once: true });
      
      // Set source and load
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  };

  const togglePlayPause = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        console.log('Audio paused');
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          console.log('Audio resumed playing');
        } catch (error) {
          console.error('Error resuming audio:', error);
          setIsPlaying(false);
          
          // Try to reload the current track if resume fails
          if (currentTrack) {
            console.log('Attempting to reload current track:', currentTrack.name);
            playTrack(currentTrack);
          }
        }
      }
    }
  };

  // Helper function to play track without updating queue
  const playTrackDirectly = useCallback((track: Track) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Only update currentTrack if it's actually different
      if (!currentTrack || currentTrack.id !== track.id) {
        setCurrentTrack(track);
        console.log('Direct play - updating current track to:', track.name);
      }
      
      const audioUrl = track.audioUrl || `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.name)}.mp3`;
      
      console.log('Playing directly:', track.name);
      console.log('Direct play URL:', audioUrl);
      
      // Add error handling for direct play
      const handleDirectLoadError = () => {
        console.error('Failed to load audio for direct play:', audioUrl);
        console.log('Attempting fallback URL for direct play...');
        
        const fallbackUrl = `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.artist + ' - ' + track.name)}.mp3`;
        console.log('Direct play fallback URL:', fallbackUrl);
        
        audioRef.current!.src = fallbackUrl;
        audioRef.current!.load();
      };
      
      const handleDirectCanPlay = () => {
        console.log('Direct play audio can play:', track.name);
        audioRef.current!.play().then(() => {
          setIsPlaying(true);
          console.log('Direct play audio started successfully:', track.name);
        }).catch((error) => {
          console.error('Error during direct play():', error);
          setIsPlaying(false);
        });
      };
      
      // Remove existing event listeners
      audioRef.current.removeEventListener('error', handleDirectLoadError);
      audioRef.current.removeEventListener('canplay', handleDirectCanPlay);
      
      // Add new event listeners
      audioRef.current.addEventListener('error', handleDirectLoadError, { once: true });
      audioRef.current.addEventListener('canplay', handleDirectCanPlay, { once: true });
      
      // Set source and load
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [currentTrack]);

  // Add state for tracking if we're switching tracks to prevent rapid switching
  // Removed: const [isSwitchingTrack, setIsSwitchingTrack] = useState(false);
  const [isTrackChanging, setIsTrackChanging] = useState(false); // Prevent spam clicking

  const nextTrack = useCallback(() => {
    // Prevent spam clicking
    if (isTrackChanging) return;
    
    const currentQueue = queue.length > 0 ? queue : defaultQueue;
    
    if (currentQueue.length === 0) return;
    
    console.log('Next track called - current index:', currentIndex, 'queue length:', currentQueue.length);
    console.log('Current track:', currentTrack?.name);
    
    setIsTrackChanging(true);
    
    let nextIndex = currentIndex + 1;
    
    // Loop back to beginning if at end
    if (nextIndex >= currentQueue.length) {
      nextIndex = 0;
    }
    
    const nextTrackToPlay = currentQueue[nextIndex];
    console.log('Next track to play:', nextTrackToPlay?.name, 'at index:', nextIndex);
    
    if (nextTrackToPlay) {
      // Add to session play history
      setSessionPlayHistory(prev => {
        if (!prev.includes(nextTrackToPlay.id)) {
          return [...prev, nextTrackToPlay.id];
        }
        return prev;
      });
      
      // Preload the image aggressively before switching
      const img = new Image();
      img.onload = () => {
        // Image loaded successfully, now switch track
        setTimeout(() => {
          setCurrentIndex(nextIndex);
          playTrackDirectly(nextTrackToPlay);
          
          // Re-enable clicking after a short delay
          setTimeout(() => {
            setIsTrackChanging(false);
          }, 300);
        }, 200); // Small delay to ensure image is ready
      };
      
      img.onerror = () => {
        // Image failed to load, switch anyway but with longer delay
        setTimeout(() => {
          setCurrentIndex(nextIndex);
          playTrackDirectly(nextTrackToPlay);
          
          setTimeout(() => {
            setIsTrackChanging(false);
          }, 300);
        }, 500);
      };
      
      // Start preloading the image
      img.src = nextTrackToPlay.image;
      
      // Fallback timeout in case image loading hangs
      setTimeout(() => {
        if (isTrackChanging) {
          setCurrentIndex(nextIndex);
          playTrackDirectly(nextTrackToPlay);
          setIsTrackChanging(false);
        }
      }, 1000); // 1 second max wait
    }
  }, [queue, defaultQueue, currentIndex, playTrackDirectly, isTrackChanging, sessionPlayHistory]);

  const previousTrack = useCallback(() => {
    // Prevent spam clicking
    if (isTrackChanging) return;
    
    const currentQueue = queue.length > 0 ? queue : defaultQueue;
    
    if (currentQueue.length === 0) return;
    
    // Check if this is the first song they've played in this session
    // If they directly played a song, don't allow going to previous
    if (sessionPlayHistory.length <= 1) {
      console.log('Cannot go to previous: this is the first song in the session');
      return;
    }
    
    // Check if we're at the first song in the current queue AND it's the first song of the session
    if (currentIndex === 0 && sessionPlayHistory.length === 1) {
      console.log('Cannot go to previous: at the beginning of queue and first song of session');
      return;
    }
    
    setIsTrackChanging(true);
    
    let prevIndex = currentIndex - 1;
    
    // Loop to end if at beginning
    if (prevIndex < 0) {
      prevIndex = currentQueue.length - 1;
    }
    
    const prevTrackToPlay = currentQueue[prevIndex];
    if (prevTrackToPlay) {
      // Preload the image aggressively before switching
      const img = new Image();
      img.onload = () => {
        // Image loaded successfully, now switch track
        setTimeout(() => {
          setCurrentIndex(prevIndex);
          playTrackDirectly(prevTrackToPlay);
          
          // Re-enable clicking after a short delay
          setTimeout(() => {
            setIsTrackChanging(false);
          }, 300);
        }, 200); // Small delay to ensure image is ready
      };
      
      img.onerror = () => {
        // Image failed to load, switch anyway but with longer delay
        setTimeout(() => {
          setCurrentIndex(prevIndex);
          playTrackDirectly(prevTrackToPlay);
          
          setTimeout(() => {
            setIsTrackChanging(false);
          }, 300);
        }, 500);
      };
      
      // Start preloading the image
      img.src = prevTrackToPlay.image;
      
      // Fallback timeout in case image loading hangs
      setTimeout(() => {
        if (isTrackChanging) {
          setCurrentIndex(prevIndex);
          playTrackDirectly(prevTrackToPlay);
          setIsTrackChanging(false);
        }
      }, 1000); // 1 second max wait
    }
  }, [queue, defaultQueue, currentIndex, playTrackDirectly, isTrackChanging, sessionPlayHistory]);

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
  };

  const toggleRepeat = () => {
    setIsRepeat(!isRepeat);
  };

  // Handle song end with repeat functionality
  useEffect(() => {
    const handleEnded = () => {
      setIsPlaying(false);
      // Handle repeat or auto play next track when current song ends
      setTimeout(() => {
        if (isRepeat) {
          // Restart the current track
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => {
              setIsPlaying(true);
              console.log('Repeating current track');
            }).catch((error) => {
              console.error('Error repeating audio:', error);
            });
          }
        } else {
          nextTrack();
        }
      }, 500);
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('ended', handleEnded);
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('ended', handleEnded);
        }
      };
    }
  }, [isRepeat, nextTrack]); // Re-run when isRepeat or nextTrack changes

  const musicContextValue: MusicContextType = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    queue: queue.length > 0 ? queue : defaultQueue,
    currentIndex,
    isRepeat,
    isTrackChanging,
    playTrack,
    playTrackWithCustomQueue,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleRepeat
  };
  
  return (
    <MusicContext.Provider value={musicContextValue}>
      <div className="h-full bg-spotify-black flex flex-col no-select">
        <motion.main 
          className="flex-1 overflow-y-auto pb-[240px] md:pb-[160px]" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/all-songs" element={<AllSongs />} />
            <Route path="/favourite-songs" element={<LikedSongs />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/music" element={<Music />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/followers" element={<Followers />} />
            <Route path="/followers/:userId" element={<Followers />} />
            <Route path="/following" element={<Following />} />
            <Route path="/following/:userId" element={<Following />} />
            <Route path="/friends-test" element={<FriendsTest />} />
          </Routes>
        </motion.main>
        
        <MusicPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={togglePlayPause}
          onNext={nextTrack}
          onPrevious={previousTrack}
        />
        
        <BottomNavigation />
      </div>
    </MusicContext.Provider>
  );
};

// Standalone Admin Dashboard wrapper
const AdminDashboardWrapper = () => {
  return (
    <div className="h-screen bg-spotify-black">
      <AdminDashboard />
    </div>
  );
};

// Main App component with authentication
function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Admin route - no user auth required */}
          <Route path="/system/analytics/dashboard/secure/v2" element={<AdminDashboardWrapper />} />
          
          {/* All other routes require user authentication */}
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

// App content component that handles authentication state
const AppContent = () => {
  // Allow guest access to most pages, only require auth for specific features
  return <AuthenticatedApp />;
};

export default App;
