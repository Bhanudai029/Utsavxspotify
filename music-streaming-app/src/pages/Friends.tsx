import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, UserPlus, UserMinus, Loader2, Heart, UserCheck, Eye, RefreshCw } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { getUserTag } from '../lib/firebaseService';
import type { UserProfile } from '../lib/firebaseService';

const Friends = () => {
  const { 
    currentUser, 
    searchUsers, 
    followUser, 
    unfollowUser, 
    checkIsFollowing, 
    getUserStats,
    getSuggestedUsers,
    isAuthenticated,
    isLoading,
    preloadUserStats
  } = useUser();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [followingStatus, setFollowingStatus] = useState<{ [key: string]: boolean }>({});
  const [userStats, setUserStats] = useState<{ [key: string]: { followers: number; following: number } }>({});
  const [activeTab, setActiveTab] = useState<'search' | 'suggestions'>('suggestions');
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const currentUserId = useMemo(() => currentUser?.id, [currentUser?.id]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 500);
    
    return () => clearTimeout(initTimer);
  }, []);

  const loadFollowingStatusForUsers = useCallback(async (users: UserProfile[]) => {
    if (!currentUserId) return;
    
    const statusPromises = users.map(user => 
      checkIsFollowing(user.id).then(isFollowing => ({ userId: user.id, isFollowing }))
    );
    
    const statuses = await Promise.all(statusPromises);
    const statusMap = statuses.reduce((acc, { userId, isFollowing }) => {
      acc[userId] = isFollowing;
      return acc;
    }, {} as { [key: string]: boolean });
    
    setFollowingStatus(prev => ({ ...prev, ...statusMap }));
  }, [currentUserId, checkIsFollowing]);

  const loadUserStatsForUsers = useCallback(async (users: UserProfile[]) => {
    const statsPromises = users.map(user => 
      getUserStats(user.id).then(stats => ({ userId: user.id, stats }))
    );
    
    const allStats = await Promise.all(statsPromises);
    const statsMap = allStats.reduce((acc, { userId, stats }) => {
      acc[userId] = { followers: stats.followersCount, following: stats.followingCount };
      return acc;
    }, {} as { [key: string]: { followers: number; following: number } });
    
    setUserStats(prev => ({ ...prev, ...statsMap }));
  }, [getUserStats]);

  const loadSuggestedUsers = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && now - lastLoadTime < 30000) {
      console.log('Skipping suggested users reload - too soon since last load');
      return;
    }

    try {
      setIsLoadingSuggestions(true);
      setLastLoadTime(now);
      const suggestions = await getSuggestedUsers(12);
      setSuggestedUsers(suggestions);
      
      await Promise.all([
        loadFollowingStatusForUsers(suggestions),
        loadUserStatsForUsers(suggestions)
      ]);
      
      setLastUpdateTime(new Date());

    } catch (error) {
      console.error('Error loading suggested users:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [getSuggestedUsers, loadFollowingStatusForUsers, loadUserStatsForUsers]);

  useEffect(() => {
    if (isAuthenticated && currentUserId) {
      loadSuggestedUsers(true);
    }
  }, [isAuthenticated, currentUserId]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    const autoRefreshInterval = setInterval(() => {
      console.log('Auto-refreshing suggested users (60s interval)');
      loadSuggestedUsers(false);
    }, 60000);

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [isAuthenticated, currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      const preloadTimer = setTimeout(() => {
        console.log('👥 Proactively preloading user stats from Friends page...');
        preloadUserStats();
      }, 1000);
      
      return () => clearTimeout(preloadTimer);
    }
  }, [currentUserId, preloadUserStats]);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await loadSuggestedUsers(true);
      console.log('Manual refresh completed');

    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadSuggestedUsers]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);
      const results = await searchUsers(query.trim());
      setSearchResults(results);
      
      await Promise.all([
        loadFollowingStatusForUsers(results),
        loadUserStatsForUsers(results)
      ]);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchUsers, loadFollowingStatusForUsers, loadUserStatsForUsers]);

  const handleToggleFollow = useCallback(async (userId: string) => {
    if (!currentUserId) return;
    
    try {
      setActionLoading(prev => ({ ...prev, [userId]: true }));
      
      const isCurrentlyFollowing = followingStatus[userId];
      let success = false;
      
      if (isCurrentlyFollowing) {
        success = await unfollowUser(userId);
      } else {
        success = await followUser(userId);
      }
      
      if (success) {
        setFollowingStatus(prev => ({ ...prev, [userId]: !isCurrentlyFollowing }));
        
        const newStats = await getUserStats(userId);
        setUserStats(prev => ({ 
          ...prev, 
          [userId]: { followers: newStats.followersCount, following: newStats.followingCount }
        }));
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  }, [currentUserId, followingStatus, followUser, unfollowUser, getUserStats]);

  const getProfileImageUrl = (user: UserProfile) => {
    if (user.profileImage && !user.profileImage.startsWith('data:image/svg+xml')) {
      console.log(`Using custom profile image for ${user.displayName}:`, user.profileImage);
      return user.profileImage;
    }
    console.log(`Using placeholder for ${user.displayName}`);
    return '/PPplaceholder-modified.png';
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.opacity = '1';
    console.log('Image loaded successfully:', img.src);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    console.warn('Failed to load profile image:', img.src);
    if (!img.src.includes('PPplaceholder-modified.png')) {
      img.src = '/PPplaceholder-modified.png';
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatLastUpdateTime = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  // FIXED UserCard component - prevents hover flickering
  const UserCard = ({ user, showFollowButton = true }: { user: UserProfile; showFollowButton?: boolean }) => {
    const isFollowing = followingStatus[user.id] || false;
    const stats = userStats[user.id] || { followers: 0, following: 0 };
    const isLoading = actionLoading[user.id] || false;
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div 
        className="user-card-container bg-spotify-gray/80 rounded-lg p-4 backdrop-blur-sm border border-transparent cursor-pointer overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: isHovered ? 'rgba(40, 40, 40, 1)' : 'rgba(40, 40, 40, 0.8)',
          borderColor: isHovered ? 'rgba(30, 215, 96, 0.2)' : 'transparent',
          transition: 'all 0.2s ease-out'
        }}
      >
        <div className="flex items-center space-x-4">
          {/* Profile Image */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700/50">
              <img
                src={getProfileImageUrl(user)}
                alt={user.displayName}
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="eager"
                decoding="async"
              />
            </div>
            {isFollowing && (
              <div className="absolute -bottom-1 -right-1 bg-spotify-green rounded-full p-1">
                <UserCheck className="w-3 h-3 text-black" />
              </div>
            )}
          </div>
          
          {/* User Info - Using inline styles to prevent flickering */}
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-lg truncate"
              style={{
                color: isHovered ? '#1ed760' : '#ffffff',
                transition: 'color 0.2s ease-out'
              }}
            >
              {user.displayName}
            </h3>
            <p 
              className="text-sm truncate"
              style={{
                color: isHovered ? 'rgba(255, 255, 255, 0.9)' : '#b3b3b3',
                transition: 'color 0.2s ease-out'
              }}
            >
              @{getUserTag(user)}
            </p>
            
            {/* Stats - Fixed colors to prevent flickering */}
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Heart 
                  className="w-4 h-4"
                  style={{
                    color: isHovered ? '#ef4444' : '#f87171',
                    transition: 'color 0.2s ease-out'
                  }}
                />
                <span 
                  className="text-sm"
                  style={{
                    color: isHovered ? '#ffffff' : '#b3b3b3',
                    transition: 'color 0.2s ease-out'
                  }}
                >
                  {formatCount(stats.followers)} followers
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye 
                  className="w-4 h-4"
                  style={{
                    color: isHovered ? '#3b82f6' : '#60a5fa',
                    transition: 'color 0.2s ease-out'
                  }}
                />
                <span 
                  className="text-sm"
                  style={{
                    color: isHovered ? '#ffffff' : '#b3b3b3',
                    transition: 'color 0.2s ease-out'
                  }}
                >
                  {formatCount(stats.following)} following
                </span>
              </div>
            </div>
            
            {/* Bio */}
            {user.bio && (
              <p 
                className="text-xs mt-1 truncate"
                style={{
                  color: isHovered ? 'rgba(255, 255, 255, 0.8)' : '#b3b3b3',
                  transition: 'color 0.2s ease-out'
                }}
              >
                {user.bio}
              </p>
            )}
          </div>
          
          {/* Follow Button */}
          {showFollowButton && currentUser?.id !== user.id && (
            <div className="flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFollow(user.id);
                }}
                disabled={isLoading}
                className={`px-4 py-2 rounded-full font-semibold text-sm min-w-[90px] border-2 transition-all duration-200 ease-out ${
                  isFollowing
                    ? 'bg-transparent border-spotify-green text-spotify-green hover:bg-spotify-green hover:text-black'
                    : 'bg-spotify-green border-spotify-green text-black hover:bg-spotify-green/90'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : isFollowing ? (
                  <span className="flex items-center space-x-1">
                    <UserMinus className="w-4 h-4" />
                    <span>Unfollow</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1">
                    <UserPlus className="w-4 h-4" />
                    <span>Follow</span>
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
        ease: [0.6, -0.05, 0.01, 0.99] as [number, number, number, number],
        duration: 0.6
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0, scale: 0.95 },
    visible: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 25
      }
    }
  };

  // Loading state
  if (isInitializing || isLoading) {
    return (
      <motion.div 
        className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div 
          className="p-6 pb-4"
          variants={itemVariants}
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-white">Friends</h1>
            
            <div className="flex items-center space-x-3">
              <div className="text-xs text-spotify-light-gray">
                Loading...
              </div>
              <button
                disabled
                className="flex items-center space-x-2 px-3 py-2 bg-spotify-gray opacity-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Loading"
              >
                <RefreshCw className="w-4 h-4 text-spotify-light-gray animate-spin" />
                <span className="text-xs text-spotify-light-gray">
                  Loading...
                </span>
              </button>
            </div>
          </div>
          
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-spotify-light-gray" />
            <input
              type="text"
              placeholder="Search for friends by name..."
              disabled
              className="w-full bg-spotify-gray text-white pl-10 pr-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-spotify-green placeholder-spotify-light-gray opacity-50 cursor-not-allowed"
            />
          </div>
        </motion.div>
        
        <div className="px-6 pb-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <motion.div 
        className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div 
          className="p-6 pb-4"
          variants={itemVariants}
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-white">Friends</h1>
            
            <div className="flex items-center space-x-3">
              <div className="text-xs text-spotify-light-gray">
                Sign in required
              </div>
              <button
                disabled
                className="flex items-center space-x-2 px-3 py-2 bg-spotify-gray opacity-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sign in to refresh"
              >
                <RefreshCw className="w-4 h-4 text-spotify-light-gray" />
                <span className="text-xs text-spotify-light-gray">
                  Refresh
                </span>
              </button>
            </div>
          </div>
          
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-spotify-light-gray" />
            <input
              type="text"
              placeholder="Search for friends by name..."
              disabled
              className="w-full bg-spotify-gray text-white pl-10 pr-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-spotify-green placeholder-spotify-light-gray opacity-50 cursor-not-allowed"
            />
          </div>
        </motion.div>
        
        <div className="px-6 pb-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-md">
              <Users className="w-16 h-16 text-spotify-light-gray mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to Find Friends</h2>
              <p className="text-spotify-light-gray">
                Connect with other music lovers and discover new songs together.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Main authenticated content
  return (
    <motion.div 
      className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div 
        className="p-6 pb-4"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Friends</h1>
          
          <div className="flex items-center space-x-3">
            {lastUpdateTime && (
              <div className="text-xs text-spotify-light-gray">
                Updated {formatLastUpdateTime(lastUpdateTime)}
              </div>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingSuggestions}
              className="flex items-center space-x-2 px-3 py-2 bg-spotify-gray hover:bg-opacity-80 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh suggestions"
            >
              <RefreshCw 
                className={`w-4 h-4 text-spotify-light-gray ${
                  isRefreshing ? 'animate-spin' : ''
                }`} 
              />
              <span className="text-xs text-spotify-light-gray">
                {isRefreshing ? 'Updating...' : 'Refresh'}
              </span>
            </button>
          </div>
        </div>
        
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-spotify-light-gray" />
          <input
            type="text"
            placeholder="Search for friends by name..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-spotify-gray text-white pl-10 pr-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-spotify-green placeholder-spotify-light-gray"
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'a') {
                e.stopPropagation();
              }
            }}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-spotify-light-gray animate-spin" />
          )}
        </div>
        
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
              activeTab === 'suggestions'
                ? 'bg-spotify-green text-black'
                : 'bg-transparent text-spotify-light-gray hover:text-white'
            }`}
          >
            Suggested
          </button>
          {searchQuery.trim().length >= 2 && (
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                activeTab === 'search'
                  ? 'bg-spotify-green text-black'
                  : 'bg-transparent text-spotify-light-gray hover:text-white'
              }`}
            >
              Search Results ({searchResults.length})
            </button>
          )}
        </div>
      </motion.div>

      <div className="px-6 pb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && searchQuery.trim().length >= 2 && (
            <motion.div
              key="search-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {searchResults.length > 0 ? (
                <>
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Search Results for "{searchQuery}"
                  </h2>
                  {searchResults.map((user, index) => (
                    <div
                      key={user.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <UserCard user={user} />
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-12">
                  <Search className="w-16 h-16 text-spotify-light-gray mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No users found</h3>
                  <p className="text-spotify-light-gray">
                    Try searching with a different name or username.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'suggestions' && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold text-white mb-4">
                People you might know
              </h2>
              
              {isLoadingSuggestions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
                </div>
              ) : suggestedUsers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestedUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="animate-fadeIn"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <UserCard user={user} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-spotify-light-gray mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No suggestions yet</h3>
                  <p className="text-spotify-light-gray">
                    Try searching for friends using the search bar above.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Friends;