import { motion } from 'framer-motion';
import { Settings, Play, ChevronRight, ChevronLeft, Search, X } from 'lucide-react';
import { recentlyPlayedTracks, sampleTracks } from '../data';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMusicPlayer } from '../App';
import { useUser } from '../contexts/UserContext';
import ImagePreloader from '../lib/imagePreloader';

const Home = () => {
  const [greeting, setGreeting] = useState('Good evening');
  const [hoveredArtist, setHoveredArtist] = useState<string | null>(null);
  const [artistScrollIndex, setArtistScrollIndex] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const navigate = useNavigate();
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const { currentUser, preloadUserStats } = useUser();

  // Artists data
  const artists = [
    {
      name: 'Arijit Singh',
      image: '/Arijit Singh.jpeg',
      description: 'Artist'
    },
    {
      name: 'Billie Eilish', 
      image: '/Billie Eilish.jpeg',
      description: 'Artist'
    },
    {
      name: 'The Weeknd',
      image: '/The Weeknd.jpeg', 
      description: 'Artist'
    },
    {
      name: 'Bruno Mars',
      image: '/Bruno Mars.jpeg',
      description: 'Artist'
    },
    {
      name: 'Sushant KC',
      image: '/Sushant KC.jpeg',
      description: 'Artist'
    }
  ];

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    // Filter tracks based on title, artist, or album
    const filteredTracks = sampleTracks.filter(track => 
      track.title.toLowerCase().includes(query.toLowerCase()) ||
      track.artist.toLowerCase().includes(query.toLowerCase()) ||
      track.album.toLowerCase().includes(query.toLowerCase()) ||
      track.genre.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(filteredTracks.slice(0, 10)); // Limit to 10 results
  };

  const handleTrackPlay = (track: any) => {
    const formattedTrack = {
      id: track.id,
      name: track.title,
      artist: track.artist,
      image: track.image,
      duration: track.duration,
      audioUrl: track.audioUrl
    };
    playTrack(formattedTrack);
    setIsSearchOpen(false);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Calculate how many artists to show per view (only for mobile navigation)
  const getArtistsPerView = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 2; // Mobile: 2 artists with navigation
    }
    return 2; // Default for mobile
  };

  const [artistsPerView, setArtistsPerView] = useState(getArtistsPerView());

  // Update artists per view on window resize (mobile only)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setArtistsPerView(2);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation functions (mobile only)
  const scrollToNextArtists = () => {
    if (window.innerWidth >= 640) return; // Disable on desktop
    const totalPages = Math.ceil(artists.length / artistsPerView);
    const currentPage = Math.floor(artistScrollIndex / artistsPerView);
    if (currentPage < totalPages - 1) {
      setArtistScrollIndex((currentPage + 1) * artistsPerView);
    }
  };

  const scrollToPrevArtists = () => {
    if (window.innerWidth >= 640) return; // Disable on desktop
    const currentPage = Math.floor(artistScrollIndex / artistsPerView);
    if (currentPage > 0) {
      setArtistScrollIndex((currentPage - 1) * artistsPerView);
    }
  };

  // Check if navigation arrows should be shown (mobile only)
  const totalPages = Math.ceil(artists.length / artistsPerView);
  const currentPage = Math.floor(artistScrollIndex / artistsPerView);
  const showPrevArrow = currentPage > 0 && window.innerWidth < 640;
  const showNextArrow = currentPage < totalPages - 1 && window.innerWidth < 640;

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

  // Preload profile picture placeholder for faster profile page loading
  useEffect(() => {
    const preloadProfileAssets = async () => {
      const preloader = ImagePreloader.getInstance();
      
      try {
        // Check if already preloaded by the main app
        if (!preloader.isPreloaded('/PPplaceholder.png')) {
          await preloader.preloadImage('/PPplaceholder.png', {
            priority: 'high',
            onLoad: () => console.log('Profile placeholder preloaded from Home page'),
            onError: (error) => console.warn('Profile placeholder preload failed:', error)
          });
        } else {
          console.log('Profile placeholder already cached');
        }
      } catch (error) {
        console.warn('Profile assets preload failed:', error);
      }
    };
    
    // Preload after a short delay to not interfere with home page rendering
    const preloadTimer = setTimeout(preloadProfileAssets, 300);
    
    return () => clearTimeout(preloadTimer);
  }, []);

  // Proactively preload user stats when user is active on home page
  useEffect(() => {
    if (currentUser?.id) {
      // Preload stats after user has been on home page for 2 seconds
      const preloadTimer = setTimeout(() => {
        console.log('🏠 Proactively preloading user stats from Home page...');
        preloadUserStats();
      }, 2000);
      
      return () => clearTimeout(preloadTimer);
    }
  }, [currentUser?.id, preloadUserStats]);

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

  return (
    <motion.div 
      className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div 
        className="flex justify-between items-center p-6 pb-4"
        variants={itemVariants}
      >
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{greeting}</h1>
        </div>
        <div className="flex items-center gap-2">
          <motion.button 
            onClick={() => setIsSearchOpen(true)}
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <Search className="text-white" size={24} />
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

      {/* Quick Access Grid */}
      <motion.div 
        className="px-6 mb-8"
        variants={itemVariants}
      >
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-4">
          {sampleTracks.slice(0, 6).map((track) => (
            <motion.div
              key={track.id}
              className="flex items-center bg-spotify-gray rounded-md overflow-hidden card-hover cursor-pointer min-h-[52px] sm:min-h-[48px]"
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <img 
                src={track.image} 
                alt={track.title}
                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-cover flex-shrink-0"
              />
              <div className="flex-1 px-1.5 sm:px-2 md:px-3 min-w-0 overflow-hidden py-1">
                <h3 className="text-white text-xs sm:text-sm md:text-sm font-medium leading-tight">
                  {/* Mobile: Smart line breaking for better text visibility */}
                  <div className="md:hidden">
                    {(() => {
                      const name = track.title;
                      if (name.length <= 10) {
                        // Short names - single line
                        return name;
                      } else if (name.includes(' ') && name.length <= 20) {
                        // Medium names with spaces - break at space
                        const words = name.split(' ');
                        const midPoint = Math.ceil(words.length / 2);
                        const firstLine = words.slice(0, midPoint).join(' ');
                        const secondLine = words.slice(midPoint).join(' ');
                        return (
                          <>
                            <div>{firstLine}</div>
                            <div>{secondLine}</div>
                          </>
                        );
                      } else {
                        // Long names or no spaces - break halfway
                        const midPoint = Math.ceil(name.length / 2);
                        return (
                          <>
                            <div>{name.substring(0, midPoint)}</div>
                            <div>{name.substring(midPoint)}</div>
                          </>
                        );
                      }
                    })()}
                  </div>
                  {/* Desktop: Single line with truncation */}
                  <div className="hidden md:block truncate">
                    {track.title}
                  </div>
                </h3>
              </div>
              <div className="flex-shrink-0 p-1 sm:p-1.5 md:p-2">
                <motion.div
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-spotify-green rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  whileHover={{ scale: 1.1 }}
                  style={{ opacity: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Convert track to the format expected by playTrack
                    const playableTrack = {
                      id: track.id,
                      name: track.title,
                      artist: track.artist,
                      image: track.image,
                      duration: track.duration,
                      audioUrl: track.audioUrl
                    };
                    playTrack(playableTrack);
                  }}
                >
                  {/* Show audio bars if this song is currently playing, otherwise show play button */}
                  {currentTrack && track.title === currentTrack.name && isPlaying ? (
                    <div className="flex items-center justify-center gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="bg-black rounded-full"
                          style={{
                            width: '1.5px',
                            height: '5px'
                          }}
                          animate={{
                            scaleY: [1, 2, 0.5, 1.8, 1],
                            opacity: [0.7, 1, 0.5, 1, 0.7]
                          }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.1,
                            ease: "easeInOut"
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Play className="text-black ml-0.5" size={12} fill="currentColor" />
                  )}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
        
        <motion.button
          onClick={() => navigate('/all-songs')}
          className="flex items-center justify-center w-full py-3 text-spotify-light-gray hover:text-white transition-colors"
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-sm font-medium mr-2">Show all</span>
          <ChevronRight size={16} />
        </motion.button>
      </motion.div>

      {/* Top Trending Artists */}
      <motion.div 
        className="px-6 mb-8"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Top Trending Artists</h2>
          
          {/* Navigation Arrows - MOBILE ONLY */}
          <div className="flex items-center gap-2 sm:hidden">
            <motion.button
              onClick={scrollToPrevArtists}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                showPrevArrow 
                  ? 'bg-spotify-gray text-white hover:bg-spotify-light-gray cursor-pointer' 
                  : 'bg-spotify-dark text-spotify-light-gray cursor-not-allowed opacity-50'
              }`}
              whileTap={{ scale: showPrevArrow ? 0.95 : 1 }}
              whileHover={{ scale: showPrevArrow ? 1.05 : 1 }}
              disabled={!showPrevArrow}
            >
              <ChevronLeft size={16} />
            </motion.button>
            
            <motion.button
              onClick={scrollToNextArtists}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                showNextArrow 
                  ? 'bg-spotify-gray text-white hover:bg-spotify-light-gray cursor-pointer' 
                  : 'bg-spotify-dark text-spotify-light-gray cursor-not-allowed opacity-50'
              }`}
              whileTap={{ scale: showNextArrow ? 0.95 : 1 }}
              whileHover={{ scale: showNextArrow ? 1.05 : 1 }}
              disabled={!showNextArrow}
            >
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>
        
        {/* Artists Container */}
        <div className="overflow-x-auto scrollbar-hide sm:overflow-visible">
          {/* Mobile: Controlled carousel */}
          <motion.div 
            className="flex gap-4 sm:hidden"
            animate={{ 
              x: -artistScrollIndex * (100 / artistsPerView) + '%' 
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 300, 
              damping: 30 
            }}
          >
            {artists.map((artist, index) => (
              <motion.div
                key={artist.name}
                className={`flex-shrink-0 cursor-pointer transition-all duration-300 rounded-lg ${
                  hoveredArtist === artist.name 
                    ? 'bg-spotify-gray p-4' 
                    : 'p-4'
                }`}
                style={{
                  width: `calc(${100 / artistsPerView}% - ${(artistsPerView - 1) * 16 / artistsPerView}px)`
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredArtist(artist.name)}
                onMouseLeave={() => setHoveredArtist(null)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Artist Image */}
                <img 
                  src={artist.image} 
                  alt={artist.name}
                  className="w-24 h-24 object-cover rounded-full mx-auto"
                />
                
                {/* Artist info */}
                <div className="mt-3">
                  <h3 className="text-white font-medium text-sm mb-1 text-center truncate">{artist.name}</h3>
                  <p className="text-spotify-light-gray text-xs text-center">{artist.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          
          {/* Desktop: Original scrollable layout */}
          <div className="hidden sm:flex gap-4">
            {artists.map((artist, index) => (
              <motion.div
                key={artist.name}
                className={`flex-shrink-0 cursor-pointer rounded-lg ${
                  hoveredArtist === artist.name 
                    ? 'bg-spotify-gray p-4' 
                    : 'p-4'
                }`}
                whileHover={{ 
                  scale: 1.05,
                  transition: { duration: 0.2, ease: "easeOut" }
                }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredArtist(artist.name)}
                onMouseLeave={() => setHoveredArtist(null)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Artist Image - Desktop size */}
                <img 
                  src={artist.image} 
                  alt={artist.name}
                  className="w-32 h-32 object-cover rounded-full mx-auto transition-transform duration-200 ease-out"
                />
                
                {/* Artist info */}
                <div className="mt-3">
                  <h3 className="text-white font-medium text-sm mb-1 text-center">{artist.name}</h3>
                  <p className="text-spotify-light-gray text-xs text-center">{artist.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Page Indicators - MOBILE ONLY */}
        <div className="flex justify-center mt-4 gap-2 sm:hidden">
          {Array.from({ length: Math.ceil(artists.length / artistsPerView) }).map((_, index) => {
            // Simple page calculation that matches navigation logic
            const currentPage = Math.floor(artistScrollIndex / artistsPerView);
            
            return (
              <motion.button
                key={index}
                onClick={() => {
                  setArtistScrollIndex(index * artistsPerView);
                }}
                className={`rounded-full transition-all ${
                  currentPage === index
                    ? 'bg-spotify-green'
                    : 'bg-spotify-gray'
                }`}
                style={{ 
                  width: '20px', 
                  height: '20px',
                  minWidth: '20px',
                  minHeight: '20px',
                  flexShrink: 0
                }}
                whileTap={{ scale: 0.8 }}
              />
            );
          })}
        </div>
      </motion.div>

      {/* Recently Played */}
      <motion.div 
        className="px-6 pb-8"
        variants={itemVariants}
      >
        <h2 className="text-xl font-bold text-white mb-4">Recently played</h2>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {recentlyPlayedTracks.map((track) => (
            <motion.div
              key={track.id}
              className="flex-shrink-0 w-40 bg-spotify-gray rounded-lg overflow-hidden card-hover cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img 
                src={track.image} 
                alt={track.title}
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <h3 className="text-white font-medium text-sm mb-1 truncate">{track.title}</h3>
              </div>
            </motion.div>
          ))}
          ))
        </div>
      </motion.div>

      {/* Search Modal */}
      {isSearchOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSearch}
        >
          <motion.div
            className="bg-spotify-gray rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden"
            initial={{ scale: 0.9, y: -50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: -50 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Header */}
            <div className="flex items-center p-4 border-b border-spotify-light-gray/20">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-spotify-light-gray" size={20} />
                <input
                  type="text"
                  placeholder="What do you want to listen to?"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-spotify-black text-white pl-12 pr-4 py-3 rounded-lg border border-spotify-light-gray/20 focus:border-spotify-green focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <motion.button
                onClick={closeSearch}
                className="ml-4 p-2 hover:bg-spotify-light-gray/20 rounded-full transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                <X className="text-white" size={20} />
              </motion.button>
            </div>

            {/* Search Results */}
            <div className="max-h-96 overflow-y-auto scrollbar-hide">
              {searchQuery.trim() === '' ? (
                <div className="p-8 text-center">
                  <Search className="text-spotify-light-gray mx-auto mb-4" size={48} />
                  <h3 className="text-white font-medium text-lg mb-2">Search for songs</h3>
                  <p className="text-spotify-light-gray">Find your favorite tracks by title, artist, or genre</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-spotify-light-gray text-4xl mb-4">🎵</div>
                  <h3 className="text-white font-medium text-lg mb-2">No results found</h3>
                  <p className="text-spotify-light-gray">Try searching for something else</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {searchResults.map((track, index) => (
                    <motion.div
                      key={track.id}
                      className="flex items-center p-3 hover:bg-spotify-light-gray/10 rounded-lg cursor-pointer group transition-colors"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleTrackPlay(track)}
                    >
                      <img
                        src={track.image}
                        alt={track.title}
                        className="w-12 h-12 object-cover rounded-md mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm truncate">{track.title}</h4>
                        <p className="text-spotify-light-gray text-xs truncate">{track.artist} • {track.album}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-spotify-light-gray text-xs">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </span>
                        <motion.div
                          className="w-8 h-8 bg-spotify-green rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          {currentTrack && track.title === currentTrack.name && isPlaying ? (
                            <div className="flex items-center justify-center gap-0.5">
                              {[...Array(3)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  className="bg-black rounded-full"
                                  style={{
                                    width: '1.5px',
                                    height: '4px'
                                  }}
                                  animate={{
                                    scaleY: [1, 2, 0.5, 1.8, 1],
                                    opacity: [0.7, 1, 0.5, 1, 0.7]
                                  }}
                                  transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                    ease: "easeInOut"
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <Play className="text-black ml-0.5" size={16} fill="currentColor" />
                          )}
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Home;