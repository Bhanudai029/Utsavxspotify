import { motion } from 'framer-motion';
import { Settings, Play, ArrowLeft, Check, X, RefreshCw } from 'lucide-react';
import { sampleTracks } from '../data';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMusicPlayer } from '../App';
import { useUser } from '../contexts/UserContext';
import MusicDataService from '../lib/musicDataService';
import OptimizedImage from '../components/OptimizedImage';
import type { Track } from '../types';

const AllSongs = () => {
  const [greeting, setGreeting] = useState('Good evening');
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [tracks, setTracks] = useState<Track[]>(sampleTracks);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const navigate = useNavigate();
  const { playTrack } = useMusicPlayer();
  const { toggleLikedSong, isAuthenticated } = useUser();
  const musicDataService = MusicDataService.getInstance();

  // Function to get appropriate greeting based on time
  const getGreeting = (hour: number) => {
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else if (hour >= 17 && hour < 22) {
      return 'Good evening';
    } else {
      return 'Good night';
    }
  };

  // Function to get user's country and timezone
  const getUserLocation = async () => {
    try {
      // First, try to get timezone from browser
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const hour = now.getHours();
      
      // Extract country/region from timezone (for potential future use)
      
      setGreeting(getGreeting(hour));
      
      // Optional: Try to get more precise location using IP geolocation
      // This is a backup method using a free service
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          
          // Get time in user's timezone
          const userTime = new Date().toLocaleString('en-US', {
            timeZone: data.timezone || timezone,
            hour12: false,
            hour: 'numeric'
          });
          const userHour = parseInt(userTime);
          setGreeting(getGreeting(userHour));
        }
      } catch (ipError) {
        console.log('IP geolocation not available, using browser timezone');
      }
      
    } catch (error) {
      console.error('Error getting user location:', error);
      // Fallback to default greeting
      setGreeting('Good evening');
    }
  };

  // Load tracks from the unified music data service
  const loadTracks = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const allTracks = await musicDataService.getAllTracks(forceRefresh);
      setTracks(allTracks);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading tracks:', error);
      // Fallback to sample tracks
      setTracks(sampleTracks);
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to track updates
  useEffect(() => {
    const unsubscribe = musicDataService.subscribe((updatedTracks) => {
      setTracks(updatedTracks);
      setLastRefresh(new Date());
    });

    // Initial load
    loadTracks();

    return unsubscribe;
  }, []);

  // Handle manual refresh
  const handleRefresh = async () => {
    await loadTracks(true);
    setSuccessMessage('Songs updated successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  useEffect(() => {
    getUserLocation();
    
    // Update greeting every minute
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      setGreeting(getGreeting(hour));
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

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

  // Handle song selection (clicking on name/image)
  const handleSongSelect = (songId: string) => {
    setSelectedSongs(prev => {
      if (prev.includes(songId)) {
        // Unselect if already selected
        return prev.filter(id => id !== songId);
      } else {
        // Select the song
        return [...prev, songId];
      }
    });
  };

  // Handle song play (clicking green button)
  const handleSongPlay = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Increment play count
    await musicDataService.incrementPlayCount(track.id);
    
    // Convert track to the format expected by playTrack
    const playableTrack = {
      id: track.id,
      name: track.title,
      artist: track.artist,
      image: track.image,
      duration: track.duration,
      audioUrl: track.audioUrl || `https://aekvevvuanwzmjealdkl.supabase.co/storage/v1/object/public/UtsavXmusic/${encodeURIComponent(track.title)}.mp3`
    };
    playTrack(playableTrack);
  };

  return (
    <motion.div 
      className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Success Message Toast */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-spotify-green text-black px-6 py-3 rounded-lg shadow-lg font-medium text-sm"
        >
          {successMessage}
        </motion.div>
      )}
      {/* Header */}
      <motion.div 
        className="flex justify-between items-center p-6 pb-4"
        variants={itemVariants}
      >
        <div className="flex items-center">
          <motion.button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors mr-4"
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="text-white" size={24} />
          </motion.button>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white mb-1">{greeting}</h1>
              {lastRefresh && (
                <span className="text-xs text-gray-400">
                  Updated: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
            title="Refresh songs"
          >
            <RefreshCw className={`text-white ${isLoading ? 'animate-spin' : ''}`} size={20} />
          </motion.button>
          <motion.button 
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <Settings className="text-white" size={24} />
          </motion.button>
        </div>
      </motion.div>

      {/* Category Pills */}
      <motion.div 
        className="flex gap-3 px-6 mb-6"
        variants={itemVariants}
      >
        {['Music', 'Podcasts', 'Audiobooks'].map((category, index) => (
          <motion.button
            key={category}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              index === 0 
                ? 'bg-spotify-green text-black' 
                : 'bg-spotify-gray text-white hover:bg-spotify-light-gray hover:text-black'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {category}
          </motion.button>
        ))}
      </motion.div>

      {/* Action Bar - Only show when songs are selected - Fixed to bottom on mobile */}
      {selectedSongs.length > 0 && (
        <motion.div 
          className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 py-3 flex justify-between items-center bg-spotify-gray/95 backdrop-blur-md border-t border-spotify-gray/50 z-40 shadow-lg"
          variants={itemVariants}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setSelectedSongs([])}
              className="p-1.5 hover:bg-spotify-light-gray/20 rounded-full transition-colors"
              whileTap={{ scale: 0.95 }}
              title="Clear selection"
            >
              <X className="text-spotify-light-gray hover:text-white" size={16} />
            </motion.button>
            <div className="w-2 h-2 bg-spotify-green rounded-full animate-pulse"></div>
            <h2 className="text-lg sm:text-xl font-bold text-white">{selectedSongs.length} selected</h2>
          </div>
          <motion.button
            onClick={async () => {
              if (!isAuthenticated) {
                console.warn('User not authenticated');
                return;
              }
              
              try {
                const songsCount = selectedSongs.length;
                
                // Add all selected songs to liked songs
                const promises = selectedSongs.map(songId => toggleLikedSong(songId));
                await Promise.all(promises);
                
                // Show success message
                const message = songsCount === 1 
                  ? 'Successfully added 1 song to favorites!' 
                  : `Successfully added ${songsCount} songs to favorites!`;
                setSuccessMessage(message);
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                  setSuccessMessage('');
                }, 3000);
                
                console.log(`Successfully added ${songsCount} songs to liked songs`);
                
                // Reset selection after favoriting
                setSelectedSongs([]);
              } catch (error) {
                console.error('Error favoriting selected songs:', error);
                // Show error message
                setSuccessMessage('Failed to add songs to favorites. Please try again.');
                setTimeout(() => {
                  setSuccessMessage('');
                }, 3000);
              }
            }}
            className="px-4 py-2 rounded-full bg-spotify-green text-black font-medium text-sm hover:bg-spotify-green/90 transition-colors shadow-md"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
          >
            Favorite selected
          </motion.button>
        </motion.div>
      )}

      {/* All Songs Grid */}
      <motion.div 
        className={`px-6 mb-8 ${selectedSongs.length > 0 ? 'pb-20' : ''}`}
        variants={itemVariants}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 10 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="flex items-center rounded-md overflow-hidden bg-spotify-gray/20 animate-pulse">
                <div className="w-14 h-14 bg-spotify-gray/40 flex-shrink-0"></div>
                <div className="flex-1 min-w-0 px-3 py-2">
                  <div className="h-4 bg-spotify-gray/40 rounded mb-1"></div>
                  <div className="h-3 bg-spotify-gray/40 rounded w-2/3"></div>
                </div>
              </div>
            ))
          ) : (
            tracks.map((track) => {
              const isSelected = selectedSongs.includes(track.id);
              
              return (
                <motion.div
                  key={track.id}
                  className={`flex items-center rounded-md overflow-hidden card-hover cursor-pointer transition-all duration-200 group ${
                    isSelected 
                      ? 'bg-spotify-green/20 border-2 border-spotify-green shadow-lg scale-[1.02]' 
                      : 'bg-spotify-gray border-2 border-transparent hover:bg-spotify-light-gray/10'
                  }`}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: isSelected ? 1.02 : 1.01 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleSongSelect(track.id)}
                >
                  <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-spotify-light-gray to-spotify-gray rounded-md overflow-hidden border border-spotify-gray shadow-sm flex items-center justify-center relative">
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-spotify-green rounded-full flex items-center justify-center z-10">
                        <Check className="text-black" size={10} />
                      </div>
                    )}
                    <OptimizedImage 
                      src={track.image} 
                      alt={track.title}
                      className="w-full h-full object-cover"
                      priority={false}
                    />
                  </div>
                  <div className="flex-1 min-w-0 px-3 py-2">
                    <h3 className="text-white font-medium text-sm truncate">{track.title}</h3>
                    <p className="text-spotify-light-gray text-xs truncate mt-1">{track.artist}</p>
                    {track.plays && track.plays > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {track.plays.toLocaleString()} plays
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 p-1 sm:p-1.5 md:p-2">
                    <motion.div
                      className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-spotify-green rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      whileHover={{ scale: 1.1 }}
                      style={{ opacity: 1 }}
                      onClick={(e) => handleSongPlay(track, e)}
                    >
                      <Play className="text-black ml-0.5" size={12} fill="currentColor" />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AllSongs;