import { sampleTracks } from '../data';
import SongManagementService from './songManagementService';
import type { Track } from '../types';

/**
 * Unified Music Data Service
 * Combines static sample tracks with dynamically managed songs from Firebase
 */
class MusicDataService {
  private static instance: MusicDataService;
  private songService: SongManagementService;
  private cachedTracks: Track[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private listeners: Array<(tracks: Track[]) => void> = [];

  private constructor() {
    this.songService = SongManagementService.getInstance();
  }

  static getInstance(): MusicDataService {
    if (!MusicDataService.instance) {
      MusicDataService.instance = new MusicDataService();
    }
    return MusicDataService.instance;
  }

  /**
   * Subscribe to track updates
   */
  subscribe(callback: (tracks: Track[]) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Notify all listeners of track updates
   */
  private notifyListeners(tracks: Track[]) {
    this.listeners.forEach(callback => callback(tracks));
  }

  /**
   * Get all tracks (sample + dynamic)
   */
  async getAllTracks(forceRefresh = false): Promise<Track[]> {
    const now = Date.now();
    const cacheExpired = now - this.lastCacheUpdate > this.CACHE_DURATION;
    
    if (!forceRefresh && !cacheExpired && this.cachedTracks.length > 0) {
      return this.cachedTracks;
    }

    try {
      // Get dynamic songs from Firebase
      const dynamicSongs = await this.songService.getAllSongs();
      
      // Combine with sample tracks, avoiding duplicates
      const combined = [...dynamicSongs];
      
      // Add sample tracks that don't exist in dynamic songs
      sampleTracks.forEach(sampleTrack => {
        const exists = dynamicSongs.some(dynamicSong => 
          dynamicSong.title.toLowerCase() === sampleTrack.title.toLowerCase() &&
          dynamicSong.artist.toLowerCase() === sampleTrack.artist.toLowerCase()
        );
        
        if (!exists) {
          combined.push(sampleTrack);
        }
      });

      // Sort by release date (newest first) and then by title
      combined.sort((a, b) => {
        const dateA = new Date(a.releaseDate).getTime();
        const dateB = new Date(b.releaseDate).getTime();
        
        if (dateA !== dateB) {
          return dateB - dateA; // Newest first
        }
        
        return a.title.localeCompare(b.title);
      });

      this.cachedTracks = combined;
      this.lastCacheUpdate = now;
      
      // Notify listeners
      this.notifyListeners(combined);
      
      return combined;
    } catch (error) {
      console.error('Error getting all tracks:', error);
      // Fallback to sample tracks
      return sampleTracks;
    }
  }

  /**
   * Get track by ID
   */
  async getTrackById(id: string): Promise<Track | null> {
    const allTracks = await this.getAllTracks();
    return allTracks.find(track => track.id === id) || null;
  }

  /**
   * Search tracks
   */
  async searchTracks(query: string): Promise<Track[]> {
    const allTracks = await this.getAllTracks();
    const lowercaseQuery = query.toLowerCase();
    
    return allTracks.filter(track =>
      track.title.toLowerCase().includes(lowercaseQuery) ||
      track.artist.toLowerCase().includes(lowercaseQuery) ||
      track.album.toLowerCase().includes(lowercaseQuery) ||
      track.genre.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get tracks by genre
   */
  async getTracksByGenre(genre: string): Promise<Track[]> {
    const allTracks = await this.getAllTracks();
    return allTracks.filter(track => 
      track.genre.toLowerCase() === genre.toLowerCase()
    );
  }

  /**
   * Get tracks by artist
   */
  async getTracksByArtist(artist: string): Promise<Track[]> {
    const allTracks = await this.getAllTracks();
    return allTracks.filter(track => 
      track.artist.toLowerCase().includes(artist.toLowerCase())
    );
  }

  /**
   * Get recent tracks
   */
  async getRecentTracks(limit = 10): Promise<Track[]> {
    const allTracks = await this.getAllTracks();
    return allTracks.slice(0, limit);
  }

  /**
   * Get popular tracks (by play count)
   */
  async getPopularTracks(limit = 10): Promise<Track[]> {
    const allTracks = await this.getAllTracks();
    return allTracks
      .filter(track => (track.plays || 0) > 0)
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, limit);
  }

  /**
   * Get random tracks
   */
  async getRandomTracks(limit = 10): Promise<Track[]> {
    const allTracks = await this.getAllTracks();
    const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  /**
   * Increment play count for a track
   */
  async incrementPlayCount(trackId: string): Promise<void> {
    try {
      // Try to increment in Firebase (for dynamic songs)
      await this.songService.incrementPlayCount(trackId);
      
      // Update cached tracks if they exist
      if (this.cachedTracks.length > 0) {
        this.cachedTracks = this.cachedTracks.map(track => {
          if (track.id === trackId) {
            return { ...track, plays: (track.plays || 0) + 1 };
          }
          return track;
        });
        
        this.notifyListeners(this.cachedTracks);
      }
    } catch (error) {
      console.error('Error incrementing play count:', error);
    }
  }

  /**
   * Refresh cache
   */
  async refreshCache(): Promise<Track[]> {
    return this.getAllTracks(true);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedTracks = [];
    this.lastCacheUpdate = 0;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { 
    cacheSize: number; 
    lastUpdate: Date | null; 
    cacheAge: number;
    isExpired: boolean;
  } {
    const now = Date.now();
    const cacheAge = now - this.lastCacheUpdate;
    
    return {
      cacheSize: this.cachedTracks.length,
      lastUpdate: this.lastCacheUpdate > 0 ? new Date(this.lastCacheUpdate) : null,
      cacheAge,
      isExpired: cacheAge > this.CACHE_DURATION
    };
  }

  /**
   * Get all unique genres
   */
  async getAllGenres(): Promise<string[]> {
    const allTracks = await this.getAllTracks();
    const genres = new Set(allTracks.map(track => track.genre).filter(Boolean));
    return Array.from(genres).sort();
  }

  /**
   * Get all unique artists
   */
  async getAllArtists(): Promise<string[]> {
    const allTracks = await this.getAllTracks();
    const artists = new Set(allTracks.map(track => track.artist).filter(Boolean));
    return Array.from(artists).sort();
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalTracks: number;
    totalArtists: number;
    totalGenres: number;
    totalPlayTime: number;
    totalPlays: number;
  }> {
    const allTracks = await this.getAllTracks();
    const artists = await this.getAllArtists();
    const genres = await this.getAllGenres();
    
    const totalPlayTime = allTracks.reduce((sum, track) => sum + track.duration, 0);
    const totalPlays = allTracks.reduce((sum, track) => sum + (track.plays || 0), 0);
    
    return {
      totalTracks: allTracks.length,
      totalArtists: artists.length,
      totalGenres: genres.length,
      totalPlayTime,
      totalPlays
    };
  }
}

export default MusicDataService;