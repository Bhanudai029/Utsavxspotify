# Music Streaming App

A modern music streaming application built with React, TypeScript, and Firebase, featuring social functionality, profile management, and admin controls.

## Features

### 🎵 Core Music Features
- Music playback with audio controls
- Song library management
- Liked songs functionality
- Social features (following, followers)
- User profiles with custom avatars

### 🔐 Authentication & Security
- Secure passkey-based authentication
- Protected admin areas with rate limiting
- Session management with automatic expiry
- Account lockout after failed attempts

### 📱 User Experience
- Responsive design for mobile and desktop
- Image optimization and compression
- Progressive loading and caching
- Real-time updates

## Tech Stack

- **Frontend**: React 19.1.1, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion
- **Backend**: Firebase (Auth, Firestore, Storage), Supabase (Audio storage)
- **Icons**: Lucide React

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create `.env` file with:
   ```
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Access the app**:
   - Main app: `http://localhost:5173`
   - Admin panel: `http://localhost:5173/system/content/management/secure/v3`
   - Admin password: `29102910`

## Recent Fixes & Improvements

### 🔥 Firebase Upload Fix (December 2024)
- **Fixed image upload stuck at 20%**: Updated Firebase App ID and simplified upload approach
- **Direct Upload Method**: FirebaseUploadTest now uses direct Firebase SDK calls for reliability
- **Enhanced Error Handling**: Better error messages and progress tracking
- **Test Location**: `http://localhost:5173/system/content/management/secure/v3` → "Show Firebase Test"

### 🖼️ Image Upload Compression Fix
**Problem**: Large image uploads were failing with network timeout errors.

**Solution**: Implemented automatic image compression:
- Images > 5MB are automatically compressed before upload
- Progressive quality reduction (85% → 30% if needed)
- Smart dimension scaling to stay under 4.5MB
- Better progress indicators and error messages

### 👤 Profile Preloading Optimization
**Problem**: Slow profile image loading affecting user experience.

**Solution**: Enhanced image preloading system:
- Mobile-optimized compression (smaller sizes, lower quality)
- Retry mechanisms with exponential backoff
- Aggressive compression for mobile devices
- Better error handling and fallbacks

## Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (UserContext)
├── hooks/              # Custom hooks
├── lib/                # Services and utilities
│   ├── firebase.ts     # Firebase configuration
│   ├── supabase.ts     # Supabase configuration
│   ├── imageUtils.ts   # Image processing utilities
│   └── *Service.ts     # Various service layers
├── pages/              # Page components
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Configuration Files

- `FIREBASE_CONFIGURATION_GUIDE.md` - Firebase setup and storage rules
- `FIREBASE_UPLOAD_FIX.md` - Upload troubleshooting guide
- `SUPABASE_SETUP.md` - Supabase configuration instructions
- `supabase-schema.sql` - Database schema

## Key Services

### Firebase Services
- **Authentication**: User management and security
- **Firestore**: User profiles, relationships, song metadata
- **Storage**: Profile images and song cover art

### Supabase Services
- **Storage**: Audio file storage and streaming
- **Performance**: Optimized for large media files

## Admin Features

### Song Management (`/system/content/management/secure/v3`)
- Add new songs with metadata
- Upload and crop cover images
- Automatic image compression
- Progress tracking for uploads
- Comprehensive error handling

### Security Features
- Rate limiting (5 failed attempts = 15min lockout)
- Session timeout (2 hours)
- Input sanitization
- Secure password validation

## Development

### Build for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run type-check
```

## Troubleshooting

### Upload Issues
1. **Images fail to upload**: Files are automatically compressed, but check your internet connection
2. **Firebase errors**: Verify Firebase configuration and storage rules
3. **Admin access denied**: Check password and account lockout status

### Performance Issues
1. **Slow loading**: Images are automatically optimized for your device
2. **Mobile issues**: App includes mobile-specific optimizations
3. **Audio playback**: Audio files are streamed from Supabase for better performance

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Include error handling and loading states
4. Test on both mobile and desktop
5. Update documentation for significant changes

## License

Private project - All rights reserved
```
