import type { UserProfile } from './firebaseService';

// Cache keys
const CACHE_KEYS = {
  USER_PROFILES: 'cached_user_profiles',
  USER_STATS: 'cached_user_stats',
  FOLLOWING_STATUS: 'cached_following_status',
  SUGGESTED_USERS: 'cached_suggested_users',
  SEARCH_RESULTS: 'cached_search_results',
  CACHE_TIMESTAMPS: 'cache_timestamps'
} as const;

// Cache duration in milliseconds
const CACHE_DURATION = {
  USER_PROFILES: 5 * 60 * 1000, // 5 minutes
  USER_STATS: 2 * 60 * 1000, // 2 minutes
  FOLLOWING_STATUS: 30 * 1000, // 30 seconds
  SUGGESTED_USERS: 60 * 1000, // 1 minute
  SEARCH_RESULTS: 30 * 1000 // 30 seconds
} as const;

interface CacheTimestamps {
  [key: string]: number;
}

interface CachedUserStats {
  followersCount: number;
  followingCount: number;
}

interface CachedData {
  userProfiles: { [userId: string]: UserProfile };
  userStats: { [userId: string]: CachedUserStats };
  followingStatus: { [userId: string]: boolean };
  suggestedUsers: UserProfile[];
  searchResults: { [query: string]: UserProfile[] };
}

class CacheService {
  private getTimestamps(): CacheTimestamps {
    try {
      const timestamps = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMPS);
      return timestamps ? JSON.parse(timestamps) : {};
    } catch {
      return {};
    }
  }

  private setTimestamp(key: string): void {
    try {
      const timestamps = this.getTimestamps();
      timestamps[key] = Date.now();
      localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(timestamps));
    } catch (error) {
      console.warn('Failed to set cache timestamp:', error);
    }
  }

  private isExpired(key: string, duration: number): boolean {
    const timestamps = this.getTimestamps();
    const timestamp = timestamps[key];
    if (!timestamp) return true;
    return Date.now() - timestamp > duration;
  }

  // User Profiles Cache
  getCachedUserProfile(userId: string): UserProfile | null {
    try {
      if (this.isExpired(`${CACHE_KEYS.USER_PROFILES}_${userId}`, CACHE_DURATION.USER_PROFILES)) {
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEYS.USER_PROFILES);
      if (!cached) return null;

      const userProfiles: CachedData['userProfiles'] = JSON.parse(cached);
      return userProfiles[userId] || null;
    } catch {
      return null;
    }
  }

  setCachedUserProfile(userId: string, profile: UserProfile): void {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.USER_PROFILES);
      const userProfiles: CachedData['userProfiles'] = cached ? JSON.parse(cached) : {};
      
      userProfiles[userId] = profile;
      localStorage.setItem(CACHE_KEYS.USER_PROFILES, JSON.stringify(userProfiles));
      this.setTimestamp(`${CACHE_KEYS.USER_PROFILES}_${userId}`);
    } catch (error) {
      console.warn('Failed to cache user profile:', error);
    }
  }

  // User Stats Cache
  getCachedUserStats(userId: string): CachedUserStats | null {
    try {
      if (this.isExpired(`${CACHE_KEYS.USER_STATS}_${userId}`, CACHE_DURATION.USER_STATS)) {
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEYS.USER_STATS);
      if (!cached) return null;

      const userStats: CachedData['userStats'] = JSON.parse(cached);
      return userStats[userId] || null;
    } catch {
      return null;
    }
  }

  setCachedUserStats(userId: string, stats: CachedUserStats): void {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.USER_STATS);
      const userStats: CachedData['userStats'] = cached ? JSON.parse(cached) : {};
      
      userStats[userId] = stats;
      localStorage.setItem(CACHE_KEYS.USER_STATS, JSON.stringify(userStats));
      this.setTimestamp(`${CACHE_KEYS.USER_STATS}_${userId}`);
    } catch (error) {
      console.warn('Failed to cache user stats:', error);
    }
  }

  // Following Status Cache
  getCachedFollowingStatus(userId: string): boolean | null {
    try {
      if (this.isExpired(`${CACHE_KEYS.FOLLOWING_STATUS}_${userId}`, CACHE_DURATION.FOLLOWING_STATUS)) {
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEYS.FOLLOWING_STATUS);
      if (!cached) return null;

      const followingStatus: CachedData['followingStatus'] = JSON.parse(cached);
      return followingStatus[userId] !== undefined ? followingStatus[userId] : null;
    } catch {
      return null;
    }
  }

  setCachedFollowingStatus(userId: string, isFollowing: boolean): void {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.FOLLOWING_STATUS);
      const followingStatus: CachedData['followingStatus'] = cached ? JSON.parse(cached) : {};
      
      followingStatus[userId] = isFollowing;
      localStorage.setItem(CACHE_KEYS.FOLLOWING_STATUS, JSON.stringify(followingStatus));
      this.setTimestamp(`${CACHE_KEYS.FOLLOWING_STATUS}_${userId}`);
    } catch (error) {
      console.warn('Failed to cache following status:', error);
    }
  }

  // Suggested Users Cache
  getCachedSuggestedUsers(): UserProfile[] | null {
    try {
      if (this.isExpired(CACHE_KEYS.SUGGESTED_USERS, CACHE_DURATION.SUGGESTED_USERS)) {
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEYS.SUGGESTED_USERS);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  setCachedSuggestedUsers(users: UserProfile[]): void {
    try {
      localStorage.setItem(CACHE_KEYS.SUGGESTED_USERS, JSON.stringify(users));
      this.setTimestamp(CACHE_KEYS.SUGGESTED_USERS);
    } catch (error) {
      console.warn('Failed to cache suggested users:', error);
    }
  }

  // Search Results Cache
  getCachedSearchResults(query: string): UserProfile[] | null {
    try {
      if (this.isExpired(`${CACHE_KEYS.SEARCH_RESULTS}_${query}`, CACHE_DURATION.SEARCH_RESULTS)) {
        return null;
      }

      const cached = localStorage.getItem(CACHE_KEYS.SEARCH_RESULTS);
      if (!cached) return null;

      const searchResults: CachedData['searchResults'] = JSON.parse(cached);
      return searchResults[query] || null;
    } catch {
      return null;
    }
  }

  setCachedSearchResults(query: string, results: UserProfile[]): void {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.SEARCH_RESULTS);
      const searchResults: CachedData['searchResults'] = cached ? JSON.parse(cached) : {};
      
      searchResults[query] = results;
      localStorage.setItem(CACHE_KEYS.SEARCH_RESULTS, JSON.stringify(searchResults));
      this.setTimestamp(`${CACHE_KEYS.SEARCH_RESULTS}_${query}`);
    } catch (error) {
      console.warn('Failed to cache search results:', error);
    }
  }

  // Clear expired cache entries
  clearExpiredCache(): void {
    try {
      const timestamps = this.getTimestamps();
      const now = Date.now();
      
      // Clear expired user profiles
      const userProfilesKey = CACHE_KEYS.USER_PROFILES;
      Object.keys(timestamps).forEach(key => {
        if (key.startsWith(`${userProfilesKey}_`)) {
          if (now - timestamps[key] > CACHE_DURATION.USER_PROFILES) {
            delete timestamps[key];
          }
        }
      });

      // Update timestamps
      localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(timestamps));
    } catch (error) {
      console.warn('Failed to clear expired cache:', error);
    }
  }

  // Clear all cache
  clearAllCache(): void {
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

export const cacheService = new CacheService();