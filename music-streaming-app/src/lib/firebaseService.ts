import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  FieldValue,
  deleteDoc,
  deleteField,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
  id: string;
  name: string; // Lowercase for consistency
  displayName: string; // Original capitalization for display
  username?: string; // Generated username for tags (e.g., @binishghimire)
  passkey: string;
  profileImage?: string; // URL to profile image or null for default
  createdAt: Timestamp | string | FieldValue;
  lastLogin: Timestamp | string | FieldValue;
  loginCount: number;
  deviceInfo?: string;
  likedSongs?: string[]; // Array of song IDs that user has liked
  following?: string[]; // Array of user IDs that this user follows
  followers?: string[]; // Array of user IDs that follow this user
  bio?: string; // User bio/description
}

export interface AnalyticsData {
  totalUsers: number;
  dailyVisits: number;
  totalVisits: number;
  lastUpdated: string;
}

// Collections
const USERS_COLLECTION = 'users';
const ANALYTICS_COLLECTION = 'analytics';

// Utility function to generate username from display name
export const generateUsername = (displayName: string): string => {
  return displayName
    .toLowerCase() // Convert to lowercase
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
    .replace(/\s+/g, '') // Remove all spaces
    .trim();
};

// Utility function to get user's tag/handle for display
export const getUserTag = (user: UserProfile): string => {
  // Use the username field if available, otherwise generate from displayName, fallback to name
  if (user.username) {
    return user.username;
  }
  if (user.displayName) {
    return generateUsername(user.displayName);
  }
  return user.name;
};

// Migration function to add username field to existing users
export const migrateUsersToHaveUsername = async (): Promise<void> => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    
    const updatePromises: Promise<void>[] = [];
    
    snapshot.forEach((doc) => {
      const userData = doc.data() as UserProfile;
      
      // If user doesn't have username field, add it
      if (!userData.username) {
        const displayName = userData.displayName || userData.name;
        const username = generateUsername(displayName);
        
        console.log(`Migrating user ${userData.id}: adding username "${username}"`);
        
        const updatePromise = updateDoc(doc.ref, {
          username: username
        });
        
        updatePromises.push(updatePromise);
      }
    });
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ Successfully migrated ${updatePromises.length} users to have username field`);
    } else {
      console.log('✅ All users already have username field');
    }
  } catch (error) {
    console.error('❌ Error migrating users:', error);
    throw error;
  }
};

// Create or update user profile
export const createUserProfile = async (name: string, passkey: string): Promise<UserProfile | null> => {
  try {
    const userId = name.toLowerCase().trim();
    const userRef = doc(db, USERS_COLLECTION, userId);
    
    // Check if user already exists
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfile;
      // Check if passkey matches
      if (userData.passkey === passkey) {
        // Auto-login existing user
        const updateData: any = {
          lastLogin: serverTimestamp(),
          loginCount: (userData.loginCount || 0) + 1
        };
        
        // If displayName doesn't exist, add it with proper capitalization
        if (!userData.displayName) {
          updateData.displayName = name.trim(); // Use the original input name
          updateData.username = generateUsername(name.trim()); // Generate username for tags
          console.log(`Adding displayName "${name.trim()}" and username "${generateUsername(name.trim())}" to existing user "${userId}" during auto-login`);
        }
        
        // If username doesn't exist, generate it from displayName
        if (!userData.username && userData.displayName) {
          updateData.username = generateUsername(userData.displayName);
          console.log(`Adding username "${generateUsername(userData.displayName)}" to existing user "${userId}" during auto-login`);
        }
        
        await updateDoc(userRef, updateData);
        
        // Fetch the latest user data to ensure profile image sync across devices
        const updatedUserSnap = await getDoc(userRef);
        const updatedUserData = updatedUserSnap.data() as UserProfile;
        
        return {
          ...updatedUserData,
          displayName: updatedUserData.displayName || name.trim(),
          lastLogin: new Date().toISOString(),
          loginCount: (updatedUserData.loginCount || 0) + 1
        };
      } else {
        throw new Error('User already exists with different passkey');
      }
    }
    
    // Create new user
    const newUser: UserProfile = {
      id: userId,
      name: userId, // Store in lowercase for consistency
      displayName: name.trim(), // Preserve original capitalization
      username: generateUsername(name.trim()), // Generate username for tags
      passkey,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      loginCount: 1,
      deviceInfo: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      likedSongs: [], // Initialize empty liked songs array
      following: [], // Initialize empty following array
      followers: [], // Initialize empty followers array
      bio: '' // Initialize empty bio
    };
    
    await setDoc(userRef, newUser);
    
    // Update analytics
    await updateAnalytics();
    
    return {
      ...newUser,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

// Login existing user
export const loginUser = async (name: string, passkey: string): Promise<UserProfile | null> => {
  try {
    const userId = name.toLowerCase().trim();
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data() as UserProfile;
    
    if (userData.passkey !== passkey) {
      throw new Error('Invalid passkey');
    }
    
    // Check if displayName field exists, if not, add it using the original name input
    const updateData: any = {
      lastLogin: serverTimestamp(),
      loginCount: (userData.loginCount || 0) + 1
    };
    
    // If displayName doesn't exist, add it with proper capitalization
    if (!userData.displayName) {
      updateData.displayName = name.trim(); // Use the original input name with proper capitalization
      updateData.username = generateUsername(name.trim()); // Generate username for tags
      console.log(`Adding displayName "${name.trim()}" and username "${generateUsername(name.trim())}" to existing user "${userId}"`);
    }
    
    // If username doesn't exist, generate it from displayName
    if (!userData.username && userData.displayName) {
      updateData.username = generateUsername(userData.displayName);
      console.log(`Adding username "${generateUsername(userData.displayName)}" to existing user "${userId}"`);
    }
    
    // Update login info and displayName if needed
    await updateDoc(userRef, updateData);
    
    // Fetch the latest user data to ensure profile image sync across devices
    const updatedUserSnap = await getDoc(userRef);
    const updatedUserData = updatedUserSnap.data() as UserProfile;
    
    return {
      ...updatedUserData,
      displayName: updatedUserData.displayName || name.trim(),
      lastLogin: new Date().toISOString(),
      loginCount: (updatedUserData.loginCount || 0) + 1
    };
  } catch (error) {
    console.error('Error logging in user:', error);
    throw error;
  }
};

// Get user profile by ID
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    const userData = userSnap.data() as UserProfile;
    return {
      ...userData,
      id: userSnap.id,
      createdAt: userData.createdAt instanceof Timestamp 
        ? userData.createdAt.toDate().toISOString() 
        : userData.createdAt,
      lastLogin: userData.lastLogin instanceof Timestamp 
        ? userData.lastLogin.toDate().toISOString() 
        : userData.lastLogin
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Check if user exists (for session validation)
export const checkUserExists = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
};

// Delete user profile permanently
export const deleteUserProfile = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    
    // Check if user exists before deleting
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    // Delete the user document
    await deleteDoc(userRef);
    
    console.log(`User ${userId} deleted successfully`);
    return true;
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};

// Get all users (for admin dashboard)
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    
    const users: UserProfile[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as UserProfile;
      users.push({
        ...data,
        id: doc.id,
        // Convert Firestore timestamps to strings
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        lastLogin: data.lastLogin instanceof Timestamp 
          ? data.lastLogin.toDate().toISOString() 
          : data.lastLogin
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

// Real-time listener for users (for admin dashboard)
export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  const usersRef = collection(db, USERS_COLLECTION);
  
  return onSnapshot(usersRef, (snapshot) => {
    const users: UserProfile[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as UserProfile;
      users.push({
        ...data,
        id: doc.id,
        // Convert Firestore timestamps to strings
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        lastLogin: data.lastLogin instanceof Timestamp 
          ? data.lastLogin.toDate().toISOString() 
          : data.lastLogin
      });
    });
    
    callback(users);
  }, (error) => {
    console.error('Error in users subscription:', error);
    callback([]);
  });
};

// Update analytics
const updateAnalytics = async () => {
  try {
    const today = new Date().toDateString();
    const analyticsRef = doc(db, ANALYTICS_COLLECTION, 'main');
    
    // Get current analytics
    const analyticsSnap = await getDoc(analyticsRef);
    let analyticsData = analyticsSnap.exists() ? analyticsSnap.data() : {};
    
    // Update daily visits
    const dailyVisits = analyticsData.dailyVisits || {};
    dailyVisits[today] = (dailyVisits[today] || 0) + 1;
    
    // Update total visits
    const totalVisits = (analyticsData.totalVisits || 0) + 1;
    
    await setDoc(analyticsRef, {
      dailyVisits,
      totalVisits,
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating analytics:', error);
  }
};

// Get analytics data
export const getAnalytics = async (): Promise<AnalyticsData> => {
  try {
    const analyticsRef = doc(db, ANALYTICS_COLLECTION, 'main');
    const analyticsSnap = await getDoc(analyticsRef);
    
    const today = new Date().toDateString();
    let analyticsData = analyticsSnap.exists() ? analyticsSnap.data() : {};
    
    return {
      totalUsers: 0, // Will be calculated from users collection
      dailyVisits: analyticsData.dailyVisits?.[today] || 0,
      totalVisits: analyticsData.totalVisits || 0,
      lastUpdated: analyticsData.lastUpdated instanceof Timestamp 
        ? analyticsData.lastUpdated.toDate().toISOString()
        : new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting analytics:', error);
    return {
      totalUsers: 0,
      dailyVisits: 0,
      totalVisits: 0,
      lastUpdated: new Date().toISOString()
    };
  }
};

// Track page visit
export const trackPageVisit = async () => {
  try {
    await updateAnalytics();
  } catch (error) {
    console.error('Error tracking page visit:', error);
  }
};

// Update user profile image with enhanced error handling
export const updateUserProfileImage = async (userId: string, imageUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    
    // Check if user exists
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, error: 'User account not found. Please try logging out and logging back in.' };
    }

    // Validate image size for base64 strings with mobile considerations
    if (imageUrl && imageUrl.trim() !== '') {
      // Check if it's a base64 string and estimate size
      if (imageUrl.startsWith('data:image/')) {
        const base64Size = (imageUrl.length * 3) / 4; // Approximate base64 size in bytes
        const maxSize = 900 * 1024; // 900KB limit for Firestore document (increased slightly for mobile)
        
        if (base64Size > maxSize) {
          console.error(`📱 Image too large: ${Math.round(base64Size / 1024)}KB > ${Math.round(maxSize / 1024)}KB`);
          return { success: false, error: 'Image is too large after compression. Please select a smaller image or try again.' };
        }
        
        console.log(`📎 Image size check passed: ${Math.round(base64Size / 1024)}KB`);
      }
    }
    
    // Handle deletion vs update
    if (imageUrl.trim() === '') {
      // Delete profile image (remove the field entirely)
      await updateDoc(userRef, {
        profileImage: deleteField()
      });
      console.log(`❌ Deleted profile image for user ${userId}`);
    } else {
      // Update profile image with retry logic for mobile
      const updateWithRetry = async (retryCount = 0): Promise<void> => {
        try {
          await updateDoc(userRef, {
            profileImage: imageUrl
          });
          console.log(`✅ Updated profile image for user ${userId}`);
        } catch (error: any) {
          if (retryCount < 2 && (error.code === 'unavailable' || error.code === 'deadline-exceeded')) {
            console.log(`🔄 Retrying Firebase update (attempt ${retryCount + 2}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return updateWithRetry(retryCount + 1);
          }
          throw error;
        }
      };
      
      await updateWithRetry();
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error updating profile image:', error);
    
    // Provide specific error messages based on the error type
    if (error.code === 'permission-denied') {
      return { success: false, error: 'Permission denied. Please check your internet connection and try again.' };
    } else if (error.code === 'unavailable') {
      return { success: false, error: 'Service temporarily unavailable. Please check your internet connection and try again.' };
    } else if (error.code === 'deadline-exceeded' || error.code === 'cancelled') {
      return { success: false, error: 'Upload timed out. Please check your internet connection and try again.' };
    } else if (error.code === 'invalid-argument') {
      return { success: false, error: 'Invalid image format. Please select a valid image file.' };
    } else if (error.message && error.message.includes('document too large')) {
      return { success: false, error: 'Image is too large. Please select a smaller image.' };
    } else if (error.message && error.message.includes('network')) {
      return { success: false, error: 'Network error. Please check your internet connection and try again.' };
    } else if (error.message && error.message.includes('quota')) {
      return { success: false, error: 'Storage quota exceeded. Please try again later.' };
    } else {
      return { success: false, error: `Failed to update profile image: ${error.message || 'Unknown error'}. Please try again.` };
    }
  }
};

// ============ USER PROFILE UPDATES ============

// Update user bio
export const updateUserBio = async (userId: string, bio: string): Promise<boolean> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    
    // Check if user exists
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    await updateDoc(userRef, {
      bio: bio.trim()
    });
    
    console.log(`Updated bio for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error updating user bio:', error);
    throw error;
  }
};

// Update user display name (admin function)
export const updateUserDisplayName = async (userId: string, newDisplayName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    
    // Check if user exists
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, error: 'User account not found.' };
    }
    
    // Validate the new display name
    const trimmedName = newDisplayName.trim();
    if (!trimmedName) {
      return { success: false, error: 'Display name cannot be empty.' };
    }
    
    if (trimmedName.length > 50) {
      return { success: false, error: 'Display name must be 50 characters or less.' };
    }
    
    // Update the display name and username
    await updateDoc(userRef, {
      displayName: trimmedName,
      username: generateUsername(trimmedName) // Update username to match new display name
    });
    
    console.log(`✅ Updated display name for user ${userId} to "${trimmedName}" and username to "${generateUsername(trimmedName)}"`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error updating user display name:', error);
    
    // Provide specific error messages
    if (error.code === 'permission-denied') {
      return { success: false, error: 'Permission denied. Admin access required.' };
    } else if (error.code === 'unavailable') {
      return { success: false, error: 'Service temporarily unavailable. Please try again.' };
    } else {
      return { success: false, error: `Failed to update display name: ${error.message || 'Unknown error'}` };
    }
  }
};

// ============ LIKED SONGS FUNCTIONALITY ============

// Add a song to user's liked songs
export const addLikedSong = async (userId: string, songId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    
    // Check if user exists
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    // Add song to liked songs array (arrayUnion prevents duplicates)
    await updateDoc(userRef, {
      likedSongs: arrayUnion(songId)
    });
    
    console.log(`Added song ${songId} to user ${userId}'s liked songs`);
    return true;
  } catch (error) {
    console.error('Error adding liked song:', error);
    throw error;
  }
};

// Remove a song from user's liked songs
export const removeLikedSong = async (userId: string, songId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    
    // Check if user exists
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    // Remove song from liked songs array
    await updateDoc(userRef, {
      likedSongs: arrayRemove(songId)
    });
    
    console.log(`Removed song ${songId} from user ${userId}'s liked songs`);
    return true;
  } catch (error) {
    console.error('Error removing liked song:', error);
    throw error;
  }
};

// Get user's liked songs
export const getUserLikedSongs = async (userId: string): Promise<string[]> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.warn(`User ${userId} not found`);
      return [];
    }
    
    const userData = userSnap.data() as UserProfile;
    return userData.likedSongs || [];
  } catch (error) {
    console.error('Error getting user liked songs:', error);
    return [];
  }
};

// Check if user has liked a specific song
export const isUserLikedSong = async (userId: string, songId: string): Promise<boolean> => {
  try {
    const likedSongs = await getUserLikedSongs(userId);
    return likedSongs.includes(songId);
  } catch (error) {
    console.error('Error checking if song is liked:', error);
    return false;
  }
};

// Real-time listener for user's liked songs
export const subscribeToUserLikedSongs = (userId: string, callback: (likedSongs: string[]) => void) => {
  const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
  
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const userData = snapshot.data() as UserProfile;
      callback(userData.likedSongs || []);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error in liked songs subscription:', error);
    callback([]);
  });
};

// ============ FRIENDSHIP FUNCTIONALITY ============

// Follow a user
export const followUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  try {
    const currentUserRef = doc(db, USERS_COLLECTION, currentUserId.toLowerCase());
    const targetUserRef = doc(db, USERS_COLLECTION, targetUserId.toLowerCase());
    
    // Check if both users exist
    const [currentUserSnap, targetUserSnap] = await Promise.all([
      getDoc(currentUserRef),
      getDoc(targetUserRef)
    ]);
    
    if (!currentUserSnap.exists() || !targetUserSnap.exists()) {
      throw new Error('User not found');
    }
    
    // Add target user to current user's following list
    await updateDoc(currentUserRef, {
      following: arrayUnion(targetUserId.toLowerCase())
    });
    
    // Add current user to target user's followers list
    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUserId.toLowerCase())
    });
    
    console.log(`User ${currentUserId} followed ${targetUserId}`);
    return true;
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
};

// Unfollow a user
export const unfollowUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  try {
    const currentUserRef = doc(db, USERS_COLLECTION, currentUserId.toLowerCase());
    const targetUserRef = doc(db, USERS_COLLECTION, targetUserId.toLowerCase());
    
    // Check if both users exist
    const [currentUserSnap, targetUserSnap] = await Promise.all([
      getDoc(currentUserRef),
      getDoc(targetUserRef)
    ]);
    
    if (!currentUserSnap.exists() || !targetUserSnap.exists()) {
      throw new Error('User not found');
    }
    
    // Remove target user from current user's following list
    await updateDoc(currentUserRef, {
      following: arrayRemove(targetUserId.toLowerCase())
    });
    
    // Remove current user from target user's followers list
    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUserId.toLowerCase())
    });
    
    console.log(`User ${currentUserId} unfollowed ${targetUserId}`);
    return true;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
};

// Check if user is following another user
export const isFollowing = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  try {
    const currentUserRef = doc(db, USERS_COLLECTION, currentUserId.toLowerCase());
    const userSnap = await getDoc(currentUserRef);
    
    if (!userSnap.exists()) {
      return false;
    }
    
    const userData = userSnap.data() as UserProfile;
    return (userData.following || []).includes(targetUserId.toLowerCase());
  } catch (error) {
    console.error('Error checking if following:', error);
    return false;
  }
};

// Get user's followers
export const getUserFollowers = async (userId: string): Promise<UserProfile[]> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return [];
    }
    
    const userData = userSnap.data() as UserProfile;
    const followerIds = userData.followers || [];
    
    if (followerIds.length === 0) {
      return [];
    }
    
    // Get all follower user profiles
    const followerPromises = followerIds.map(id => getDoc(doc(db, USERS_COLLECTION, id)));
    const followerSnaps = await Promise.all(followerPromises);
    
    const followers: UserProfile[] = [];
    followerSnaps.forEach(snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        followers.push({
          ...data,
          id: snap.id,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : data.createdAt,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : data.lastLogin
        });
      }
    });
    
    return followers;
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
};

// Get user's following
export const getUserFollowing = async (userId: string): Promise<UserProfile[]> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return [];
    }
    
    const userData = userSnap.data() as UserProfile;
    const followingIds = userData.following || [];
    
    if (followingIds.length === 0) {
      return [];
    }
    
    // Get all following user profiles
    const followingPromises = followingIds.map(id => getDoc(doc(db, USERS_COLLECTION, id)));
    const followingSnaps = await Promise.all(followingPromises);
    
    const following: UserProfile[] = [];
    followingSnaps.forEach(snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        following.push({
          ...data,
          id: snap.id,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : data.createdAt,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : data.lastLogin
        });
      }
    });
    
    return following;
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
};

// Search users by name
export const searchUsers = async (query: string, currentUserId?: string): Promise<UserProfile[]> => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    
    const users: UserProfile[] = [];
    const searchQuery = query.toLowerCase().trim();
    
    snapshot.forEach((doc) => {
      const data = doc.data() as UserProfile;
      
      // Skip current user from search results
      if (currentUserId && doc.id === currentUserId.toLowerCase()) {
        return;
      }
      
      // Search in both name and displayName
      const matchesName = data.name.toLowerCase().includes(searchQuery);
      const matchesDisplayName = data.displayName.toLowerCase().includes(searchQuery);
      
      if (matchesName || matchesDisplayName) {
        users.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt.toDate().toISOString() 
            : data.createdAt,
          lastLogin: data.lastLogin instanceof Timestamp 
            ? data.lastLogin.toDate().toISOString() 
            : data.lastLogin
        });
      }
    });
    
    // Sort by relevance (exact matches first, then partial matches)
    users.sort((a, b) => {
      const aExactMatch = a.displayName.toLowerCase() === searchQuery || a.name.toLowerCase() === searchQuery;
      const bExactMatch = b.displayName.toLowerCase() === searchQuery || b.name.toLowerCase() === searchQuery;
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // If both or neither are exact matches, sort alphabetically
      return a.displayName.localeCompare(b.displayName);
    });
    
    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

// Get user stats (followers and following count)
export const getUserStats = async (userId: string): Promise<{ followersCount: number; followingCount: number }> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId.toLowerCase());
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { followersCount: 0, followingCount: 0 };
    }
    
    const userData = userSnap.data() as UserProfile;
    return {
      followersCount: (userData.followers || []).length,
      followingCount: (userData.following || []).length
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { followersCount: 0, followingCount: 0 };
  }
};

// Get suggested users (users excluding current user)
export const getSuggestedUsers = async (currentUserId: string, limit: number = 10): Promise<UserProfile[]> => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    
    const suggestedUsers: UserProfile[] = [];
    
    snapshot.forEach((doc) => {
      // Skip only the current user (allow followed users to remain in suggestions)
      if (doc.id === currentUserId.toLowerCase()) {
        return;
      }
      
      const data = doc.data() as UserProfile;
      suggestedUsers.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        lastLogin: data.lastLogin instanceof Timestamp 
          ? data.lastLogin.toDate().toISOString() 
          : data.lastLogin
      });
    });
    
    // Sort by most recent activity (last login)
    suggestedUsers.sort((a, b) => {
      const dateA = new Date(a.lastLogin as string);
      const dateB = new Date(b.lastLogin as string);
      return dateB.getTime() - dateA.getTime();
    });
    
    return suggestedUsers.slice(0, limit);
  } catch (error) {
    console.error('Error getting suggested users:', error);
    return [];
  }
};