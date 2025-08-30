import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { 
  getUserLikedSongs, 
  addLikedSong, 
  removeLikedSong, 
  subscribeToUserLikedSongs,
  updateUserProfileImage,
  followUser,
  unfollowUser,
  isFollowing,
  getUserFollowers,
  getUserFollowing,
  searchUsers,
  getUserStats,
  getSuggestedUsers,
  getUserProfile,
  migrateUsersToHaveUsername,
  type UserProfile 
} from '../lib/firebaseService';

interface UserContextType {
  currentUser: UserProfile | null;
  likedSongs: string[];
  isAuthenticated: boolean;
  userStats: { followersCount: number; followingCount: number } | null;
  isStatsLoading: boolean;
  login: (userProfile: UserProfile) => Promise<void>;
  logout: () => void;
  toggleLikedSong: (songId: string) => Promise<boolean>;
  updateProfileImage: (imageUrl: string) => Promise<{ success: boolean; error?: string }>;
  followUser: (targetUserId: string) => Promise<boolean>;
  unfollowUser: (targetUserId: string) => Promise<boolean>;
  checkIsFollowing: (targetUserId: string) => Promise<boolean>;
  getUserFollowers: (userId: string) => Promise<UserProfile[]>;
  getUserFollowing: (userId: string) => Promise<UserProfile[]>;
  searchUsers: (query: string) => Promise<UserProfile[]>;
  getUserStats: (userId: string) => Promise<{ followersCount: number; followingCount: number }>;
  getSuggestedUsers: (limit?: number) => Promise<UserProfile[]>;
  preloadUserStats: () => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [likedSongs, setLikedSongs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationRun, setMigrationRun] = useState(false);
  const [userStats, setUserStats] = useState<{ followersCount: number; followingCount: number } | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Sync user profile data from Firebase to get latest changes
  const syncUserProfileFromFirebase = async (userId: string) => {
    try {
      console.log('🔄 Syncing user profile from Firebase for user:', userId);
      const latestUserData = await getUserProfile(userId);
      
      if (latestUserData) {
        // Update current user state with latest data from Firebase
        setCurrentUser(latestUserData);
        localStorage.setItem('currentUser', JSON.stringify(latestUserData));
        
        console.log('✅ Profile synced successfully:', {
          userId: latestUserData.id,
          displayName: latestUserData.displayName,
          hasProfileImage: !!latestUserData.profileImage,
          profileImageType: latestUserData.profileImage ? 
            (latestUserData.profileImage.startsWith('data:image/') ? 'base64' : 'url') : 'none'
        });
      } else {
        console.warn('⚠️ User profile not found in Firebase, clearing local session');
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('❌ Error syncing user profile from Firebase:', error);
    }
  };

  // Check for existing session on mount and sync profile data
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userProfile = JSON.parse(savedUser) as UserProfile;
        setCurrentUser(userProfile);
        loadUserLikedSongs(userProfile.id);
        
        // Sync profile data from Firebase to get latest changes (like profile image)
        syncUserProfileFromFirebase(userProfile.id);
        
        // Run migration once per session to ensure all users have username field
        if (!migrationRun) {
          migrateUsersToHaveUsername().catch(console.error);
          setMigrationRun(true);
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, [migrationRun]);

  // Load user's liked songs
  const loadUserLikedSongs = async (userId: string) => {
    try {
      setIsLoading(true);
      const userLikedSongs = await getUserLikedSongs(userId);
      setLikedSongs(userLikedSongs);
      console.log(`Loaded ${userLikedSongs.length} liked songs for user ${userId}`);
    } catch (error) {
      console.error('Error loading user liked songs:', error);
      setLikedSongs([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time listener for liked songs
  useEffect(() => {
    if (currentUser) {
      console.log(`Setting up real-time listener for user ${currentUser.id}`);
      const unsubscribe = subscribeToUserLikedSongs(currentUser.id, (updatedLikedSongs) => {
        setLikedSongs(updatedLikedSongs);
        console.log(`Real-time update: User ${currentUser.id} has ${updatedLikedSongs.length} liked songs`);
      });

      return () => {
        console.log(`Cleaning up listener for user ${currentUser.id}`);
        unsubscribe();
      };
    }
  }, [currentUser]);

  // Login function with profile sync
  const login = async (userProfile: UserProfile) => {
    setCurrentUser(userProfile);
    localStorage.setItem('currentUser', JSON.stringify(userProfile));
    console.log(`User ${userProfile.displayName} logged in`);
    
    // Load their liked songs
    loadUserLikedSongs(userProfile.id);
    
    // Sync latest profile data from Firebase to ensure we have current info
    await syncUserProfileFromFirebase(userProfile.id);
    
    // Preload user stats for better profile page performance
    setTimeout(() => {
      preloadUserStats();
    }, 1000); // Delay slightly to not interfere with login process
    
    // Run migration once per session to ensure all users have username field
    if (!migrationRun) {
      migrateUsersToHaveUsername().catch(console.error);
      setMigrationRun(true);
    }
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    setLikedSongs([]);
    setUserStats(null);
    setIsStatsLoading(false);
    localStorage.removeItem('currentUser');
    console.log('User logged out');
  };

  // Toggle liked song
  const toggleLikedSong = async (songId: string): Promise<boolean> => {
    if (!currentUser) {
      console.warn('Cannot toggle liked song: No user logged in');
      return false;
    }

    try {
      const isCurrentlyLiked = likedSongs.includes(songId);
      
      if (isCurrentlyLiked) {
        // Remove from liked songs
        await removeLikedSong(currentUser.id, songId);
        console.log(`Removed song ${songId} from liked songs`);
        return false;
      } else {
        // Add to liked songs
        await addLikedSong(currentUser.id, songId);
        console.log(`Added song ${songId} to liked songs`);
        return true;
      }
    } catch (error) {
      console.error('Error toggling liked song:', error);
      return likedSongs.includes(songId); // Return current state on error
    }
  };

  // Enhanced automatic sync with periodic updates
  useEffect(() => {
    if (currentUser) {
      // Set up periodic auto-sync every 60 seconds (reduced frequency)
      const syncInterval = setInterval(async () => {
        try {
          console.log('🔄 Automatic profile sync check for user:', currentUser.id);
          const latestUserData = await getUserProfile(currentUser.id);
          
          if (latestUserData) {
            // Check for changes
            const hasChanges = 
              currentUser.profileImage !== latestUserData.profileImage ||
              currentUser.displayName !== latestUserData.displayName ||
              currentUser.bio !== latestUserData.bio;
            
            if (hasChanges) {
              console.log('✅ Auto-sync detected changes, updating profile:', {
                profileImageChanged: currentUser.profileImage !== latestUserData.profileImage,
                displayNameChanged: currentUser.displayName !== latestUserData.displayName,
                bioChanged: currentUser.bio !== latestUserData.bio
              });
              
              setCurrentUser(latestUserData);
              localStorage.setItem('currentUser', JSON.stringify(latestUserData));
            }
          }
        } catch (error) {
          console.warn('⚠️ Auto-sync failed:', error);
        }
      }, 60000); // Sync every 60 seconds (reduced from 10 seconds)
      
      return () => clearInterval(syncInterval);
    }
  }, [currentUser?.id]);

  // Preload user stats for better profile page performance
  useEffect(() => {
    if (currentUser?.id && !userStats && !isStatsLoading) {
      preloadUserStats();
    }
  }, [currentUser?.id]);

  // Preload user stats function
  const preloadUserStats = async (): Promise<void> => {
    if (!currentUser?.id || isStatsLoading) {
      return;
    }

    try {
      setIsStatsLoading(true);
      console.log('📊 Preloading user stats for better profile performance...');
      
      const stats = await getUserStats(currentUser.id);
      setUserStats({
        followersCount: stats.followersCount,
        followingCount: stats.followingCount
      });
      
      console.log('✅ User stats preloaded successfully:', stats);
    } catch (error) {
      console.error('❌ Error preloading user stats:', error);
      // Set fallback stats to prevent indefinite loading
      setUserStats({ followersCount: 0, followingCount: 0 });
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Update profile image
  const updateProfileImage = async (imageUrl: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      console.warn('Cannot update profile image: No user logged in');
      return { success: false, error: 'No user logged in' };
    }

    try {
      // Handle deletion (empty string) vs update
      const finalImageUrl = imageUrl.trim() === '' ? null : imageUrl;
      
      const result = await updateUserProfileImage(currentUser.id, finalImageUrl || '');
      
      if (result.success) {
        // Update current user state - null/empty means use default
        const updatedUser = { 
          ...currentUser, 
          profileImage: finalImageUrl || undefined 
        };
        
        console.log('🔄 Updating user context with new profile image:', {
          oldImage: currentUser.profileImage ? currentUser.profileImage.substring(0, 50) + '...' : 'none',
          newImage: finalImageUrl ? finalImageUrl.substring(0, 50) + '...' : 'none'
        });
        
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        if (finalImageUrl) {
          console.log('Profile image updated successfully');
        } else {
          console.log('Profile image deleted, reverted to default');
        }
        
        // Force a longer delay to ensure state propagation and re-render
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      return result;
    } catch (error) {
      console.error('Error updating profile image:', error);
      return { success: false, error: 'Failed to update profile image. Please try again.' };
    }
  };

  // Follow user function
  const handleFollowUser = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) {
      console.warn('Cannot follow user: No user logged in');
      return false;
    }

    try {
      await followUser(currentUser.id, targetUserId);
      console.log(`Followed user ${targetUserId}`);
      
      // Invalidate and refresh preloaded stats
      setTimeout(() => {
        console.log('🔄 Refreshing user stats after follow action...');
        preloadUserStats();
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Error following user:', error);
      return false;
    }
  };

  // Unfollow user function
  const handleUnfollowUser = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) {
      console.warn('Cannot unfollow user: No user logged in');
      return false;
    }

    try {
      await unfollowUser(currentUser.id, targetUserId);
      console.log(`Unfollowed user ${targetUserId}`);
      
      // Invalidate and refresh preloaded stats
      setTimeout(() => {
        console.log('🔄 Refreshing user stats after unfollow action...');
        preloadUserStats();
      }, 500);
      
      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return false;
    }
  };

  // Check if current user is following target user
  const checkIsFollowing = async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) {
      return false;
    }

    try {
      return await isFollowing(currentUser.id, targetUserId);
    } catch (error) {
      console.error('Error checking follow status:', error);
      return false;
    }
  };

  // Get user followers
  const handleGetUserFollowers = async (userId: string): Promise<UserProfile[]> => {
    try {
      return await getUserFollowers(userId);
    } catch (error) {
      console.error('Error getting user followers:', error);
      return [];
    }
  };

  // Get user following
  const handleGetUserFollowing = async (userId: string): Promise<UserProfile[]> => {
    try {
      return await getUserFollowing(userId);
    } catch (error) {
      console.error('Error getting user following:', error);
      return [];
    }
  };

  // Search users
  const handleSearchUsers = async (query: string): Promise<UserProfile[]> => {
    try {
      return await searchUsers(query, currentUser?.id);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  // Get user stats
  const handleGetUserStats = async (userId: string): Promise<{ followersCount: number; followingCount: number }> => {
    try {
      return await getUserStats(userId);
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { followersCount: 0, followingCount: 0 };
    }
  };

  // Get suggested users
  const handleGetSuggestedUsers = async (limit: number = 10): Promise<UserProfile[]> => {
    if (!currentUser) {
      return [];
    }

    try {
      return await getSuggestedUsers(currentUser.id, limit);
    } catch (error) {
      console.error('Error getting suggested users:', error);
      return [];
    }
  };

  const value: UserContextType = {
    currentUser,
    likedSongs,
    isAuthenticated: !!currentUser,
    userStats,
    isStatsLoading,
    login,
    logout,
    toggleLikedSong,
    updateProfileImage,
    followUser: handleFollowUser,
    unfollowUser: handleUnfollowUser,
    checkIsFollowing,
    getUserFollowers: handleGetUserFollowers,
    getUserFollowing: handleGetUserFollowing,
    searchUsers: handleSearchUsers,
    getUserStats: handleGetUserStats,
    getSuggestedUsers: handleGetSuggestedUsers,
    preloadUserStats,
    isLoading
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};