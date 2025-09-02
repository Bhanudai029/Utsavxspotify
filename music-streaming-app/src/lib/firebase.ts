import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyOgh68Cuqhxzm11VGVRcc2W4BYFXP4ZNOk",
  authDomain: "music-x-dfd87.firebaseapp.com",
  projectId: "music-x-dfd87",
  storageBucket: "music-x-dfd87.firebasestorage.app",
  messagingSenderId: "600929755806",
  appId: "1:600929755806:web:3e11645bd94118854618f",
  measurementId: "G-QNP4BFQ9ZM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Auto-sign in anonymously for storage access
let authInitialized = false;
let authPromise: Promise<void> | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;

export const ensureAuth = async (): Promise<void> => {
  // Enhanced authentication with better CORS handling and timeout management
  
  // If already initialized and authenticated, return immediately
  if (authInitialized && auth.currentUser) {
    console.log('✅ Already authenticated:', auth.currentUser.uid);
    return;
  }
  
  // If authentication is in progress, wait for it
  if (authPromise) {
    console.log('⏳ Authentication in progress, waiting...');
    return authPromise;
  }
  
  // Start authentication process with improved error handling
  authPromise = (async () => {
    try {
      console.log('🔐 Starting Firebase authentication process...');
      
      // Check if already signed in
      if (auth.currentUser) {
        console.log('✅ Already authenticated:', auth.currentUser.uid);
        authInitialized = true;
        return;
      }
      
      // Wait for auth state to be ready with proper timeout
      const authStatePromise = new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          console.log('⏰ Auth state check timeout, proceeding without authentication');
          resolve(false);
        }, 5000); // Reduced timeout for faster fallback
        
        const unsubscribe = auth.onAuthStateChanged((user) => {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(!!user);
        });
      });
      
      const hasUser = await authStatePromise;
      
      // If still no user after auth state check, try anonymous sign in with retry
      if (!hasUser && !auth.currentUser) {
        console.log('🔑 Attempting anonymous authentication...');
        
        let authAttempts = 0;
        const maxAuthAttempts = 2; // Reduced attempts for faster fallback
        
        while (authAttempts < maxAuthAttempts && !auth.currentUser) {
          try {
            authAttempts++;
            console.log(`🔑 Auth attempt ${authAttempts}/${maxAuthAttempts}`);
            
            const userCredential = await Promise.race([
              signInAnonymously(auth),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Auth timeout')), 3000) // Faster timeout
              )
            ]);
            
            console.log('✅ Anonymous authentication successful:', userCredential.user.uid);
            break;
          } catch (authError: any) {
            console.warn(`⚠️ Auth attempt ${authAttempts} failed:`, authError.message || authError);
            
            // Special handling for CORS and network errors
            if (authError.message?.includes('CORS') || 
                authError.message?.includes('network') ||
                authError.code === 'auth/network-request-failed') {
              console.log('🌐 Network/CORS issue detected, but storage rules allow public access');
              break; // Exit auth attempts, rely on public storage rules
            }
            
            if (authAttempts < maxAuthAttempts) {
              // Shorter wait before retry
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        if (!auth.currentUser) {
          console.log('🛡️ Auth attempts completed, proceeding with public storage rules');
        }
      }
      
      authInitialized = true;
      console.log('✅ Firebase authentication process completed');
      
    } catch (error: any) {
      console.log('🛡️ Firebase authentication setup failed, using public storage rules:', error.message || error);
      // Mark as initialized anyway since storage rules allow public access
      authInitialized = true;
      
      // Only increment retry count on critical errors
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.log(`🏁 Authentication setup completed after ${MAX_RETRIES} attempts`);
        // Still don't throw - let storage rules handle access
      }
    } finally {
      authPromise = null;
    }
  })();
  
  return authPromise;
};

// Initialize auth on module load
export const initializeAuth = async (): Promise<void> => {
  try {
    await ensureAuth();
  } catch (error) {
    console.warn('Initial auth setup failed:', error);
  }
};

// Auto-initialize
initializeAuth();

export default app;