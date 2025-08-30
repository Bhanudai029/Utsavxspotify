import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Loader2, Heart, UserCheck, Eye } from 'lucide-react';

// Test data to simulate users without external dependencies
const mockUsers = [
  {
    id: '1',
    displayName: 'Test User 1',
    email: 'test1@example.com',
    profileImage: '/PPplaceholder-modified.png',
    bio: 'This is a test bio for testing purposes',
    userTag: 'testuser1'
  },
  {
    id: '2',
    displayName: 'Test User 2',
    email: 'test2@example.com',
    profileImage: '/PPplaceholder-modified.png',
    bio: 'Another test bio to check if blinking occurs',
    userTag: 'testuser2'
  },
  {
    id: '3',
    displayName: 'Test User 3',
    email: 'test3@example.com',
    profileImage: '/PPplaceholder-modified.png',
    bio: 'Third test user with a longer bio to test text overflow and blinking behavior',
    userTag: 'testuser3'
  },
  {
    id: '4',
    displayName: 'Test User 4',
    email: 'test4@example.com',
    profileImage: '/PPplaceholder-modified.png',
    bio: 'Fourth test user',
    userTag: 'testuser4'
  }
];

const FriendsTest = () => {
  const [followingStatus, setFollowingStatus] = useState<{ [key: string]: boolean }>({});
  const [userStats, setUserStats] = useState<{ [key: string]: { followers: number; following: number } }>({});
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  // Initialize mock data
  useEffect(() => {
    const mockFollowingStatus: { [key: string]: boolean } = {};
    const mockUserStats: { [key: string]: { followers: number; following: number } } = {};
    
    mockUsers.forEach((user, index) => {
      mockFollowingStatus[user.id] = index % 2 === 0; // Alternate following status
      mockUserStats[user.id] = {
        followers: Math.floor(Math.random() * 1000) + 10,
        following: Math.floor(Math.random() * 500) + 5
      };
    });
    
    setFollowingStatus(mockFollowingStatus);
    setUserStats(mockUserStats);
  }, []);

  // Mock follow/unfollow function
  const handleToggleFollow = async (userId: string) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setFollowingStatus(prev => ({ ...prev, [userId]: !prev[userId] }));
    setActionLoading(prev => ({ ...prev, [userId]: false }));
    
    // Update stats
    setUserStats(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        followers: prev[userId].followers + (followingStatus[userId] ? -1 : 1)
      }
    }));
  };

  // Get profile image URL
  const getProfileImageUrl = (user: any) => {
    return user.profileImage || '/PPplaceholder-modified.png';
  };

  // Format follower count
  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Test UserCard component - replica of the original with stable hover
  const UserCard = ({ user }: { user: any }) => {
    const isFollowing = followingStatus[user.id] || false;
    const stats = userStats[user.id] || { followers: 0, following: 0 };
    const isLoading = actionLoading[user.id] || false;
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div 
        className="bg-spotify-gray/80 rounded-lg p-4 backdrop-blur-sm border border-transparent cursor-pointer transition-colors duration-200 overflow-hidden"
        style={{
          backgroundColor: isHovered ? 'rgba(40, 40, 40, 0.9)' : 'rgba(40, 40, 40, 0.8)',
          borderColor: isHovered ? 'rgba(29, 185, 84, 0.3)' : 'transparent'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center space-x-4">
          {/* Profile Image */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700/50">
              <img
                src={getProfileImageUrl(user)}
                alt={user.displayName}
                className="w-full h-full object-cover"
                style={{
                  backgroundColor: 'transparent'
                }}
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
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h3 
              className="font-semibold text-lg truncate transition-colors duration-200"
              style={{ color: isHovered ? '#1DB954' : 'white' }}
            >
              {user.displayName}
            </h3>
            <p 
              className="text-sm truncate transition-colors duration-200"
              style={{ color: isHovered ? 'rgba(255, 255, 255, 0.9)' : '#b3b3b3' }}
            >
              @{user.userTag}
            </p>
            
            {/* Stats */}
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <Heart 
                  className="w-4 h-4 transition-colors duration-200" 
                  style={{ color: isHovered ? '#ef4444' : '#b3b3b3' }}
                />
                <span 
                  className="text-sm transition-colors duration-200"
                  style={{ color: isHovered ? 'white' : '#b3b3b3' }}
                >
                  {formatCount(stats.followers)} followers
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye 
                  className="w-4 h-4 transition-colors duration-200" 
                  style={{ color: isHovered ? '#3b82f6' : '#b3b3b3' }}
                />
                <span 
                  className="text-sm transition-colors duration-200"
                  style={{ color: isHovered ? 'white' : '#b3b3b3' }}
                >
                  {formatCount(stats.following)} following
                </span>
              </div>
            </div>
            
            {/* Bio */}
            {user.bio && (
              <p 
                className="text-xs mt-1 truncate transition-colors duration-200"
                style={{ color: isHovered ? 'rgba(255, 255, 255, 0.8)' : '#b3b3b3' }}
              >
                {user.bio}
              </p>
            )}
          </div>
          
          {/* Follow Button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => handleToggleFollow(user.id)}
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
          </div>
        </div>
      </div>
    );
  };

  // Simplified UserCard without complex styles - to test if it's a CSS issue
  const SimpleUserCard = ({ user }: { user: any }) => {
    const isFollowing = followingStatus[user.id] || false;
    const stats = userStats[user.id] || { followers: 0, following: 0 };
    const isLoading = actionLoading[user.id] || false;

    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-green-500 transition-colors duration-200">
        <div className="flex items-center space-x-4">
          {/* Simple Profile Image */}
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-600">
            <img
              src={getProfileImageUrl(user)}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* User Info */}
          <div className="flex-1">
            <h3 className="text-white font-semibold">
              {user.displayName}
            </h3>
            <p className="text-gray-400 text-sm">
              @{user.userTag}
            </p>
            <p className="text-gray-400 text-xs">
              {formatCount(stats.followers)} followers • {formatCount(stats.following)} following
            </p>
          </div>
          
          {/* Simple Follow Button */}
          <button
            onClick={() => handleToggleFollow(user.id)}
            disabled={isLoading}
            className={`px-4 py-2 rounded font-medium text-sm ${
              isFollowing
                ? 'bg-transparent border border-green-500 text-green-500 hover:bg-green-500 hover:text-black'
                : 'bg-green-500 text-black hover:bg-green-600'
            } transition-colors duration-200 disabled:opacity-50`}
          >
            {isLoading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-spotify-dark to-spotify-black">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Friends Test Page</h1>
          <p className="text-spotify-light-gray">Testing hover blinking issues</p>
        </div>

        {/* Original Style Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Original Style Cards (Test for Blinking)</h2>
          <div className="space-y-4">
            {mockUsers.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </div>

        {/* Simplified Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Simplified Cards (Control Test)</h2>
          <div className="space-y-4">
            {mockUsers.map((user) => (
              <SimpleUserCard key={`simple-${user.id}`} user={user} />
            ))}
          </div>
        </div>

        {/* Pure CSS Test */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Pure CSS Test (No React State Changes)</h2>
          <div className="space-y-4">
            {mockUsers.map((user) => (
              <div 
                key={`css-${user.id}`}
                className="bg-spotify-gray/80 rounded-lg p-4 backdrop-blur-sm border border-transparent cursor-pointer group hover:bg-spotify-gray/90 hover:border-spotify-green/20 transition-all duration-300 ease-out overflow-hidden"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg bg-gray-600">
                    <img
                      src="/PPplaceholder-modified.png"
                      alt={user.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg group-hover:text-white transition-colors duration-300">
                      {user.displayName}
                    </h3>
                    <p className="text-spotify-light-gray text-sm group-hover:text-white/90 transition-colors duration-300">
                      @{user.userTag}
                    </p>
                    <p className="text-spotify-light-gray text-xs mt-1">
                      Static text - no state changes
                    </p>
                  </div>
                  <button className="px-4 py-2 rounded-full font-semibold text-sm bg-spotify-green text-black hover:bg-spotify-green/90 transition-colors duration-200">
                    Follow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-spotify-light-gray text-sm">
            Hover over the cards above to test for blinking behavior.<br />
            Compare the three different implementations to identify the cause.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FriendsTest;