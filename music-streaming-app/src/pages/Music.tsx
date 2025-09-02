import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { sampleTracks } from '../data';
import OptimizedImage from '../components/OptimizedImage';

const Music = () => {
  const navigate = useNavigate();
  const { currentUser, likedSongs, preloadUserStats } = useUser();
  const [activeTab, setActiveTab] = useState('Playlists');
  const tabs = ['Playlists', 'Podcasts', 'Albums', 'Artists'];
  
  // Get user's profile image URL with fallback
  const getUserProfileImageUrl = () => {
    if (currentUser?.profileImage && currentUser.profileImage !== '/PPplaceholder-modified.png') {
      return currentUser.profileImage;
    }
    return '/PPplaceholder-modified.png';
  };

  // Custom placeholder for user profile picture
  const ProfileImagePlaceholder = () => (
    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
      <span className="text-white text-sm font-bold">
        {currentUser?.displayName?.[0] || currentUser?.name?.[0] || 'U'}
      </span>
    </div>
  );
  
  // Get liked tracks from the sample tracks based on user's liked song IDs
  const likedTracks = sampleTracks.filter(track => likedSongs.includes(track.id));
  
  // Proactively preload user stats when user visits music page
  useEffect(() => {
    if (currentUser?.id) {
      // Preload stats after user has been on music page for 1.5 seconds
      const preloadTimer = setTimeout(() => {
        console.log('🎵 Proactively preloading user stats from Music page...');
        preloadUserStats();
      }, 1500);
      
      return () => clearTimeout(preloadTimer);
    }
  }, [currentUser?.id, preloadUserStats]);
  
  // Handle navigating to favourite songs page
  const goToLikedSongs = () => {
    if (!currentUser) {
      // If user is not logged in, navigate to favourite songs page which will show auth
      navigate('/favourite-songs');
    } else {
      // If user is logged in, navigate normally
      navigate('/favourite-songs');
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

  const libraryItems = [
    {
      id: '1',
      title: 'Favourite Songs',
      subtitle: currentUser ? `${likedTracks.length} Songs` : 'Login to see your songs',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop',
      isLiked: true,
      onClick: goToLikedSongs,
      isEmpty: !currentUser || likedTracks.length === 0
    },
    {
      id: '2',
      title: 'New Episodes',
      subtitle: 'Updated 2 days ago',
      image: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=100&h=100&fit=crop',
      isLiked: false
    },
    {
      id: '3',
      title: 'My life is a movie',
      subtitle: 'Playlist • Sophia Clark',
      image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=100&h=100&fit=crop',
      isLiked: false
    },
    {
      id: '4',
      title: 'Your Top Songs 2022',
      subtitle: 'Playlist',
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop',
      isLiked: false
    },
    {
      id: '5',
      title: 'Acoustic Chill',
      subtitle: 'Playlist',
      image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop',
      isLiked: false
    },
    {
      id: '6',
      title: 'Amour de lycee',
      subtitle: 'Playlist • Ethan Carter',
      image: 'https://images.unsplash.com/photo-1418065460487-3181407448c9?w=100&h=100&fit=crop',
      isLiked: false
    }
  ];

  return (
    <motion.div 
      className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between p-6 pb-4"
        variants={itemVariants}
      >
        <div className="flex items-center">
          {/* User Profile Picture */}
          {currentUser ? (
            <OptimizedImage
              src={getUserProfileImageUrl()}
              alt={currentUser.displayName || currentUser.name || 'User Profile'}
              className="w-8 h-8 rounded-full object-cover mr-3 border border-spotify-light-gray"
              priority={true}
              placeholder={<ProfileImagePlaceholder />}
              onError={() => {
                console.warn('Failed to load user profile image in Music page');
              }}
            />
          ) : (
            <ProfileImagePlaceholder />
          )}
          <h1 className="text-2xl font-bold text-white">Your Library</h1>
        </div>
        <div className="flex items-center gap-3">
          <motion.button 
            className="p-2 hover:bg-spotify-gray rounded-full transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <Search className="text-white" size={24} />
          </motion.button>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div 
        className="flex gap-3 px-6 mb-6"
        variants={itemVariants}
      >
        {tabs.map((tab) => (
          <motion.button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab 
                ? 'bg-spotify-green text-black' 
                : 'bg-spotify-gray text-white hover:bg-spotify-light-gray hover:text-black'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {tab}
          </motion.button>
        ))}
      </motion.div>

      {/* Library Items */}
      <motion.div 
        className="px-6 pb-8"
        variants={itemVariants}
      >
        <div className="space-y-3">
          {libraryItems.map((item, index) => (
            <motion.div
              key={item.id}
              className={`flex items-center p-2 rounded-lg card-hover cursor-pointer`}
              whileHover={{ backgroundColor: 'rgba(40, 40, 40, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                }
              }}
            >
              <div className="relative">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className={`w-14 h-14 object-cover ${item.isLiked ? 'rounded' : 'rounded-md'}`}
                />
                {item.isLiked && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
                    <span className="text-white text-2xl">♥</span>
                  </div>
                )}
              </div>
              <div className="flex-1 ml-4">
                <h3 className="text-white font-medium text-sm mb-1">{item.title}</h3>
                <p className="text-spotify-light-gray text-xs">{item.subtitle}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Music;