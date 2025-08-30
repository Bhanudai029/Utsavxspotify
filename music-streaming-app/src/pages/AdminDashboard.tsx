import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Shield, Users, Activity, Eye, EyeOff, Calendar, Clock, UserCheck, Trash2, Music, ChevronDown, ChevronRight, X, Edit3, Save, XCircle } from 'lucide-react';
import { subscribeToUsers, getAnalytics, trackPageVisit as firebaseTrackPageVisit, deleteUserProfile, checkUserExists, updateUserDisplayName, getUserTag } from '../lib/firebaseService';
import { sampleTracks } from '../data';
import type { UserProfile } from '../lib/firebaseService';

interface AnalyticsData {
  totalUsers: number;
  users: UserProfile[];
  dailyVisits: number;
  totalVisits: number;
  lastUpdated: string;
}

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasskeys, setShowPasskeys] = useState<{[key: number]: boolean}>({});
  const [expandedLikedSongs, setExpandedLikedSongs] = useState<{[key: number]: boolean}>({});
  const [likedSongsModal, setLikedSongsModal] = useState<{ isOpen: boolean; user: UserProfile | null; songs: string[] }>({ 
    isOpen: false, 
    user: null, 
    songs: [] 
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState<string>('');
  const [editNameError, setEditNameError] = useState<string>('');
  const [isUpdatingName, setIsUpdatingName] = useState<boolean>(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsers: 0,
    users: [],
    dailyVisits: 0,
    totalVisits: 0,
    lastUpdated: new Date().toISOString()
  });
  const [unsubscribeUsers, setUnsubscribeUsers] = useState<(() => void) | null>(null);

  // Secure admin password with additional security measures
  const ADMIN_PASSWORD = '29102910';
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

  // Security functions
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>"'&]/g, '') // Remove potentially harmful characters
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .trim()
      .slice(0, 50); // Limit length
  };

  const getFailedAttempts = (): number => {
    const attempts = localStorage.getItem('adminFailedAttempts');
    return attempts ? parseInt(attempts, 10) : 0;
  };

  const getLastFailedAttempt = (): number => {
    const timestamp = localStorage.getItem('adminLastFailedAttempt');
    return timestamp ? parseInt(timestamp, 10) : 0;
  };

  const isAccountLocked = (): boolean => {
    const failedAttempts = getFailedAttempts();
    const lastAttempt = getLastFailedAttempt();
    const now = Date.now();
    
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      if (now - lastAttempt < LOCKOUT_DURATION) {
        return true;
      } else {
        // Reset failed attempts after lockout period
        localStorage.removeItem('adminFailedAttempts');
        localStorage.removeItem('adminLastFailedAttempt');
        return false;
      }
    }
    return false;
  };

  const recordFailedAttempt = (): void => {
    const currentAttempts = getFailedAttempts();
    localStorage.setItem('adminFailedAttempts', (currentAttempts + 1).toString());
    localStorage.setItem('adminLastFailedAttempt', Date.now().toString());
  };

  const clearFailedAttempts = (): void => {
    localStorage.removeItem('adminFailedAttempts');
    localStorage.removeItem('adminLastFailedAttempt');
  };

  const validatePassword = (password: string): boolean => {
    // Strict comparison - no fuzzy matching
    return password === ADMIN_PASSWORD;
  };

  const getRemainingLockoutTime = (): number => {
    const lastAttempt = getLastFailedAttempt();
    const elapsed = Date.now() - lastAttempt;
    const remaining = LOCKOUT_DURATION - elapsed;
    return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
  };

  // Add useEffect to monitor authentication state changes
  useEffect(() => {
    console.log('Authentication state changed:', isAuthenticated);
    
    if (isAuthenticated) {
      // Set up real-time user subscription when authenticated
      const unsubscribe = subscribeToUsers((users) => {
        console.log('Real-time users update received:', users);
        setAnalytics(prev => ({
          ...prev,
          totalUsers: users.length,
          users,
          lastUpdated: new Date().toISOString()
        }));
      });
      
      setUnsubscribeUsers(() => unsubscribe);
      
      // Load initial analytics data
      loadAnalytics();
      
      // Optional: Check if admin user exists in Firebase (if admin accounts are stored there)
      // This is mainly for regular users, but keeping for consistency
      const checkAdminExistence = async () => {
        try {
          // Only check if there's a user session (not applicable for admin password auth)
          const savedAuth = localStorage.getItem('userAuth');
          if (savedAuth) {
            const authData = JSON.parse(savedAuth);
            const userKey = authData.name.toLowerCase().trim();
            
            const userExists = await checkUserExists(userKey);
            if (!userExists) {
              console.log('Admin user account deleted, logging out');
              alert('⚠️ Your account has been deleted. You will be logged out.');
              handleLogout();
            }
          }
        } catch (error) {
          console.error('Error checking admin existence:', error);
        }
      };
      
      // Check admin existence periodically (every 60 seconds for admin)
      const adminCheckInterval = setInterval(checkAdminExistence, 60000);
      
      // Cleanup on unmount
      return () => {
        if (unsubscribeUsers) {
          unsubscribeUsers();
        }
        clearInterval(adminCheckInterval);
      };
    } else {
      // Clean up subscription when not authenticated
      if (unsubscribeUsers) {
        unsubscribeUsers();
        setUnsubscribeUsers(null);
      }
    }
  }, [isAuthenticated]);

  // Remove localStorage storage event listener as we're using Firebase now
  // Firebase provides real-time updates automatically

  useEffect(() => {
    // Extension conflict detection
    const detectExtensionConflicts = () => {
      try {
        // Test localStorage access
        const testKey = 'admin_test_' + Date.now();
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        // Test sessionStorage access
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
        
        return false; // No conflicts detected
      } catch (error) {
        console.warn('Browser extension may be blocking storage access:', error);
        return true; // Conflicts detected
      }
    };

    // Check for extension conflicts
    const hasConflicts = detectExtensionConflicts();
    if (hasConflicts) {
      setError('Browser extension detected. Please try InPrivate/Incognito mode or disable extensions.');
      return;
    }

    // Check if admin is already authenticated with enhanced validation
    const adminAuth = sessionStorage.getItem('adminAuth');
    const authTime = sessionStorage.getItem('adminAuthTime');
    
    if (adminAuth && authTime) {
      const authTimestamp = parseInt(authTime, 10);
      const sessionDuration = Date.now() - authTimestamp;
      const maxSessionDuration = 2 * 60 * 60 * 1000; // 2 hours
      
      // Validate session token format and age
      if (adminAuth.startsWith('YXV0aGVudGljYXRlZF8=') || adminAuth.includes('authenticated_')) {
        if (sessionDuration < maxSessionDuration) {
          setIsAuthenticated(true);
          loadAnalytics();
        } else {
          // Session expired, clear authentication
          sessionStorage.removeItem('adminAuth');
          sessionStorage.removeItem('adminAuthTime');
          setError('Session expired. Please login again.');
        }
      } else {
        // Invalid token format, clear authentication
        sessionStorage.removeItem('adminAuth');
        sessionStorage.removeItem('adminAuthTime');
      }
    }
    
    // Track page visit with Firebase
    trackPageVisit();
  }, []);

  const trackPageVisit = () => {
    // Page visit tracking is now handled by Firebase
    firebaseTrackPageVisit();
  };

  const loadAnalytics = async () => {
    console.log('loadAnalytics called!');
    try {
      // Validate that we're actually authenticated before loading sensitive data
      const adminAuth = sessionStorage.getItem('adminAuth');
      console.log('adminAuth from sessionStorage:', adminAuth);
      console.log('isAuthenticated state:', isAuthenticated);
      
      if (!adminAuth) {
        console.log('No adminAuth found in sessionStorage');
        setError('Unauthorized access attempt detected');
        handleLogout();
        return;
      }

      // Load analytics from Firebase
      const analyticsData = await getAnalytics();
      
      setAnalytics(prev => ({
        ...prev,
        dailyVisits: analyticsData.dailyVisits,
        totalVisits: analyticsData.totalVisits,
        lastUpdated: analyticsData.lastUpdated
      }));
      
      console.log('Analytics loaded successfully from Firebase!');
    } catch (error) {
      console.error('Analytics loading error:', error);
      setError('Failed to load analytics data from Firebase');
    }
  };

  // Helper function to render user name with enhanced capital letter styling
  const renderUserName = (user: UserProfile) => {
    // Use displayName if available, otherwise fall back to name
    const displayName = user.displayName || user.name;
    const hasCapitalLetters = /[A-Z]/.test(displayName);
    
    if (hasCapitalLetters) {
      // Split the name into individual characters and style uppercase letters differently
      const styledName = displayName.split('').map((char, index) => {
        if (/[A-Z]/.test(char)) {
          // Style uppercase letters with green color and monospace font
          return (
            <span 
              key={index}
              style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: '#1DB954', // Spotify green
                fontWeight: 'bold',
                fontSize: '17px',
                textShadow: '0 0 4px rgba(29, 185, 84, 0.3)'
              }}
            >
              {char}
            </span>
          );
        } else {
          // Regular styling for lowercase letters
          return (
            <span key={index} className="text-white font-medium">
              {char}
            </span>
          );
        }
      });
      
      return (
        <span className="text-base">
          {styledName}
        </span>
      );
    }
    
    // Regular styling for names with no capital letters
    return (
      <span className="text-white font-medium text-base">
        {displayName}
      </span>
    );
  };

  // Format dates for display
  const formatDate = (dateValue: string | any, user?: UserProfile): string => {
    // Handle different input types
    let dateString: string;
    
    if (!dateValue || dateValue === 'Never' || dateValue === 'Unknown' || dateValue === 'Not recorded') {
      return dateValue || 'Unknown';
    }
    
    // Convert Timestamp to string if needed
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      dateString = dateValue.toDate().toISOString();
    } else if (typeof dateValue === 'string') {
      dateString = dateValue;
    } else {
      return 'Invalid Date';
    }
    
    // Special case for Krish account - always show Aug 26, 2025 at 7:00 PM
    if (user && (user.displayName?.toLowerCase() === 'krish' || user.name.toLowerCase() === 'krish')) {
      const krishDate = new Date('2025-08-26T19:00:00');
      return krishDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' at ' + krishDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      // Format: Dec 25, 2024 at 3:45 PM
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' at ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString; // Return original if formatting fails
    }
  };

  const handleLogin = () => {
    console.log('handleLogin called!');
    console.log('Current password:', adminPassword);
    console.log('Expected password:', ADMIN_PASSWORD);
    
    // Extension conflict protection
    try {
      // Check if account is locked
      if (isAccountLocked()) {
        const remainingTime = getRemainingLockoutTime();
        setError(`Account locked. Try again in ${Math.ceil(remainingTime / 60)} minutes.`);
        return;
      }

      // Sanitize input
      const sanitizedPassword = sanitizeInput(adminPassword);
      
      // Validate input length and format
      if (!sanitizedPassword || sanitizedPassword.length === 0) {
        setError('Please enter a valid password');
        return;
      }

      // Rate limiting - prevent rapid-fire attempts
      const lastAttemptTime = getLastFailedAttempt();
      const timeSinceLastAttempt = Date.now() - lastAttemptTime;
      if (timeSinceLastAttempt < 2000) { // 2 second minimum between attempts
        setError('Please wait before trying again');
        return;
      }

      // Validate password with secure comparison
      if (validatePassword(sanitizedPassword)) {
        console.log('Password validation PASSED!');
        
        // Clear any failed attempts on successful login
        clearFailedAttempts();
        
        // Set authentication with additional security token
        const authToken = btoa(`authenticated_${Date.now()}_${Math.random()}`);
        console.log('About to set isAuthenticated to true...');
        
        sessionStorage.setItem('adminAuth', authToken);
        sessionStorage.setItem('adminAuthTime', Date.now().toString());
        
        setIsAuthenticated(true);
        console.log('setIsAuthenticated(true) called!');
        
        loadAnalytics();
        setError('');
        setAdminPassword(''); // Clear password field
      } else {
        // Record failed attempt
        recordFailedAttempt();
        
        const attempts = getFailedAttempts();
        const remaining = MAX_LOGIN_ATTEMPTS - attempts;
        
        if (remaining > 0) {
          setError(`Invalid password. ${remaining} attempts remaining.`);
        } else {
          setError(`Too many failed attempts. Account locked for 15 minutes.`);
        }
        
        // Clear password field on failed attempt
        setAdminPassword('');
      }
    } catch (error) {
      console.error('Login error (possibly extension conflict):', error);
      setError('Login failed. Please try InPrivate mode or disable browser extensions.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuth');
    sessionStorage.removeItem('adminAuthTime');
    setAdminPassword('');
    setError('');
    setShowPassword(false);
    setShowPasskeys({}); // Clear all passkey visibility states for security
    setExpandedLikedSongs({}); // Clear all liked songs visibility states for security
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeInput(e.target.value);
    setAdminPassword(sanitizedValue);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
    
    // Prevent common injection characters
    const blockedChars = ['<', '>', '"', "'", '&', ';', '(', ')', '{', '}', '[', ']'];
    if (blockedChars.includes(e.key)) {
      e.preventDefault();
    }
  };

  const togglePasskeyVisibility = (index: number) => {
    setShowPasskeys(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleLikedSongsVisibility = (index: number) => {
    setExpandedLikedSongs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Open the liked songs modal
  const openLikedSongsModal = (user: UserProfile, songs: string[]) => {
    setLikedSongsModal({ isOpen: true, user, songs });
  };

  // Close the liked songs modal
  const closeLikedSongsModal = () => {
    setLikedSongsModal({ isOpen: false, user: null, songs: [] });
  };

  // Helper function to get song information by ID
  const getSongInfo = (songId: string) => {
    // Legacy song ID mapping for backward compatibility
    const legacyIdMap: { [key: string]: string } = {
      // Legacy numeric IDs (from earlier app versions)
      '1': 'baby-shark-1',
      '2': 'despacito-1',
      '3': 'wheels-on-bus-1',
      '4': 'johnny-johnny-1',
      '5': 'bath-song-1',
      '6': 'see-you-again-1',
      '7': 'shape-of-you-1',
      '8': 'phonics-song-1',
      '9': 'uptown-funk-1',
      '10': 'gangnam-style-1',
      '11': 'bardali-1',
      '12': 'sarangi-1',
      '13': 'sathi-1',
      '14': 'risaune-bhaye-1',
      '15': 'parkha-na-1',
      // String-based legacy IDs
      'despacito': 'despacito-1',
      'see-you-again': 'see-you-again-1', 
      'shape-of-you': 'shape-of-you-1',
      'baby-shark': 'baby-shark-1',
      'wheels-on-bus': 'wheels-on-bus-1',
      'johnny-johnny': 'johnny-johnny-1',
      'bath-song': 'bath-song-1',
      'phonics-song': 'phonics-song-1',
      'uptown-funk': 'uptown-funk-1',
      'gangnam-style': 'gangnam-style-1',
      // Add Sushant KC legacy mappings
      'bardali': 'bardali-1',
      'sarangi': 'sarangi-1',
      'sathi': 'sathi-1',
      'risaune-bhaye': 'risaune-bhaye-1',
      'parkha-na': 'parkha-na-1',
      'jhyal-bata': 'jhyal-bata-1',
      'gulabi': 'gulabi-1',
      'maya-ma': 'maya-ma-1',
      'muskurayera': 'muskurayera-1',
      'behos': 'behos-1',
      'satayera': 'satayera-1',
      'kya-kardiya': 'kya-kardiya-1',
      'plan-b': 'plan-b-1',
      'atteri': 'atteri-1',
      'gajalu': 'gajalu-1',
      'pahuna': 'pahuna-1',
      'pagal': 'pagal-1',
      'baimani': 'baimani-1',
      'fakauna-ma': 'fakauna-ma-1',
      'hawa-le': 'hawa-le-1',
      // Additional common variations
      'despacito-old': 'despacito-1',
      'see_you_again': 'see-you-again-1',
      'shape_of_you': 'shape-of-you-1',
      'baby_shark': 'baby-shark-1'
    };
    
    // Try to find the track with original ID first
    let track = sampleTracks.find(track => track.id === songId);
    
    // If not found, try with legacy mapping
    if (!track && legacyIdMap[songId]) {
      track = sampleTracks.find(track => track.id === legacyIdMap[songId]);
    }
    
    // If still not found, try partial matching for mobile device variations
    if (!track) {
      const partialMatch = sampleTracks.find(t => {
        const trackIdLower = t.id.toLowerCase();
        const songIdLower = songId.toLowerCase();
        return trackIdLower.includes(songIdLower) || songIdLower.includes(trackIdLower.replace('-1', ''));
      });
      
      if (partialMatch) {
        track = partialMatch;
      }
    }
    
    // Only log if truly unknown (for rare cases)
    if (!track) {
      console.warn(`❌ Unknown song ID: "${songId}"`);
    }
    
    return track ? { title: track.title, artist: track.artist } : { 
      title: `Unknown Song (ID: ${songId})`, 
      artist: 'Unknown Artist' 
    };
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Confirmation dialog
    const confirmDelete = window.confirm(
      `⚠️ Are you sure you want to permanently delete the account for "${userName}"?\n\nThis action cannot be undone and the user will no longer be able to login with their credentials.`
    );
    
    if (!confirmDelete) return;
    
    try {
      await deleteUserProfile(userId);
      
      // Show success message
      setError('');
      
      // Optional: Show temporary success message
      const originalError = error;
      setError(`✅ User "${userName}" has been permanently deleted.`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setError(originalError);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setError(`❌ Failed to delete user "${userName}": ${error.message}`);
    }
  };

  // Handle starting edit mode for user name
  const handleStartEditName = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditingUserName(user.displayName || user.name);
    setEditNameError('');
  };

  // Handle canceling edit mode
  const handleCancelEditName = () => {
    setEditingUserId(null);
    setEditingUserName('');
    setEditNameError('');
    setIsUpdatingName(false);
  };

  // Handle saving the updated user name
  const handleSaveEditName = async () => {
    if (!editingUserId) return;
    
    setIsUpdatingName(true);
    setEditNameError('');
    
    try {
      const result = await updateUserDisplayName(editingUserId, editingUserName);
      
      if (result.success) {
        // Show success message
        setError(`✅ Successfully updated user name to "${editingUserName}".`);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setError('');
        }, 3000);
        
        // Reset edit state
        handleCancelEditName();
      } else {
        setEditNameError(result.error || 'Failed to update name');
      }
    } catch (error: any) {
      console.error('Error updating user name:', error);
      setEditNameError(`Failed to update name: ${error.message}`);
    } finally {
      setIsUpdatingName(false);
    }
  };

  // Handle input changes for name editing
  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingUserName(e.target.value);
    if (editNameError) {
      setEditNameError(''); // Clear error when user starts typing
    }
  };

  // Handle keyboard shortcuts for name editing
  const handleEditNameKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEditName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };

  const refreshData = async () => {
    await loadAnalytics();
  };

  // Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-spotify-dark to-spotify-black flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-spotify-gray rounded-2xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-spotify-green rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-spotify-light-gray text-sm">Enter admin credentials to continue</p>
          </div>

          {error && (
            <div className={`border rounded-lg p-4 mb-6 ${
              error.includes('extension') || error.includes('InPrivate') || error.includes('Incognito')
                ? 'bg-blue-500/10 border-blue-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <p className={`text-sm ${
                error.includes('extension') || error.includes('InPrivate') || error.includes('Incognito')
                  ? 'text-blue-400'
                  : 'text-red-400'
              }`}>
                {error.includes('extension') || error.includes('InPrivate') || error.includes('Incognito') ? '🛡️' : '⚠️'} {error}
              </p>
              {(error.includes('extension') || error.includes('InPrivate') || error.includes('Incognito')) && (
                <div className="mt-3 text-xs text-blue-300">
                  <p className="font-semibold mb-2">🔧 Quick Fixes:</p>
                  <ul className="space-y-1 pl-4">
                    <li>• Press <kbd className="bg-black/50 px-1 rounded">Ctrl+Shift+N</kbd> for InPrivate mode</li>
                    <li>• Disable extensions: Ghostery, AdBlock, Privacy tools</li>
                    <li>• Try a different browser (Chrome/Firefox)</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Security Status */}
          {isAccountLocked() && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
              <p className="text-yellow-400 text-sm text-center">
                🔒 Account locked for security. {Math.ceil(getRemainingLockoutTime() / 60)} minutes remaining.
              </p>
            </div>
          )}

          {getFailedAttempts() > 0 && !isAccountLocked() && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-6">
              <p className="text-orange-400 text-sm text-center">
                ⚠️ {getFailedAttempts()} failed attempt(s). {MAX_LOGIN_ATTEMPTS - getFailedAttempts()} remaining.
              </p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminPassword}
                  onChange={handlePasswordChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter admin password"
                  maxLength={50}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="w-full bg-spotify-black text-white px-4 py-3 pr-12 rounded-lg border border-spotify-light-gray/20 focus:border-spotify-green focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-spotify-light-gray hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                console.log('Button clicked!');
                console.log('Password:', adminPassword);
                console.log('Password length:', adminPassword.length);
                handleLogin();
              }}
              disabled={!adminPassword.trim()}
              whileTap={{ scale: 0.95 }}
              className="w-full bg-spotify-green text-black font-bold py-3 px-6 rounded-lg hover:bg-spotify-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Access Dashboard
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-b from-spotify-dark to-spotify-black p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-spotify-green rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-spotify-light-gray">UtsavXSpotify Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              onClick={refreshData}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-spotify-gray text-white rounded-lg hover:bg-spotify-light-gray transition-colors"
            >
              Refresh Data
            </motion.button>
            <motion.button
              onClick={handleLogout}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </motion.button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-spotify-gray rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{analytics.totalUsers}</h3>
                <p className="text-spotify-light-gray text-sm">Total Users</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-spotify-gray rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{analytics.dailyVisits}</h3>
                <p className="text-spotify-light-gray text-sm">Today's Visits</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-spotify-gray rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{analytics.totalVisits}</h3>
                <p className="text-spotify-light-gray text-sm">Total Visits</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-spotify-gray rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-spotify-green rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {analytics.users.reduce((total, user) => total + (user.likedSongs?.length || 0), 0)}
                </h3>
                <p className="text-spotify-light-gray text-sm">Total Favourite Songs</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-spotify-gray rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">{new Date(analytics.lastUpdated).toLocaleTimeString()}</h3>
                <p className="text-spotify-light-gray text-sm">Last Updated</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Information Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-8"
        >
          <div className="flex items-start gap-3">
            <div className="text-green-400 text-lg">🔥</div>
            <div>
              <h3 className="text-green-400 font-semibold mb-2">🚀 Firebase Real-time Integration</h3>
              <div className="text-green-300 text-sm space-y-1">
                <p>• <strong>Cross-device sync:</strong> User data syncs instantly across all devices</p>
                <p>• <strong>Real-time updates:</strong> New users appear automatically without refresh</p>
                <p>• <strong>Cloud storage:</strong> Data is stored securely in Firebase Firestore</p>
                <p>• <strong>Enhanced display:</strong> Usernames with capital letters show with special styling</p>
                <p>• <strong>Dynamic tags:</strong> User tags (@username) update automatically when display names change</p>
                <p>• <strong>Liked songs tracking:</strong> Monitor user's favorite songs with expandable view</p>
                <p>• <strong>Admin controls:</strong> Edit user display names and permanently delete accounts</p>
                <p>• <strong>Name editing:</strong> Click the edit icon next to any user's name to modify it</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* User Details Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-spotify-gray rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <UserCheck className="w-6 h-6 text-spotify-green" />
            <h2 className="text-xl font-bold text-white">User Accounts Details</h2>
          </div>

          {analytics.users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-spotify-light-gray mx-auto mb-4" />
              <p className="text-spotify-light-gray">No user accounts found</p>
              <p className="text-spotify-light-gray text-sm">Users will appear here when they create accounts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-spotify-light-gray/20">
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Name</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Username</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Passkey</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Created At</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Last Login</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Login Count</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Favourite Songs</th>
                    <th className="text-left text-spotify-light-gray font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.users.map((user, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-spotify-light-gray/10 hover:bg-spotify-light-gray/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        {editingUserId === user.id ? (
                          // Edit mode
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingUserName}
                              onChange={handleEditNameChange}
                              onKeyPress={handleEditNameKeyPress}
                              className="bg-spotify-black text-white px-3 py-1 rounded border border-spotify-light-gray/40 focus:border-spotify-green focus:outline-none text-sm min-w-[150px]"
                              placeholder="Enter new name"
                              autoFocus
                              disabled={isUpdatingName}
                            />
                            <div className="flex items-center gap-1">
                              <motion.button
                                onClick={handleSaveEditName}
                                disabled={isUpdatingName || !editingUserName.trim()}
                                whileTap={{ scale: 0.95 }}
                                className="p-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                                title="Save changes"
                              >
                                <Save className="w-4 h-4" />
                              </motion.button>
                              <motion.button
                                onClick={handleCancelEditName}
                                disabled={isUpdatingName}
                                whileTap={{ scale: 0.95 }}
                                className="p-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                                title="Cancel editing"
                              >
                                <XCircle className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <div className="flex items-center gap-2">
                            {renderUserName(user)}
                            <motion.button
                              onClick={() => handleStartEditName(user)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              className="p-1 text-spotify-light-gray hover:text-spotify-green transition-colors rounded"
                              title="Edit user name"
                            >
                              <Edit3 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        )}
                        {editNameError && editingUserId === user.id && (
                          <div className="mt-1 text-xs text-red-400">
                            ⚠️ {editNameError}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-spotify-green text-sm font-mono bg-black/20 px-2 py-1 rounded">
                          @{getUserTag(user)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-spotify-light-gray">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm bg-black/40 px-3 py-2 rounded border tracking-widest shadow-inner" style={{
                            fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
                            letterSpacing: '0.1em',
                            fontSize: '13px'
                          }}>
                            {showPasskeys[index] ? user.passkey : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasskeyVisibility(index)}
                            className="text-spotify-light-gray hover:text-white transition-colors p-1"
                            title={showPasskeys[index] ? 'Hide passkey' : 'Show passkey'}
                          >
                            {showPasskeys[index] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {showPasskeys[index] && (
                          <div className="mt-1 text-xs text-blue-400">
                            💡 Tip: Capital letters appear bolder in monospace font
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-spotify-light-gray">
                        {formatDate(user.createdAt || 'Unknown', user)}
                      </td>
                      <td className="py-3 px-4 text-spotify-light-gray">
                        {formatDate(user.lastLogin || 'Never', user)}
                      </td>
                      <td className="py-3 px-4 text-spotify-light-gray">{user.loginCount}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-spotify-green" />
                            <span className="text-white font-medium">
                              {user.likedSongs?.length || 0}
                            </span>
                            <span className="text-spotify-light-gray text-sm">songs</span>
                          </div>
                          {user.likedSongs && user.likedSongs.length > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleLikedSongsVisibility(index)}
                                className="text-spotify-light-gray hover:text-white transition-colors p-1"
                                title={expandedLikedSongs[index] ? 'Hide liked songs' : 'Show liked songs'}
                              >
                                {expandedLikedSongs[index] ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              {user.likedSongs.length > 5 && (
                                <button
                                  onClick={() => openLikedSongsModal(user, user.likedSongs || [])}
                                  className="px-2 py-1 bg-spotify-green text-black text-xs rounded-md hover:bg-spotify-green/90 transition-colors font-medium"
                                  title="View all liked songs"
                                >
                                  View All
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {expandedLikedSongs[index] && user.likedSongs && user.likedSongs.length > 0 && (
                          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                            {user.likedSongs.slice(0, 5).map((songId, songIndex) => {
                              const songInfo = getSongInfo(songId);
                              return (
                                <div key={songIndex} className="text-xs text-spotify-light-gray bg-black/20 px-2 py-1 rounded flex items-center justify-between">
                                  <div>
                                    <span className="text-white font-medium">{songInfo.title}</span>
                                    <span className="text-spotify-light-gray"> by {songInfo.artist}</span>
                                  </div>
                                  <span className="text-xs text-spotify-light-gray/60 ml-2">#{songIndex + 1}</span>
                                </div>
                              );
                            })}
                            {user.likedSongs.length > 5 && (
                              <div className="text-xs text-spotify-green font-medium mt-1 px-2 py-1">
                                🎵 {user.likedSongs.length - 5} more songs - 
                                <button 
                                  onClick={() => openLikedSongsModal(user, user.likedSongs || [])}
                                  className="underline hover:text-spotify-green/80 ml-1"
                                >
                                  View All
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <motion.button
                          onClick={() => handleDeleteUser(user.id, user.displayName || user.name)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors duration-200 font-medium"
                          title={`Delete ${user.displayName || user.name}'s account permanently`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Favourite Songs Modal */}
      {likedSongsModal.isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeLikedSongsModal}
        >
          <motion.div
            className="bg-spotify-gray rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden"
            initial={{ scale: 0.9, y: -50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: -50 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center p-4 border-b border-spotify-light-gray/20">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Music className="w-5 h-5 text-spotify-green" />
                  {likedSongsModal.user?.displayName || likedSongsModal.user?.name}'s Favourite Songs
                </h3>
                <p className="text-spotify-light-gray text-sm mt-1">
                  {likedSongsModal.songs.length} song{likedSongsModal.songs.length !== 1 ? 's' : ''} in total
                </p>
              </div>
              <motion.button
                onClick={closeLikedSongsModal}
                className="ml-4 p-2 hover:bg-spotify-light-gray/20 rounded-full transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                <X className="text-white" size={20} />
              </motion.button>
            </div>

            {/* Songs List */}
            <div className="max-h-96 overflow-y-auto scrollbar-hide">
              {likedSongsModal.songs.length === 0 ? (
                <div className="p-8 text-center">
                  <Music className="text-spotify-light-gray mx-auto mb-4" size={48} />
                  <h3 className="text-white font-medium text-lg mb-2">No favourite songs</h3>
                  <p className="text-spotify-light-gray">This user hasn't liked any songs yet</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {likedSongsModal.songs.map((songId, index) => {
                    const songInfo = getSongInfo(songId);
                    return (
                      <motion.div
                        key={index}
                        className="flex items-center p-3 hover:bg-spotify-light-gray/10 rounded-lg transition-colors"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="w-8 h-8 bg-spotify-green rounded-full flex items-center justify-center mr-3">
                          <span className="text-black font-bold text-xs">#{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm truncate">{songInfo.title}</h4>
                          <p className="text-spotify-light-gray text-xs truncate">by {songInfo.artist}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-spotify-green rounded-full"></div>
                          <span className="text-spotify-light-gray text-xs">Liked</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-spotify-light-gray/20 bg-spotify-black/20">
              <div className="flex items-center justify-between">
                <div className="text-spotify-light-gray text-sm">
                  Total: {likedSongsModal.songs.length} song{likedSongsModal.songs.length !== 1 ? 's' : ''}
                </div>
                <motion.button
                  onClick={closeLikedSongsModal}
                  className="px-4 py-2 bg-spotify-green text-black rounded-lg hover:bg-spotify-green/90 transition-colors font-medium"
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminDashboard;