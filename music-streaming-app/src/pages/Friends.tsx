import React, { useState, useEffect, useCallback, useMemo, useLayoutEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, UserPlus, UserMinus, Loader2, Heart, UserCheck, RefreshCw } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { getUserTag } from '../lib/firebaseService';
import { cacheService } from '../lib/cacheService';
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
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
  // Refs to prevent re-renders during hover - Anti-flickering solution
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const renderingFrozen = useRef<{ [key: string]: boolean }>({});

  const currentUserId = useMemo(() => currentUser?.id, [currentUser?.id]);

  // Use layoutEffect to prevent flickering during DOM updates
  useLayoutEffect(() => {
    const initTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 300); // Reduced from 500ms for faster response
    
    return () => clearTimeout(initTimer);
  }, []);

  // Memoized data loading functions with cache integration
  const loadFollowingStatusForUsers = useCallback(async (users: UserProfile[]) => {
    if (!currentUserId || users.length === 0) return;
    
    // First, load from cache and set immediately to prevent flickering
    const cacheStatusMap: { [key: string]: boolean } = {};
    const usersToFetch: UserProfile[] = [];
    
    users.forEach(user => {
      const cachedStatus = cacheService.getCachedFollowingStatus(user.id);
      if (cachedStatus !== null) {
        cacheStatusMap[user.id] = cachedStatus;
      } else {
        usersToFetch.push(user);
      }
    });
    
    // Immediately set cached data to prevent flickering
    if (Object.keys(cacheStatusMap).length > 0) {
      setFollowingStatus(prev => ({ ...prev, ...cacheStatusMap }));
    }
    
    // Only fetch data for users not in cache
    if (usersToFetch.length === 0) return;
    
    const statusPromises = usersToFetch.map(user => 
      checkIsFollowing(user.id).then(isFollowing => {
        // Cache the result
        cacheService.setCachedFollowingStatus(user.id, isFollowing);
        return { userId: user.id, isFollowing };
      })
    );
    
    const statuses = await Promise.all(statusPromises);
    const statusMap = statuses.reduce((acc, { userId, isFollowing }) => {
      acc[userId] = isFollowing;
      return acc;
    }, {} as { [key: string]: boolean });
    
    setFollowingStatus(prev => ({ ...prev, ...statusMap }));
  }, [currentUserId, checkIsFollowing]);

  const loadUserStatsForUsers = useCallback(async (users: UserProfile[]) => {
    if (users.length === 0) return;
    
    // First, load from cache and set immediately to prevent flickering
    const cacheStatsMap: { [key: string]: { followers: number; following: number } } = {};
    const usersToFetch: UserProfile[] = [];
    
    users.forEach(user => {
      const cachedStats = cacheService.getCachedUserStats(user.id);
      if (cachedStats) {
        cacheStatsMap[user.id] = { followers: cachedStats.followersCount, following: cachedStats.followingCount };
      } else {
        usersToFetch.push(user);
      }
    });
    
    // Immediately set cached data to prevent flickering
    if (Object.keys(cacheStatsMap).length > 0) {
      setUserStats(prev => ({ ...prev, ...cacheStatsMap }));
    }
    
    // Only fetch data for users not in cache
    if (usersToFetch.length === 0) return;
    
    const statsPromises = usersToFetch.map(user => 
      getUserStats(user.id).then(stats => {
        // Cache the result
        cacheService.setCachedUserStats(user.id, { followersCount: stats.followersCount, followingCount: stats.followingCount });
        return { userId: user.id, stats };
      })
    );
    
    const allStats = await Promise.all(statsPromises);
    const statsMap = allStats.reduce((acc, { userId, stats }) => {
      acc[userId] = { followers: stats.followersCount, following: stats.followingCount };
      return acc;
    }, {} as { [key: string]: { followers: number; following: number } });
    
    setUserStats(prev => ({ ...prev, ...statsMap }));
  }, [getUserStats]);

  // Optimized suggested users loading with cache integration
  const loadSuggestedUsers = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && now - lastLoadTime < 30000) {
      console.log('Skipping suggested users reload - too soon since last load');
      return;
    }

    try {
      setIsLoadingSuggestions(true);
      
      // First, try to load from cache to prevent flickering
      if (!forceRefresh) {
        const cachedSuggestions = cacheService.getCachedSuggestedUsers();
        if (cachedSuggestions && cachedSuggestions.length > 0) {
          console.log('Loading suggested users from cache');
          setSuggestedUsers(cachedSuggestions);
          
          // Load cached data for these users
          await Promise.all([
            loadFollowingStatusForUsers(cachedSuggestions),
            loadUserStatsForUsers(cachedSuggestions)
          ]);
          
          setIsLoadingSuggestions(false);
          
          // Fetch fresh data in background
          setTimeout(async () => {
            try {
              const freshSuggestions = await getSuggestedUsers(12);
              cacheService.setCachedSuggestedUsers(freshSuggestions);
              setSuggestedUsers(freshSuggestions);
              
              await Promise.all([
                loadFollowingStatusForUsers(freshSuggestions),
                loadUserStatsForUsers(freshSuggestions)
              ]);
            } catch (error) {
              console.error('Background refresh failed:', error);
            }
          }, 1000);
          
          return;
        }
      }
      
      setLastLoadTime(now);
      const suggestions = await getSuggestedUsers(12);
      
      // Cache the results
      cacheService.setCachedSuggestedUsers(suggestions);
      
      // Use layoutEffect pattern to prevent flickering
      requestAnimationFrame(() => {
        setSuggestedUsers(suggestions);
      });
      
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
  }, [getSuggestedUsers, loadFollowingStatusForUsers, loadUserStatsForUsers, lastLoadTime]);

  useEffect(() => {
    if (isAuthenticated && currentUserId) {
      loadSuggestedUsers(true);
    }
  }, [isAuthenticated, currentUserId]);

  // Cleanup expired cache on mount and unmount
  useEffect(() => {
    // Clear expired cache on mount
    cacheService.clearExpiredCache();
    
    return () => {
      // Clear expired cache on unmount
      cacheService.clearExpiredCache();
    };
  }, []);

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

  // Optimized search with cache integration
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);
      
      // Try to load from cache first
      const cachedResults = cacheService.getCachedSearchResults(query.trim());
      if (cachedResults) {
        console.log('Loading search results from cache');
        setSearchResults(cachedResults);
        
        // Load cached data for these users
        await Promise.all([
          loadFollowingStatusForUsers(cachedResults),
          loadUserStatsForUsers(cachedResults)
        ]);
        
        setIsSearching(false);
        return;
      }
      
      const results = await searchUsers(query.trim());
      
      // Cache the results
      cacheService.setCachedSearchResults(query.trim(), results);
      
      // Use layoutEffect pattern for smooth updates
      requestAnimationFrame(() => {
        setSearchResults(results);
      });
      
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

  // Optimized follow toggle with cache updates
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
        const newFollowingStatus = !isCurrentlyFollowing;
        
        // Update following status immediately for better UX
        setFollowingStatus(prev => ({ ...prev, [userId]: newFollowingStatus }));
        
        // Update cache immediately
        cacheService.setCachedFollowingStatus(userId, newFollowingStatus);
        
        // Update stats optimistically
        setUserStats(prev => {
          const currentStats = prev[userId] || { followers: 0, following: 0 };
          const newStats = {
            ...currentStats,
            followers: currentStats.followers + (isCurrentlyFollowing ? -1 : 1)
          };
          
          // Update cache with new stats
          cacheService.setCachedUserStats(userId, { 
            followersCount: newStats.followers, 
            followingCount: newStats.following 
          });
          
          return { ...prev, [userId]: newStats };
        });
        
        // Fetch actual stats in background without blocking UI
        setTimeout(async () => {
          try {
            const newStats = await getUserStats(userId);
            const updatedStats = { followers: newStats.followersCount, following: newStats.followingCount };
            
            setUserStats(prev => ({ ...prev, [userId]: updatedStats }));
            
            // Update cache with fresh stats
            cacheService.setCachedUserStats(userId, newStats);
          } catch (error) {
            console.warn('Failed to refresh stats:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  }, [currentUserId, followingStatus, followUser, unfollowUser, getUserStats]);

  // Anti-flickering: Completely freeze rendering during hover to prevent flickering
  const freezeRendering = useCallback((userId: string) => {
    renderingFrozen.current[userId] = true;
    const cardRef = cardRefs.current[userId];
    if (cardRef) {
      // Apply hardware acceleration and containment
      cardRef.style.transform = 'translate3d(0, 0, 0)';
      cardRef.style.willChange = 'transform, opacity';
      cardRef.style.contain = 'layout style paint';
    }
  }, []);

  const unfreezeRendering = useCallback((userId: string) => {
    renderingFrozen.current[userId] = false;
    const cardRef = cardRefs.current[userId];
    if (cardRef) {
      cardRef.style.willChange = 'auto';
    }
  }, []);



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

  // Ultra-optimized UserCard with frozen rendering during hover - ANTI-FLICKERING SOLUTION
  const OptimizedUserCard = memo(({ user }: { user: UserProfile }) => {
    const isFollowing = followingStatus[user.id] || false;
    const stats = userStats[user.id] || { followers: 0, following: 0 };
    const isLoading = actionLoading[user.id] || false;
    const isCardHovered = hoveredCardId === user.id;

    // Memoized static data that never changes during hover
    const cardStaticData = useMemo(() => ({
      profileImageUrl: user.profileImage || '/PPplaceholder-modified.png',
      userTag: getUserTag(user),
      displayName: user.displayName,
      userId: user.id,
      formattedFollowers: stats.followers >= 1000000 
        ? `${(stats.followers / 1000000).toFixed(1)}M`
        : stats.followers >= 1000 
        ? `${(stats.followers / 1000).toFixed(1)}K` 
        : stats.followers.toString(),
      formattedFollowing: stats.following >= 1000 
        ? `${(stats.following / 1000).toFixed(1)}K` 
        : stats.following.toString(),
      bio: user.bio || ''
    }), [user, stats.followers, stats.following]);

    // Optimized hover handlers with rendering freeze - isolated per card
    const handleMouseEnter = useCallback(() => {
      setHoveredCardId(user.id);
      freezeRendering(user.id);
    }, [user.id, freezeRendering]);

    const handleMouseLeave = useCallback(() => {
      setHoveredCardId(null);
      // Delay unfreeze slightly to ensure smooth animation completion
      setTimeout(() => unfreezeRendering(user.id), 150);
    }, [user.id, unfreezeRendering]);

    // Prevent image re-rendering on error
    const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (!img.src.includes('PPplaceholder-modified.png')) {
        img.src = '/PPplaceholder-modified.png';
      }
    }, []);

    const handleFollowClick = useCallback((e: React.MouseEvent) => {
      if (renderingFrozen.current[user.id]) return;
      e.stopPropagation();
      handleToggleFollow(user.id);
    }, [user.id]);

    return (
      <div 
        ref={(el) => {
          cardRefs.current[user.id] = el;
        }}
        className="bg-spotify-gray/80 rounded-lg p-4 backdrop-blur-sm border cursor-pointer transition-colors duration-200 overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundColor: isCardHovered ? 'rgba(40, 40, 40, 0.9)' : 'rgba(40, 40, 40, 0.8)',
          borderColor: isCardHovered ? '#1DB954' : 'rgb(75, 85, 99)'
        }}
      >
        <div className="flex items-center space-x-4">
          {/* Profile Image */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700/50">
              <img
                src={cardStaticData.profileImageUrl}
                alt={cardStaticData.displayName}
                className="w-full h-full object-cover"
                onError={handleImageError}
                loading="eager"
                style={{
                  backgroundColor: 'transparent'
                }}
              />
            </div>
            {isFollowing && (
              <div className="absolute -bottom-1 -right-1 bg-spotify-green rounded-full p-1">
                <UserCheck className="w-3 h-3 text-black" />
              </div>
            )}
          </div>
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-lg truncate transition-colors duration-200"
              style={{ color: isCardHovered ? '#1DB954' : 'white' }}
            >
              {cardStaticData.displayName}
            </h3>
            <p 
              className="text-sm truncate transition-colors duration-200"
              style={{ color: isCardHovered ? 'rgba(255, 255, 255, 0.9)' : '#b3b3b3' }}
            >
              @{cardStaticData.userTag}
            </p>
            
            {/* Stats */}
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Heart 
                  className="w-4 h-4 transition-colors duration-200" 
                  style={{ color: isCardHovered ? '#ef4444' : '#b3b3b3' }}
                />
                <span 
                  className="text-sm transition-colors duration-200"
                  style={{ color: isCardHovered ? 'white' : '#b3b3b3' }}
                >
                  {cardStaticData.formattedFollowers} followers
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Users 
                  className="w-4 h-4 transition-colors duration-200" 
                  style={{ color: isCardHovered ? '#3b82f6' : '#b3b3b3' }}
                />
                <span 
                  className="text-sm transition-colors duration-200"
                  style={{ color: isCardHovered ? 'white' : '#b3b3b3' }}
                >
                  {cardStaticData.formattedFollowing} following
                </span>
              </div>
            </div>
            
            {/* Bio */}
            {cardStaticData.bio && (
              <p 
                className="text-xs mt-1 truncate transition-colors duration-200"
                style={{ color: isCardHovered ? 'rgba(255, 255, 255, 0.8)' : '#b3b3b3' }}
              >
                {cardStaticData.bio}
              </p>
            )}
          </div>
          
          {/* Follow Button */}
          <div className="flex-shrink-0">
            {currentUser?.id !== cardStaticData.userId && (
              <button
                onClick={handleFollowClick}
                disabled={isLoading}
                className={`px-4 py-2 rounded-full font-semibold text-sm min-w-[90px] border-2 transition-colors duration-200 ${
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
            )}
          </div>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Ultra-strict equality check to prevent ANY re-renders during hover
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.user.displayName === nextProps.user.displayName &&
      prevProps.user.profileImage === nextProps.user.profileImage
    );
  });

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
                      <OptimizedUserCard user={user} />
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
                      <OptimizedUserCard user={user} />
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