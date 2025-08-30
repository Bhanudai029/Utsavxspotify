# Supabase Integration Setup Guide

## 📋 Prerequisites
- Supabase account (create at https://supabase.com)
- Audio files ready for upload
- Basic understanding of Supabase Storage and Database

## 🚀 Step-by-Step Setup

### 1. Create Supabase Project
1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project name (e.g., "music-streaming-app")
5. Enter database password (save this!)
6. Select region closest to your users
7. Click "Create new project"

### 2. Get Project Credentials
1. Go to Project Settings → API
2. Copy your Project URL
3. Copy your anon/public key
4. Update your `.env` file:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set Up Database
1. Go to SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `supabase-schema.sql`
3. Click "Run" to execute the SQL
4. This creates:
   - `tracks` table for music metadata
   - `playlists` table for playlists
   - `playlist_tracks` junction table
   - `user_favorites` for favourite songs
   - Sample data for testing

### 4. Set Up Storage
1. Go to Storage in your Supabase dashboard
2. Create a new bucket called "audio-files"
3. Set the bucket to Public
4. Create another bucket called "images" for album covers
5. Set the images bucket to Public

### 5. Upload Audio Files
1. Go to Storage → audio-files bucket
2. Upload your audio files (.mp3, .wav, .flac)
3. Note the file names/paths for database entries
4. Update the `audio_url` field in tracks table with correct paths

### 6. Configure Bucket Policies
```sql
-- Allow public access to audio files
CREATE POLICY "Public audio access" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');

-- Allow public access to images
CREATE POLICY "Public image access" ON storage.objects
FOR SELECT USING (bucket_id = 'images');
```

### 7. Update Database with Real Audio URLs
```sql
-- Update tracks with actual Supabase Storage URLs
UPDATE tracks SET audio_url = 'audio-files/baby-shark.mp3' WHERE title = 'Baby Shark';
UPDATE tracks SET audio_url = 'audio-files/despacito.mp3' WHERE title = 'Despacito';
-- Continue for all tracks...
```

## 🔧 Testing Your Setup

### 1. Test Database Connection
```typescript
import { supabase } from './src/lib/supabase'

// Test fetching tracks
const testDb = async () => {
  const { data, error } = await supabase.from('tracks').select('*')
  console.log('Tracks:', data)
  console.log('Error:', error)
}
```

### 2. Test Audio Streaming
```typescript
import { getAudioUrl } from './src/lib/supabase'

// Test getting audio URL
const audioUrl = getAudioUrl('audio-files', 'baby-shark.mp3')
console.log('Audio URL:', audioUrl)
```

### 3. Test in Browser
1. Start your dev server: `npm run dev`
2. Open browser console
3. Check for any Supabase connection errors
4. Try playing a track to test audio streaming

## 🎵 Audio File Requirements

### Supported Formats
- MP3 (recommended for web compatibility)
- WAV (high quality, larger file size)
- OGG (good compression, modern browsers)
- FLAC (lossless, very large files)

### File Organization
```
audio-files/
├── baby-shark.mp3
├── despacito.mp3
├── wheels-on-the-bus.mp3
└── ...

images/
├── baby-shark.jpg
├── despacito.jpg
├── wheels-on-the-bus.jpg
└── ...
```

### File Naming Best Practices
- Use lowercase
- Replace spaces with hyphens
- Remove special characters
- Keep names descriptive but concise

## 🛡️ Security Considerations

### Row Level Security (RLS)
- Already enabled in schema
- Public read access for tracks and playlists
- User-specific access for favorites (when auth is added)

### CORS Settings
Supabase handles CORS automatically for your domain.

### API Rate Limits
- Free tier: 50,000 requests per month
- Paid plans have higher limits
- Consider caching frequently accessed data

## 🐛 Troubleshooting

### Common Issues

1. **Audio not playing**
   - Check CORS settings
   - Verify bucket permissions
   - Ensure audio URLs are correct
   - Check browser console for errors

2. **Database connection errors**
   - Verify environment variables
   - Check project URL and API key
   - Ensure network connectivity

3. **Storage access issues**
   - Verify bucket policies
   - Check file paths in database
   - Ensure files are uploaded correctly

### Debug Commands
```typescript
// Test Supabase connection
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY)

// Test storage access
const { data } = supabase.storage.from('audio-files').list()
console.log('Storage files:', data)
```

## 🚀 Next Steps

1. Upload your audio files to Supabase Storage
2. Update the database with correct file paths
3. Test the audio streaming functionality
4. Add authentication for user-specific features
5. Implement playlist management
6. Add search and filtering capabilities

## 📞 Support

- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: Create issues in your project repository