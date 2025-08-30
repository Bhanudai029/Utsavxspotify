import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { getUserTag } from '../lib/firebaseService';
import type { UserProfile } from '../lib/firebaseService';

const Following = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { 
    currentUser, 
    getUserFollowing, 
    getUserStats,
    followUser,
    unfollowUser,
    checkIsFollowing,
    isAuthenticated 
  } = useUser();

  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userStats, setUserStats] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [followingStatus, setFollowingStatus] = useState<{ [key: string]: boolean }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [targetUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string>('');

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = targetUserId === currentUser?.id;

  // Load following data
  const loadFollowing = useCallback(async () => {
    if (!targetUserId) {
      setError('User not found');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Load following and stats in parallel
      const [followingData, statsData] = await Promise.all([
        getUserFollowing(targetUserId),
        getUserStats(targetUserId)
      ]);

      setFollowing(followingData);
      setUserStats({
        followers: statsData.followersCount,
        following: statsData.followingCount
      });

      // If viewing another user's following, load following status for each user
      if (!isOwnProfile && currentUser) {
        const statusPromises = followingData.map(user => 
          checkIsFollowing(user.id).then(isFollowing => ({ userId: user.id, isFollowing }))
        );
        
        const statuses = await Promise.all(statusPromises);
        const statusMap = statuses.reduce((acc, { userId, isFollowing }) => {
          acc[userId] = isFollowing;
          return acc;
        }, {} as { [key: string]: boolean });
        
        setFollowingStatus(statusMap);
      } else if (isOwnProfile) {
        // If it's own profile, all users in following list are followed by current user
        const statusMap = followingData.reduce((acc, user) => {
          acc[user.id] = true;
          return acc;
        }, {} as { [key: string]: boolean });
        
        setFollowingStatus(statusMap);
      }

    } catch (error) {
      console.error('Error loading following:', error);
      setError('Failed to load following');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, getUserFollowing, getUserStats, checkIsFollowing, currentUser, isOwnProfile]);

  // Load following on component mount
  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  // Handle follow/unfollow action
  const handleToggleFollow = useCallback(async (userId: string) => {
    if (!currentUser || userId === currentUser.id) return;
    
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
        
        // If it's own profile and we unfollowed someone, remove them from the list
        if (isOwnProfile && isCurrentlyFollowing) {
          setFollowing(prev => prev.filter(user => user.id !== userId));
          setUserStats(prev => ({ ...prev, following: prev.following - 1 }));
        }
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  }, [currentUser, followingStatus, followUser, unfollowUser, isOwnProfile]);

  // Get profile image URL
  const getProfileImageUrl = (user: UserProfile) => {
    if (user.profileImage && user.profileImage !== '/PPplaceholder-modified.png') {
      return user.profileImage;
    }
    return '/PPplaceholder-modified.png';
  };

  // Format count for display
  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
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

  // User card component
  const UserCard = ({ user }: { user: UserProfile }) => {
    const isFollowing = followingStatus[user.id] || false;
    const isLoading = actionLoading[user.id] || false;
    const isCurrentUser = user.id === currentUser?.id;

    return (
      <motion.div
        className="bg-spotify-gray rounded-lg p-4 hover:bg-opacity-80 transition-all duration-200"
        variants={itemVariants}
        layout
        exit={{ opacity: 0, x: -100 }}
      >
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="w-16 h-16 flex-shrink-0">
            <img 
              src={getProfileImageUrl(user)} 
              alt={user.displayName}
              className="w-full h-full object-cover rounded-full border-2 border-spotify-light-gray"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/PPplaceholder-modified.png';
              }}
            />
          </div>
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-lg truncate">
              {user.displayName}
            </h3>
            <p className="text-spotify-light-gray text-sm truncate">
              @{getUserTag(user)}
            </p>
            
            {/* Bio */}
            {user.bio && (
              <p className="text-spotify-light-gray text-xs mt-1 truncate">
                {user.bio}
              </p>
            )}
          </div>
          
          {/* Follow Button */}
          {!isCurrentUser && isAuthenticated && (
            <motion.button
              onClick={() => handleToggleFollow(user.id)}
              disabled={isLoading}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex items-center space-x-2 ${
                isFollowing
                  ? 'bg-transparent border border-spotify-light-gray text-white hover:bg-red-600 hover:border-red-600'
                  : 'bg-spotify-green text-black hover:bg-spotify-green/90'
              } disabled:opacity-50`}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isFollowing ? (
                    <UserMinus className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>{isFollowing ? 'Unfollow' : 'Follow'}</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-spotify-dark to-spotify-black">
        <div className="text-center">
          <Users className="w-16 h-16 text-spotify-light-gray mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
          <p className="text-spotify-light-gray">Please log in to view following</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="h-full overflow-y-auto scrollbar-hide bg-gradient-to-b from-spotify-dark to-spotify-black"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div 
        className="relative p-6 pb-8"
        variants={itemVariants}
      >
        {/* Back Button */}
        <motion.button 
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 p-2 hover:bg-spotify-gray rounded-full transition-colors z-10"
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="text-white" size={24} />
        </motion.button>
        
        {/* Centered Header Content */}
        <div className="text-center pt-8">
          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-3">
            {formatCount(userStats.following)}
          </h1>
          
          {/* Subtitle */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Users className="w-5 h-5 text-spotify-light-gray" />
            <p className="text-lg md:text-xl text-spotify-light-gray font-medium">
              following
            </p>
          </div>
          
          {/* Context Text */}
          <p className="text-spotify-light-gray text-sm md:text-base max-w-md mx-auto leading-relaxed">
            {isOwnProfile 
              ? 'Artists and friends you follow' 
              : `People ${targetUserProfile?.displayName || 'this user'} follows`
            }
          </p>
        </div>
      </motion.div>

      {/* Content */}
      <div className="px-6 md:px-12 lg:px-24 xl:px-32 pb-8 pt-2">
        {error && (
          <motion.div 
            className="bg-red-600/20 border border-red-600 rounded-lg p-4 mb-6 max-w-2xl mx-auto"
            variants={itemVariants}
          >
            <p className="text-red-400 text-center">{error}</p>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
          </div>
        ) : following.length > 0 ? (
          <motion.div 
            className="space-y-4 max-w-4xl mx-auto"
            variants={containerVariants}
          >
            <AnimatePresence>
              {following.map((user) => (
                <UserCard key={user.id} user={user} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div 
            className="text-center py-12 max-w-md mx-auto"
            variants={itemVariants}
          >
            <Users className="w-16 h-16 text-spotify-light-gray mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Not following anyone</h3>
            <p className="text-spotify-light-gray">
              {isOwnProfile 
                ? "Discover and follow people to see them here." 
                : "This user isn't following anyone yet."
              }
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Following;