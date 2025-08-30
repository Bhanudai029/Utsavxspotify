import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { createUserProfile, loginUser, getAllUsers } from '../lib/firebaseService';
import { useUser } from '../contexts/UserContext';

interface ProfileAuthProps {
  onAuth: (name: string, passkey: string) => void;
  customTitle?: string;
  customMessage?: string;
}

const ProfileAuth = ({ onAuth, customTitle, customMessage }: ProfileAuthProps) => {
  const { login } = useUser();
  const [name, setName] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);

  // Check if user profiles exist on component mount
  useEffect(() => {
    const checkExistingUsers = async () => {
      try {
        const users = await getAllUsers();
        if (users.length > 0) {
          setIsLoginMode(true);
        }
      } catch (error) {
        console.error('Error checking existing users:', error);
      }
    };
    
    checkExistingUsers();
  }, []);

  const validateName = (value: string) => {
    if (isLoginMode) return true; // Skip validation in login mode
    
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!value.trim()) {
      setNameError('Name is required');
      return false;
    }
    if (!nameRegex.test(value)) {
      setNameError('Name can only contain letters and spaces');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (value) {
      validateName(value);
    } else {
      setNameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    
    try {
      if (isLoginMode) {
        // Login existing user
        const userProfile = await loginUser(name, passkey);
        if (userProfile) {
          await login(userProfile); // Use context login method with await
          onAuth(userProfile.displayName || userProfile.name, passkey);
          setIsLoading(false);
        }
      } else {
        // Create new profile or auto-login
        const isNameValid = validateName(name);
        if (!isNameValid || !passkey.trim()) {
          setIsLoading(false);
          return;
        }
        
        try {
          const userProfile = await createUserProfile(name, passkey);
          if (userProfile) {
            // Check if this was an auto-login (existing user)
            if (userProfile.loginCount > 1) {
              setAuthError('Account already exists with these credentials. Logging you in...');
              await login(userProfile); // Use context login method with await
              onAuth(userProfile.displayName || userProfile.name, passkey);
              setIsLoading(false);
            } else {
              // New user created
              await login(userProfile); // Use context login method with await
              onAuth(userProfile.displayName || userProfile.name, passkey);
              setIsLoading(false);
            }
          }
        } catch (error: any) {
          if (error.message === 'User already exists with different passkey') {
            setAuthError('User already exists');
            setPasskey(''); // Clear passkey for security
            
            // Show a brief message then switch to login mode
            setTimeout(() => {
              setIsLoginMode(true);
              setAuthError(''); // Clear error when switching to login
              setIsLoading(false);
            }, 1500);
            return;
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setIsLoading(false);
      
      if (error.message === 'User not found') {
        setAuthError('User not found. Please check your name or create a new account.');
      } else if (error.message === 'Invalid passkey') {
        setAuthError('Invalid passkey. Please check your credentials.');
      } else {
        setAuthError('Authentication failed. Please check your internet connection and try again.');
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-b from-spotify-dark to-spotify-black p-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md bg-spotify-gray rounded-2xl p-8 shadow-2xl"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="w-20 h-20 bg-spotify-green rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {customTitle || (isLoginMode ? 'Welcome Back' : 'Create Your Profile')}
          </h1>
          <p className="text-spotify-light-gray text-sm">
            {customMessage || (isLoginMode 
              ? 'Enter your credentials to access your music profile'
              : 'Enter your details to create your music profile'
            )}
          </p>
        </motion.div>

        <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-6">
          {/* Auth Error */}
          {authError && (
            <div className={`border rounded-lg p-3 ${
              authError === 'User already exists' || authError.includes('Account already exists') 
                ? 'bg-blue-500/10 border-blue-500/20' 
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <p className={`text-sm flex items-center ${
                authError === 'User already exists' || authError.includes('Account already exists') 
                  ? 'text-blue-400' 
                  : 'text-red-400'
              }`}>
                <span className="mr-2">
                  {authError === 'User already exists' || authError.includes('Account already exists') ? 'ℹ️' : '⚠️'}
                </span>
                {authError}
                {authError === 'User already exists' && (
                  <span className="ml-2 text-xs text-blue-300">
                    (Switching to login...)
                  </span>
                )}
                {authError.includes('Account already exists') && (
                  <span className="ml-2 text-xs text-blue-300">
                    (Auto-login in progress...)
                  </span>
                )}
              </p>
            </div>
          )}
          {/* Name Input */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-spotify-light-gray" />
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className={`w-full bg-spotify-black text-white pl-12 pr-4 py-3 rounded-lg border transition-colors ${
                  nameError 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-spotify-light-gray/20 focus:border-spotify-green'
                } focus:outline-none`}
                required
              />
            </div>
            {nameError && (
              <p className="text-red-400 text-xs mt-1 flex items-center">
                <span className="mr-1">⚠️</span>
                {nameError}
              </p>
            )}
          </div>

          {/* Passkey Input */}
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Secret Passkey
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-spotify-light-gray" />
              <input
                type={showPasskey ? "text" : "password"}
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter your unique passkey"
                className="w-full bg-spotify-black text-white pl-12 pr-12 py-3 rounded-lg border border-spotify-light-gray/20 focus:border-spotify-green focus:outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasskey(!showPasskey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-spotify-light-gray hover:text-white transition-colors"
              >
                {showPasskey ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={!name.trim() || !passkey.trim() || (!!nameError && !isLoginMode) || isLoading}
            whileTap={{ scale: 0.95 }}
            className="w-full bg-spotify-green text-black font-bold py-3 px-6 rounded-lg hover:bg-spotify-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2"></div>
                {isLoginMode ? 'Logging In...' : 'Creating Profile...'}
              </div>
            ) : (
              isLoginMode ? 'Login' : 'Create Profile'
            )}
          </motion.button>

          {/* Mode Toggle */}
          <motion.div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setAuthError('');
                setNameError('');
                // Keep the name when switching modes for better UX
                // setName(''); // Commented out to preserve name
                setPasskey('');
              }}
              className="text-spotify-green hover:text-white text-sm transition-colors font-medium"
            >
              {isLoginMode 
                ? "Don't have a profile? Create one" 
                : "Already have a profile? Login"
              }
            </button>
          </motion.div>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default ProfileAuth;