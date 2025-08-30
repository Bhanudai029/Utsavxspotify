import { motion } from 'framer-motion';
import { ChevronLeft, Play, Pause, Heart, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useMusicPlayer } from '../App';
import { sampleTracks } from '../data';
import OptimizedImage from '../components/OptimizedImage';
import ProtectedComponent from '../components/ProtectedComponent';

const LikedSongs = () => {
  return (
    <ProtectedComponent
      requireAuth={true}
      authTitle="Start Your Music Journey"
      authMessage="Start listening to your favourite songs by creating your account or logging in"
    >
      <LikedSongsContent />
    </ProtectedComponent>
  );
};

const LikedSongsContent = () => {
  const navigate = useNavigate();
  const { currentUser, likedSongs, toggleLikedSong } = useUser();
  const { playTrackWithCustomQueue, currentTrack, isPlaying } = useMusicPlayer();
  const audioContext = useMusicPlayer(); // Move this to top level
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Get liked tracks from the sample tracks based on user's liked song IDs
  const likedTracks = sampleTracks.filter(track => likedSongs.includes(track.id));
  
  // Set document title when component mounts
  useEffect(() => {
    document.title = 'Favourite Songs - Lyriq';
    
    // Cleanup: Reset title when component unmounts
    return () => {
      document.title = 'Lyriq';
    };
  }, []);
  
  // Create the custom queue with liked tracks in the correct format
  const likedTracksQueue = likedTracks.map(track => ({
    id: track.id,
    name: track.title,
    artist: track.artist,
    image: track.image,
    duration: track.duration,
    audioUrl: track.audioUrl
  }));
  
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

  // Handle playing a specific track
  const handleTrackPlay = (track: any) => {
    const musicTrack = {
      id: track.id,
      name: track.title,
      artist: track.artist,
      image: track.image,
      duration: track.duration,
      audioUrl: track.audioUrl
    };
    
    // Use custom queue for liked songs page
    playTrackWithCustomQueue(musicTrack, likedTracksQueue);
    console.log('Playing from liked songs queue:', musicTrack.name);
    console.log('Queue order will be:', likedTracksQueue.map((t, i) => `${i + 1}: ${t.name}`).join(', '));
  };

  // Handle removing from liked songs
  const handleUnlike = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the track play
    try {
      await toggleLikedSong(songId);
      console.log(`Removed song ${songId} from liked songs`);
    } catch (error) {
      console.error('Error removing liked song:', error);
    }
  };

  // Handle song selection (clicking on track)
  const handleSongSelect = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the track play
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

  // Handle playing the first liked song or toggling playback
  const handlePlayPause = () => {
    if (likedTracks.length === 0) return;
    
    const firstTrack = likedTracks[0];
    const isCurrentTrackPlaying = currentTrack?.id === firstTrack.id && isPlaying;
    
    if (isCurrentTrackPlaying) {
      // If the first track is currently playing, pause it
      audioContext.togglePlayPause();
    } else {
      // Play the first track
      handleTrackPlay(firstTrack);
    }
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
        className="flex items-center p-6 pb-4"
        variants={itemVariants}
      >
        <motion.button 
          onClick={() => navigate('/music')}
          className="p-2 hover:bg-spotify-gray rounded-full transition-colors mr-4"
          whileTap={{ scale: 0.95 }}
        >
          <ChevronLeft className="text-white" size={24} />
        </motion.button>
        <h1 className="text-2xl font-bold text-white">Favourite Songs</h1>
      </motion.div>

      {/* Playlist Header */}
      <motion.div 
        className="px-6 mb-6"
        variants={itemVariants}
      >
        <div className="flex items-center gap-4 md:gap-6">
          {/* Playlist Image */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-2xl flex-shrink-0">
            <Heart className="text-white w-8 h-8 sm:w-12 sm:h-12 md:w-20 md:h-20" fill="currentColor" />
          </div>
          
          {/* Playlist Info */}
          <div className="flex-1 min-w-0">
            <p className="text-spotify-light-gray text-xs sm:text-sm mb-1 md:mb-2">Playlist</p>
            <h1 className="text-white text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold mb-2 md:mb-4 truncate">Favourite Songs</h1>
            <div className="flex items-center gap-1 sm:gap-2 text-spotify-light-gray text-xs sm:text-sm">
              <span className="text-white font-medium truncate">{currentUser?.displayName || currentUser?.name}</span>
              <span className="hidden sm:inline">•</span>
              <span className="sm:ml-0 ml-2">{likedTracks.length} songs</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Play Button */}
      {likedTracks.length > 0 && (
        <motion.div 
          className="px-6 mb-4 md:mb-6"
          variants={itemVariants}
        >
          <motion.button
            onClick={handlePlayPause}
            className="w-12 h-12 sm:w-14 sm:h-14 bg-spotify-green rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
            whileTap={{ scale: 0.95 }}
          >
            {currentTrack?.id === likedTracks[0]?.id && isPlaying ? (
              <Pause className="text-black" size={16} fill="currentColor" />
            ) : (
              <Play className="text-black ml-1" size={16} fill="currentColor" />
            )}
          </motion.button>
        </motion.div>
      )}

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
              try {
                const songsCount = selectedSongs.length;
                
                // Remove all selected songs from liked songs
                const promises = selectedSongs.map(songId => toggleLikedSong(songId));
                await Promise.all(promises);
                
                // Show success message
                const message = songsCount === 1 
                  ? 'Successfully removed 1 song from favourites!' 
                  : `Successfully removed ${songsCount} songs from favourites!`;
                setSuccessMessage(message);
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                  setSuccessMessage('');
                }, 3000);
                
                console.log(`Successfully removed ${songsCount} songs from liked songs`);
                
                // Reset selection after unfavoriting
                setSelectedSongs([]);
              } catch (error) {
                console.error('Error unfavoriting selected songs:', error);
                // Show error message
                setSuccessMessage('Failed to remove songs from favourites. Please try again.');
                setTimeout(() => {
                  setSuccessMessage('');
                }, 3000);
              }
            }}
            className="px-4 py-2 rounded-full bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-md"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
          >
            Unfavourite selected
          </motion.button>
        </motion.div>
      )}

      {/* Songs List */}
      <motion.div 
        className={`px-6 pb-8 ${selectedSongs.length > 0 ? 'pb-20' : ''}`}
        variants={itemVariants}
      >
        {likedTracks.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="text-spotify-light-gray mx-auto mb-4 w-16 h-16" />
            <h3 className="text-white font-medium text-lg mb-2">No favourite songs yet</h3>
            <p className="text-spotify-light-gray">Songs you like will appear here. Start exploring and hit the heart button!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {likedTracks.map((track, index) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const isSelected = selectedSongs.includes(track.id);
              
              return (
                <motion.div
                  key={track.id}
                  className={`flex items-center rounded-md overflow-hidden cursor-pointer transition-all duration-200 group ${
                    isSelected 
                      ? 'bg-spotify-green/20 border-2 border-spotify-green shadow-lg scale-[1.02]' 
                      : 'bg-spotify-gray border-2 border-transparent hover:bg-spotify-light-gray/10'
                  }`}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: isSelected ? 1.02 : 1.01 }}
                  onClick={(e: React.MouseEvent) => handleSongSelect(track.id, e)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-gradient-to-br from-spotify-light-gray to-spotify-gray rounded-md overflow-hidden border border-spotify-gray shadow-sm flex items-center justify-center relative">
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3 h-3 sm:w-4 sm:h-4 bg-spotify-green rounded-full flex items-center justify-center z-10">
                        <Check className="text-black" size={8} />
                      </div>
                    )}
                    {isCurrentTrack && isPlaying ? (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex gap-0.5 sm:gap-1">
                          {[...Array(3)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-0.5 sm:w-1 bg-spotify-green rounded-full"
                              style={{ height: '6px' }}
                              animate={{
                                scaleY: [0.5, 1, 0.5],
                                opacity: [0.5, 1, 0.5]
                              }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.1,
                                ease: "easeInOut"
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <OptimizedImage
                      src={track.image}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      priority={true}
                    />
                  </div>
                  <div className="flex-1 min-w-0 px-3 py-2">
                    <h3 className={`font-medium text-sm sm:text-base truncate ${
                      isCurrentTrack ? 'text-spotify-green' : 'text-white'
                    }`}>
                      {track.title}
                    </h3>
                    <p className="text-spotify-light-gray text-xs sm:text-sm truncate mt-0.5 sm:mt-1">
                      {track.artist}
                    </p>
                  </div>
                  <div className="flex-shrink-0 p-1 sm:p-1.5 md:p-2 flex items-center gap-1">
                    {/* Play Button - Only visible on desktop hover */}
                    <motion.div
                      className="w-8 h-8 sm:w-10 sm:h-10 bg-spotify-green rounded-full items-center justify-center transition-opacity cursor-pointer hidden md:flex opacity-0 group-hover:opacity-100"
                      whileHover={{ scale: 1.1 }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleTrackPlay(track);
                      }}
                    >
                      {isCurrentTrack && isPlaying ? (
                        <Pause className="text-black" size={14} fill="currentColor" />
                      ) : (
                        <Play className="text-black ml-0.5" size={14} fill="currentColor" />
                      )}
                    </motion.div>
                    {/* Unlike Button - Only visible on desktop hover */}
                    <motion.button
                      onClick={(e: React.MouseEvent) => handleUnlike(track.id, e)}
                      className="p-1 hover:bg-spotify-gray rounded transition-all ml-1 hidden md:block opacity-0 group-hover:opacity-100"
                      whileTap={{ scale: 0.9 }}
                    >
                      <Heart className="text-spotify-green w-4 h-4" fill="currentColor" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LikedSongs;