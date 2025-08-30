/**
 * Avatar utility functions for generating consistent user avatars
 * with initials and colored backgrounds
 */

export interface AvatarConfig {
  size?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
}

/**
 * Generate avatar with user initials and colored background
 * @param displayName - User's display name
 * @param userId - User's unique ID for consistent color generation
 * @param config - Optional configuration for avatar appearance
 * @returns Data URL of the generated SVG avatar
 */
export const generateUserAvatar = (
  displayName: string, 
  userId: string, 
  config: AvatarConfig = {}
): string => {
  const {
    size = 128,
    fontSize = size / 3,
    fontFamily = 'Arial, sans-serif',
    fontWeight = 'bold'
  } = config;

  // Extract initials from display name
  const initials = displayName
    .split(' ')
    .map(name => name.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2); // Max 2 initials

  // Generate consistent color based on user ID
  const colors = [
    '#1DB954', // Spotify Green
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Mint
    '#FECA57', // Yellow
    '#FF9FF3', // Pink
    '#54A0FF', // Light Blue
    '#5F27CD', // Purple
    '#00D2D3', // Cyan
    '#FF9F43', // Orange
    '#10AC84', // Green
  ];

  // Simple hash function to get consistent color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const backgroundColor = colors[colorIndex];

  // Create SVG avatar
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${backgroundColor}"/>
      <text x="${size/2}" y="${size/2}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>
  `;

  // Convert SVG to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Get profile image URL - returns custom image or generates avatar with initials
 * @param user - User object with profileImage, displayName, and id
 * @param fallbackImage - Optional fallback image URL (defaults to generated avatar)
 * @returns Profile image URL
 */
export const getProfileImageUrl = (
  user: { profileImage?: string; displayName: string; id: string }, 
  fallbackImage?: string
): string => {
  if (user.profileImage) {
    return user.profileImage;
  }
  
  if (fallbackImage) {
    return fallbackImage;
  }
  
  // Generate avatar with user initials and colored background
  return generateUserAvatar(user.displayName, user.id);
};

/**
 * Check if user has a custom profile image (not generated avatar or placeholder)
 * @param profileImage - User's profile image URL
 * @returns Boolean indicating if user has custom image
 */
export const hasCustomProfileImage = (profileImage?: string): boolean => {
  return !!(profileImage && 
           !profileImage.startsWith('data:image/svg+xml') && 
           profileImage !== '/PPplaceholder.png');
};

/**
 * Get color for a user based on their ID (same logic as avatar generation)
 * @param userId - User's unique ID
 * @returns Hex color string
 */
export const getUserColor = (userId: string): string => {
  const colors = [
    '#1DB954', // Spotify Green
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Mint
    '#FECA57', // Yellow
    '#FF9FF3', // Pink
    '#54A0FF', // Light Blue
    '#5F27CD', // Purple
    '#00D2D3', // Cyan
    '#FF9F43', // Orange
    '#10AC84', // Green
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};