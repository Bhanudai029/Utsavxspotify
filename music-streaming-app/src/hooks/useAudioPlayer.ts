import { useState, useEffect, useCallback, useRef } from 'react'
import { AudioService } from '../lib/audioService'
import type { AudioTrack } from '../lib/audioService'

export interface UseAudioPlayer {
  currentTrack: AudioTrack | null
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  volume: number
  tracks: AudioTrack[]
  playTrack: (track: AudioTrack) => Promise<void>
  togglePlayPause: () => void
  nextTrack: () => void
  previousTrack: () => void
  setVolume: (volume: number) => void
  seek: (time: number) => void
  loadTracks: () => Promise<void>
}

export const useAudioPlayer = (): UseAudioPlayer => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  
  const audioService = useRef(AudioService.getInstance())
  const updateInterval = useRef<NodeJS.Timeout | null>(null)

  // Load tracks from Supabase
  const loadTracks = useCallback(async () => {
    try {
      setIsLoading(true)
      const fetchedTracks = await audioService.current.getTracks()
      setTracks(fetchedTracks)
    } catch (error) {
      console.error('Error loading tracks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Play a specific track
  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      setIsLoading(true)
      setCurrentTrack(track)
      
      // CRITICAL: Force user interaction for OPPO phone compatibility
      await audioService.current.forceUserInteraction()
      
      // Stream and load the audio
      const success = await audioService.current.streamAudio(track.audio_url)
      
      if (success) {
        await audioService.current.playAudio()
        setIsPlaying(true)
        console.log('Track playing with mobile compatibility:', track.title)
      } else {
        console.error('Failed to load audio track')
      }
    } catch (error) {
      console.error('Error playing track:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!currentTrack) return

    if (isPlaying) {
      audioService.current.pauseAudio()
      setIsPlaying(false)
    } else {
      try {
        // CRITICAL: Force user interaction for OPPO phone compatibility
        await audioService.current.forceUserInteraction()
        
        await audioService.current.playAudio()
        setIsPlaying(true)
        console.log('Audio resumed with mobile compatibility')
      } catch (error) {
        console.error('Error resuming audio with mobile compatibility:', error)
        setIsPlaying(false)
      }
    }
  }, [isPlaying, currentTrack])

  // Play next track
  const nextTrack = useCallback(() => {
    if (!currentTrack || tracks.length === 0) return
    
    const currentIndex = tracks.findIndex(track => track.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % tracks.length
    playTrack(tracks[nextIndex])
  }, [currentTrack, tracks, playTrack])

  // Play previous track
  const previousTrack = useCallback(() => {
    if (!currentTrack || tracks.length === 0) return
    
    const currentIndex = tracks.findIndex(track => track.id === currentTrack.id)
    const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1
    playTrack(tracks[prevIndex])
  }, [currentTrack, tracks, playTrack])

  // Set volume
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    setVolumeState(clampedVolume)
    audioService.current.setVolume(clampedVolume)
  }, [])

  // Seek to specific time
  const seek = useCallback((time: number) => {
    audioService.current.setCurrentTime(time)
    setCurrentTime(time)
  }, [])

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioService.current.getAudioElement()
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audioService.current.getDuration())
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audioService.current.getCurrentTime())
    }

    const handleEnded = () => {
      setIsPlaying(false)
      nextTrack()
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [nextTrack])

  // Initialize volume
  useEffect(() => {
    audioService.current.setVolume(volume)
  }, [volume])

  // Load tracks on mount
  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current)
      }
      audioService.current.destroy()
    }
  }, [])

  return {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    tracks,
    playTrack,
    togglePlayPause,
    nextTrack,
    previousTrack,
    setVolume,
    seek,
    loadTracks
  }
}