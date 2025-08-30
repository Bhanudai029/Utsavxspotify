// Quick test script to check Supabase connection and list audio files
// Run this in browser console or as a Node script

import { supabase } from './src/lib/supabase'

const testSupabaseConnection = async () => {
  console.log('🔍 Testing Supabase Connection...')
  
  try {
    // Test 1: Check environment variables
    console.log('📋 Environment Variables:')
    console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
    console.log('Key length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length)
    
    // Test 2: List storage buckets
    console.log('\n🗂️ Listing Storage Buckets...')
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('❌ Buckets Error:', bucketsError)
    } else {
      console.log('✅ Buckets found:', buckets?.map(b => b.name))
    }
    
    // Test 3: List files in audio bucket (try common bucket names)
    const possibleBucketNames = ['audio-files', 'audio', 'music', 'songs', 'tracks']
    
    for (const bucketName of possibleBucketNames) {
      console.log(`\n🎵 Checking bucket: ${bucketName}`)
      const { data: files, error: filesError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 10 })
      
      if (filesError) {
        console.log(`❌ ${bucketName}:`, filesError.message)
      } else if (files && files.length > 0) {
        console.log(`✅ ${bucketName} files:`, files.map(f => f.name))
        
        // Test getting a public URL for the first audio file
        if (files[0]) {
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(files[0].name)
          console.log(`🔗 Sample URL:`, urlData.publicUrl)
        }
      } else {
        console.log(`📭 ${bucketName}: Empty or doesn't exist`)
      }
    }
    
    // Test 4: Check database connection
    console.log('\n🗄️ Testing Database Connection...')
    const { data: dbTest, error: dbError } = await supabase
      .from('tracks')
      .select('count')
      .limit(1)
    
    if (dbError) {
      console.log('❌ Database Error:', dbError.message)
      console.log('💡 This is expected if you haven\'t set up the database schema yet')
    } else {
      console.log('✅ Database connection successful')
    }
    
  } catch (error) {
    console.error('💥 Connection Test Failed:', error)
  }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  testSupabaseConnection()
}

export { testSupabaseConnection }