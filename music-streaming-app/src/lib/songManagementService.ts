import { supabase, uploadAudio, getAudioUrl } from './supabase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, writeBatch, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import FirebaseImageService from './firebaseImageService';
import type { Track } from '../types';

export interface SongUpload {
  title: string;
  artist: string;
  album: string;
  genre: string;
  releaseDate: string;
  audioFile: File;
  imageFile?: File;
  duration: number;
}

export interface SongMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  releaseDate: string;
  duration: number;
  imageUrl: string;
  audioUrl: string;
  plays: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

class SongManagementService {
  private static instance: SongManagementService;
  private readonly MUSIC_BUCKET = 'UtsavXmusic';
  private readonly SONGS_COLLECTION = 'songs';
  private firebaseImageService: FirebaseImageService;

  private constructor() {
    this.firebaseImageService = FirebaseImageService.getInstance();
  }

  static getInstance(): SongManagementService {
    if (!SongManagementService.instance) {
      SongManagementService.instance = new SongManagementService();
    }
    return SongManagementService.instance;
  }

  /**
   * Upload an image to Firebase Storage
   */
  private async uploadImage(file: File, fileName: string): Promise<string | null> {
    try {
      const imageUrl = await this.firebaseImageService.uploadImageSimple(
        file, 
        fileName, 
        'song-images'
      );
      return imageUrl;
    } catch (error) {
      console.error('Error uploading image to Firebase:', error);
      return null;
    }
  }

  /**
   * Upload an audio file to Supabase storage
   */
  private async uploadAudioFile(file: File, fileName: string): Promise<string | null> {
    try {
      const sanitizedFileName = this.sanitizeFileName(fileName);
      const fileExtension = file.name.split('.').pop() || 'mp3';
      const fullFileName = `${sanitizedFileName}.${fileExtension}`;
      
      const { data, error } = await supabase.storage
        .from(this.MUSIC_BUCKET)
        .upload(fullFileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (error) {
        console.error('Error uploading audio:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from(this.MUSIC_BUCKET)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadAudioFile:', error);
      return null;
    }
  }

  /**
   * Sanitize file name for safe storage
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase()
      .slice(0, 100); // Limit length
  }

  /**
   * Generate unique song ID
   */
  private generateSongId(): string {
    return `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a new song to the system
   */
  async addSong(songData: SongUpload, onProgress?: (progress: number) => void): Promise<{ success: boolean; songId?: string; error?: string }> {
    try {
      onProgress?.(10);
      
      // Generate unique ID and sanitized filename
      const songId = this.generateSongId();
      const sanitizedTitle = this.sanitizeFileName(songData.title);
      
      onProgress?.(20);

      // Upload audio file
      const audioUrl = await this.uploadAudioFile(songData.audioFile, sanitizedTitle);
      if (!audioUrl) {
        return { success: false, error: 'Failed to upload audio file' };
      }

      onProgress?.(60);

      // Upload image file (if provided)
      let imageUrl = '/default-song.png'; // Default image
      if (songData.imageFile) {
        const uploadedImageUrl = await this.uploadImage(songData.imageFile, sanitizedTitle);
        if (uploadedImageUrl) {
          imageUrl = uploadedImageUrl;
        }
      }

      onProgress?.(80);

      // Save metadata to Firebase
      const songMetadata: Omit<SongMetadata, 'id'> = {
        title: songData.title,
        artist: songData.artist,
        album: songData.album,
        genre: songData.genre,
        releaseDate: songData.releaseDate,
        duration: songData.duration,
        imageUrl,
        audioUrl,
        plays: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, this.SONGS_COLLECTION), {
        ...songMetadata,
        customId: songId
      });

      onProgress?.(100);

      return { success: true, songId: docRef.id };
    } catch (error) {
      console.error('Error adding song:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Get all songs from Firebase
   */
  async getAllSongs(): Promise<Track[]> {
    try {
      const songsQuery = query(
        collection(db, this.SONGS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(songsQuery);
      const songs: Track[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        songs.push({
          id: doc.id,
          title: data.title,
          artist: data.artist,
          artistId: `artist_${data.artist.toLowerCase().replace(/\s+/g, '_')}`,
          album: data.album,
          albumId: `album_${data.album.toLowerCase().replace(/\s+/g, '_')}`,
          duration: data.duration,
          image: data.imageUrl,
          genre: data.genre,
          releaseDate: data.releaseDate,
          isLiked: data.isLiked || false,
          plays: data.plays || 0,
          audioUrl: data.audioUrl
        });
      });

      return songs;
    } catch (error) {
      console.error('Error getting songs:', error);
      return [];
    }
  }

  /**
   * Update an existing song
   */
  async updateSong(
    songId: string, 
    updates: Partial<SongUpload>, 
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      onProgress?.(10);
      
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      // Update basic metadata
      if (updates.title) updateData.title = updates.title;
      if (updates.artist) updateData.artist = updates.artist;
      if (updates.album) updateData.album = updates.album;
      if (updates.genre) updateData.genre = updates.genre;
      if (updates.releaseDate) updateData.releaseDate = updates.releaseDate;
      if (updates.duration) updateData.duration = updates.duration;

      onProgress?.(30);

      // Upload new audio file if provided
      if (updates.audioFile) {
        const sanitizedTitle = this.sanitizeFileName(updates.title || 'updated_song');
        const audioUrl = await this.uploadAudioFile(updates.audioFile, sanitizedTitle);
        if (audioUrl) {
          updateData.audioUrl = audioUrl;
        }
      }

      onProgress?.(70);

      // Upload new image if provided
      if (updates.imageFile) {
        const sanitizedTitle = this.sanitizeFileName(updates.title || 'updated_song');
        const imageUrl = await this.uploadImage(updates.imageFile, sanitizedTitle);
        if (imageUrl) {
          updateData.imageUrl = imageUrl;
        }
      }

      onProgress?.(90);

      // Update in Firebase
      await updateDoc(doc(db, this.SONGS_COLLECTION, songId), updateData);

      onProgress?.(100);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating song:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Delete a song from the system
   */
  async deleteSong(songId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from Firebase
      await deleteDoc(doc(db, this.SONGS_COLLECTION, songId));
      
      // Note: We don't delete files from Supabase storage to avoid broken links
      // In a production system, you might want to implement a cleanup job
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting song:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Delete multiple songs at once
   */
  async deleteSongs(songIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const batch = writeBatch(db);
      
      songIds.forEach((songId) => {
        const songRef = doc(db, this.SONGS_COLLECTION, songId);
        batch.delete(songRef);
      });
      
      await batch.commit();
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting songs:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Update song play count
   */
  async incrementPlayCount(songId: string): Promise<void> {
    try {
      const songRef = doc(db, this.SONGS_COLLECTION, songId);
      
      // Get current play count and increment
      const songDoc = await getDoc(songRef);
      if (songDoc.exists()) {
        const currentPlays = songDoc.data().plays || 0;
        await updateDoc(songRef, {
          plays: currentPlays + 1,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error incrementing play count:', error);
    }
  }

  /**
   * Search songs by title, artist, or album
   */
  async searchSongs(searchTerm: string): Promise<Track[]> {
    try {
      const allSongs = await this.getAllSongs();
      const lowercaseSearch = searchTerm.toLowerCase();
      
      return allSongs.filter(song =>
        song.title.toLowerCase().includes(lowercaseSearch) ||
        song.artist.toLowerCase().includes(lowercaseSearch) ||
        song.album.toLowerCase().includes(lowercaseSearch)
      );
    } catch (error) {
      console.error('Error searching songs:', error);
      return [];
    }
  }

  /**
   * Get songs by genre
   */
  async getSongsByGenre(genre: string): Promise<Track[]> {
    try {
      const allSongs = await this.getAllSongs();
      return allSongs.filter(song => song.genre.toLowerCase() === genre.toLowerCase());
    } catch (error) {
      console.error('Error getting songs by genre:', error);
      return [];
    }
  }

  /**
   * Get recently added songs
   */
  async getRecentSongs(limit: number = 10): Promise<Track[]> {
    try {
      const allSongs = await this.getAllSongs();
      return allSongs.slice(0, limit); // Already ordered by createdAt desc
    } catch (error) {
      console.error('Error getting recent songs:', error);
      return [];
    }
  }

  /**
   * Get songs with most plays
   */
  async getPopularSongs(limit: number = 10): Promise<Track[]> {
    try {
      const allSongs = await this.getAllSongs();
      return allSongs
        .sort((a, b) => (b.plays || 0) - (a.plays || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting popular songs:', error);
      return [];
    }
  }

  /**
   * Validate audio file
   */
  validateAudioFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac'];
    
    if (file.size > maxSize) {
      return { valid: false, error: 'Audio file must be less than 50MB' };
    }
    
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Audio file must be MP3, WAV, OGG, or AAC format' };
    }
    
    return { valid: true };
  }

  /**
   * Validate image file
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    return this.firebaseImageService.validateImageFile(file);
  }

  /**
   * Get audio duration from file
   */
  async getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      let resolved = false;
      
      // Timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          console.warn('Audio duration detection timed out, using fallback estimation');
          // Fallback: estimate duration based on file size (very rough)
          const estimatedDuration = this.estimateDurationFromFileSize(file);
          resolve(estimatedDuration);
        }
      }, 10000); // 10 second timeout
      
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
        }
      };
      
      audio.addEventListener('loadedmetadata', () => {
        if (!resolved && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          cleanup();
          resolve(Math.round(audio.duration));
        } else if (!resolved) {
          // If duration is still not available, wait a bit more
          setTimeout(() => {
            if (!resolved && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
              cleanup();
              resolve(Math.round(audio.duration));
            } else if (!resolved) {
              cleanup();
              console.warn('Could not determine audio duration, using fallback estimation');
              const estimatedDuration = this.estimateDurationFromFileSize(file);
              resolve(estimatedDuration);
            }
          }, 1000);
        }
      });
      
      audio.addEventListener('error', (e) => {
        if (!resolved) {
          cleanup();
          console.error('Error loading audio for duration detection:', e);
          const estimatedDuration = this.estimateDurationFromFileSize(file);
          resolve(estimatedDuration);
        }
      });
      
      audio.addEventListener('canplaythrough', () => {
        if (!resolved && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          cleanup();
          resolve(Math.round(audio.duration));
        }
      });
      
      // Set audio properties for better metadata loading
      audio.preload = 'metadata';
      audio.src = url;
    });
  }

  /**
   * Estimate audio duration from file size (fallback method)
   * This is a rough estimation and should only be used when metadata extraction fails
   */
  private estimateDurationFromFileSize(file: File): number {
    const fileSizeInMB = file.size / (1024 * 1024);
    
    // Rough estimates based on common bitrates
    // MP3 128kbps ≈ 1MB per minute
    // MP3 320kbps ≈ 2.5MB per minute
    let estimatedMinutes: number;
    
    if (file.type.includes('mp3')) {
      // Assume average bitrate of 192kbps ≈ 1.5MB per minute
      estimatedMinutes = fileSizeInMB / 1.5;
    } else if (file.type.includes('wav')) {
      // WAV files are much larger, ~10MB per minute
      estimatedMinutes = fileSizeInMB / 10;
    } else {
      // Default assumption for other formats
      estimatedMinutes = fileSizeInMB / 2;
    }
    
    const estimatedSeconds = Math.round(estimatedMinutes * 60);
    
    // Return a reasonable fallback (between 30 seconds and 10 minutes)
    return Math.max(30, Math.min(600, estimatedSeconds));
  }
}

export default SongManagementService;