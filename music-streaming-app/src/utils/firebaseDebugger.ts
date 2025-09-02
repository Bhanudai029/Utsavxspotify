import { auth, storage } from '../lib/firebase';
import { ref, getMetadata } from 'firebase/storage';

export class FirebaseDebugger {
  static async diagnoseFirebaseIssues(): Promise<void> {
    console.log('🔍 Firebase Diagnostic Report');
    console.log('============================');
    
    // Check Auth Status
    console.log('1. Authentication Status:');
    if (auth.currentUser) {
      console.log('✅ User authenticated:', auth.currentUser.uid);
      console.log('   - Is Anonymous:', auth.currentUser.isAnonymous);
      console.log('   - Email:', auth.currentUser.email || 'none');
      console.log('   - Provider:', auth.currentUser.providerData.length > 0 ? auth.currentUser.providerData[0].providerId : 'anonymous');
      console.log('   - Creation time:', auth.currentUser.metadata.creationTime);
      console.log('   - Last sign in:', auth.currentUser.metadata.lastSignInTime);
    } else {
      console.log('❌ No authenticated user');
      console.log('   → This may cause uploads to fail if storage rules require authentication');
    }
    
    // Check Storage Configuration
    console.log('\n2. Storage Configuration:');
    console.log('   - Bucket:', storage.app.options.storageBucket);
    console.log('   - App:', storage.app.name);
    console.log('   - Project ID:', storage.app.options.projectId);
    console.log('   - API Key exists:', !!storage.app.options.apiKey);
    
    // Test Storage Access
    console.log('\n3. Storage Access Test:');
    try {
      const testRef = ref(storage, 'song-images/test.txt');
      await getMetadata(testRef).catch((error) => {
        if (error.code === 'storage/object-not-found') {
          console.log('✅ Storage access confirmed (object-not-found error is expected for test file)');
        } else {
          console.log('⚠️ Storage access warning:', error.code, error.message);
        }
      });
    } catch (error) {
      console.log('❌ Storage access error:', error);
    }
    
    // Check Network & Performance
    console.log('\n4. Network Status:');
    console.log('   - Online:', navigator.onLine);
    console.log('   - Connection type:', (navigator as any).connection?.effectiveType || 'unknown');
    console.log('   - Download speed estimate:', (navigator as any).connection?.downlink ? `${(navigator as any).connection.downlink}Mbps` : 'unknown');
    console.log('   - Round trip time:', (navigator as any).connection?.rtt ? `${(navigator as any).connection.rtt}ms` : 'unknown');
    
    // Performance timing for Firebase
    console.log('\n5. Firebase Performance:');
    const start = performance.now();
    try {
      // Test Firebase connection speed
      const testRef = ref(storage, '.info/test');
      await getMetadata(testRef).catch(() => {});
      const end = performance.now();
      console.log(`   - Firebase response time: ${(end - start).toFixed(2)}ms`);
    } catch (error) {
      console.log('   - Firebase response test failed:', error);
    }
    
    console.log('\n============================');
  }
  
  static logUploadStart(file: File, fileName: string): void {
    console.log('🚀 Upload Starting:');
    console.log('   - File:', file.name);
    console.log('   - Size:', `${(file.size / 1024).toFixed(2)} KB`);
    console.log('   - Type:', file.type);
    console.log('   - Target name:', fileName);
    console.log('   - Auth user:', auth.currentUser?.uid || 'none');
    console.log('   - Timestamp:', new Date().toISOString());
    console.log('   - Expected upload time:', `~${(file.size / (1024 * 100)).toFixed(1)}s at 100KB/s`);
  }
  
  static logUploadProgress(progress: number, bytesTransferred: number, totalBytes: number): void {
    const timestamp = new Date().toISOString();
    console.log(`📈 Upload Progress [${timestamp}]: ${progress.toFixed(1)}% (${bytesTransferred}/${totalBytes} bytes)`);
    
    // Check for stuck progress with detailed analysis
    if (progress > 15 && progress < 25) {
      console.log('⚠️  ❗ CRITICAL: Upload may be stuck in authentication phase - this is the COMMON 20% ISSUE!');
      console.log('   • This typically indicates Firebase Storage rules or authentication problems');
      console.log('   • Progress at 20% usually means file upload started but authentication is blocking it');
      console.log('   • Check Firebase Console > Storage > Rules for proper permissions');
      console.log('   • The system will automatically try fallback strategies in 60 seconds');
    }
    
    // Track progress milestones
    const milestone = Math.floor(progress / 10) * 10;
    if (progress >= milestone && progress < milestone + 1) {
      console.log(`🎆 Milestone: ${milestone}% completed`);
    }
  }
  
  static logUploadError(error: any): void {
    console.log('❌ Upload Error Details:');
    console.log('   - Code:', error.code || 'unknown');
    console.log('   - Message:', error.message || 'unknown');
    console.log('   - Stack:', error.stack || 'unknown');
    
    // Provide specific guidance
    if (error.code === 'storage/unauthenticated') {
      console.log('💡 Solution: Authentication issue - refresh page and try again');
    } else if (error.code === 'storage/unauthorized') {
      console.log('💡 Solution: Permission issue - check Firebase Storage rules');
    } else if (error.message?.includes('network')) {
      console.log('💡 Solution: Network issue - check internet connection');
    }
  }
  
  static async testAuthentication(): Promise<boolean> {
    console.log('🔐 Testing Authentication...');
    
    try {
      if (auth.currentUser) {
        console.log('✅ Already authenticated:', auth.currentUser.uid);
        return true;
      }
      
      console.log('⏳ Waiting for auth state...');
      
      return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          if (user) {
            console.log('✅ Authentication successful:', user.uid);
            resolve(true);
          } else {
            console.log('❌ Authentication failed');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.log('❌ Authentication test failed:', error);
      return false;
    }
  }
  
  /**
   * Monitor upload in real-time with detailed tracking
   */
  static startUploadMonitor(fileName: string, totalBytes: number): {
    update: (bytesTransferred: number) => void;
    stop: () => void;
  } {
    const startTime = Date.now();
    let lastBytes = 0;
    let lastTime = startTime;
    let stuckCount = 0;
    
    console.log(`🕰️ Starting upload monitor for: ${fileName}`);
    console.log(`📁 Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`🕒 Upload running for: ${elapsed.toFixed(1)}s`);
      
      if (elapsed > 60) { // After 1 minute
        console.log('⚠️ Upload has been running for over 1 minute - this may indicate an issue');
      }
      
      if (elapsed > 300) { // After 5 minutes
        console.log('❌ Upload timeout reached - stopping monitor');
        clearInterval(interval);
      }
    }, 10000); // Every 10 seconds
    
    return {
      update: (bytesTransferred: number) => {
        const currentTime = Date.now();
        const progress = (bytesTransferred / totalBytes) * 100;
        const speed = (bytesTransferred - lastBytes) / ((currentTime - lastTime) / 1000);
        const eta = speed > 0 ? (totalBytes - bytesTransferred) / speed : 0;
        
        console.log(`📋 Monitor Update: ${progress.toFixed(1)}% | Speed: ${(speed / 1024).toFixed(2)} KB/s | ETA: ${eta.toFixed(1)}s`);
        
        // Detect stuck uploads
        if (bytesTransferred === lastBytes && progress > 5) {
          stuckCount++;
          if (stuckCount >= 3) {
            console.warn(`⚠️ STUCK DETECTED: No progress for ${stuckCount * 10} seconds at ${progress.toFixed(1)}%`);
            if (progress > 15 && progress < 25) {
              console.warn('❌ THIS IS THE 20% STUCK ISSUE - Upload is likely blocked by authentication/rules');
            }
          }
        } else {
          stuckCount = 0;
        }
        
        lastBytes = bytesTransferred;
        lastTime = currentTime;
      },
      stop: () => {
        clearInterval(interval);
        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`🏁 Upload monitor stopped after ${totalTime.toFixed(1)}s`);
      }
    };
  }
}