export interface Artist {
  id: string;
  name: string;
  image: string;
  followers?: number;
  genre?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number;
  image: string;
  genre: string;
  releaseDate: string;
  isLiked?: boolean;
  plays?: number;
  audioUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  image: string;
  releaseDate: string;
  tracks: Track[];
  genre: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  image: string;
  tracks: Track[];
  createdBy: string;
  isPublic: boolean;
  followers?: number;
  lastUpdated: string;
  audioUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image: string;
  followers: number;
  following: number;
  totalPlaytime: number;
  likedSongs: Track[];
  playlists: Playlist[];
  topArtists: Artist[];
  recentlyPlayed: Track[];
  bio?: string;
  isFollowing?: boolean; // For UI state
}

// Friend-related interfaces
export interface FriendProfile {
  id: string;
  name: string;
  displayName: string;
  image?: string;
  followers: number;
  following: number;
  bio?: string;
  isFollowing: boolean;
  profileImage?: string;
}

export interface UserStats {
  followersCount: number;
  followingCount: number;
}

export interface SearchResult {
  users: FriendProfile[];
  hasMore: boolean;
}

export type TabName = 'Home' | 'Friends' | 'Music' | 'Profile';

export interface NavItem {
  name: TabName;
  icon: React.ComponentType<any>;
  path: string;
}