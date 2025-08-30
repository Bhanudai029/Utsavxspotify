import { supabase } from './supabase'

export interface AudioTrack {
  id: string
  title: string
  artist: string
  album?: string
  duration: number
  audio_url: string
  image_url?: string
  created_at?: string
  updated_at?: string
}

export class AudioService {
  private static instance: AudioService
  private audioElement: HTMLAudioElement | null = null
  private isUserInteracted: boolean = false
  private isMobile: boolean = false
  
  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService()
    }
    return AudioService.instance
  }

  constructor() {
    // Detect mobile device
    this.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // Add user interaction listener for mobile
    if (this.isMobile) {
      this.setupUserInteractionListener()
    }
  }

  // Setup user interaction listener for mobile compatibility
  private setupUserInteractionListener(): void {
    const handleUserInteraction = () => {
      this.isUserInteracted = true
      // Initialize audio context on first user interaction
      if (!this.audioElement) {
        this.initializeAudio()
      }
      // Try to play a silent sound to unlock audio
      this.unlockAudio()
      
      // Remove listeners after first interaction
      document.removeEventListener('touchstart', handleUserInteraction)
      document.removeEventListener('click', handleUserInteraction)
    }
    
    document.addEventListener('touchstart', handleUserInteraction, { passive: true })
    document.addEventListener('click', handleUserInteraction)
  }

  // Unlock audio for mobile browsers
  private async unlockAudio(): Promise<void> {
    if (!this.audioElement) return
    
    try {
      // Create a short silent audio to unlock the audio context
      const silentAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmcfCh2U3/XRgh4FBCzEU0sNgDwAHZbJ8AHqnPcaRCMOFl+1MJFGM1oiJhQJkQJQaEKVGwLCOJKEAl7AqDZVbIIsKD5lAOJZaUkLZhWGJQhEIYYFhpTWNIDPDK7n27nNHmFsQJMCY2tNgBYOJwvBOZWFhpPWNYnNDKnl27nQG2NrUpABYWxJhRQIKAtPbSVWa0lMIQtBH5eCAhUAAAM=') 
      silentAudio.volume = 0
      await silentAudio.play()
      silentAudio.pause()
    } catch (error) {
      console.log('Audio unlock failed, but this is normal on some browsers')
    }
  }

  // Initialize audio element with mobile compatibility
  initializeAudio(): HTMLAudioElement {
    if (!this.audioElement) {
      this.audioElement = new Audio()
      
      // Mobile-specific settings
      if (this.isMobile) {
        this.audioElement.preload = 'none' // Better for mobile data usage
        this.audioElement.controls = false
        this.audioElement.muted = false
        this.audioElement.autoplay = false
      } else {
        this.audioElement.preload = 'metadata'
      }
      
      this.audioElement.crossOrigin = 'anonymous'
      
      // Add error handling
      this.audioElement.addEventListener('error', (e) => {
        console.error('Audio element error:', e)
        const audioError = this.audioElement?.error
        if (audioError) {
          console.error('Audio error details:', {
            code: audioError.code,
            message: audioError.message
          })
        }
      })
    }
    return this.audioElement
  }

  // Get all tracks from Supabase
  async getTracks(): Promise<AudioTrack[]> {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tracks:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching tracks:', error)
      return []
    }
  }

  // Get single track by ID
  async getTrack(id: string): Promise<AudioTrack | null> {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching track:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching track:', error)
      return null
    }
  }

  // Check if audio format is supported
  canPlayType(audioUrl: string): boolean {
    if (!this.audioElement) {
      this.initializeAudio()
    }
    
    // Extract file extension
    const extension = audioUrl.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'mp3':
        return this.audioElement!.canPlayType('audio/mpeg') !== ''
      case 'mp4':
      case 'm4a':
        return this.audioElement!.canPlayType('audio/mp4') !== ''
      case 'ogg':
        return this.audioElement!.canPlayType('audio/ogg') !== ''
      case 'wav':
        return this.audioElement!.canPlayType('audio/wav') !== ''
      case 'aac':
        return this.audioElement!.canPlayType('audio/aac') !== ''
      default:
        return true // Assume it's supported if we can't determine
    }
  }

  // Stream audio from Supabase storage with better mobile support
  async streamAudio(audioUrl: string): Promise<boolean> {
    try {
      // Check if format is supported
      if (!this.canPlayType(audioUrl)) {
        console.error('Audio format not supported on this device')
        return false
      }
      
      const audio = this.initializeAudio()
      
      return new Promise((resolve, reject) => {
        const onLoad = () => {
          console.log('Audio loaded successfully')
          cleanup()
          resolve(true)
        }
        
        const onError = (error: any) => {
          console.error('Audio loading error:', error)
          console.error('Failed URL:', audioUrl)
          cleanup()
          reject(false)
        }
        
        const onStalled = () => {
          console.warn('Audio loading stalled, but continuing...')
        }
        
        const cleanup = () => {
          audio.removeEventListener('loadeddata', onLoad)
          audio.removeEventListener('canplaythrough', onLoad) 
          audio.removeEventListener('error', onError)
          audio.removeEventListener('stalled', onStalled)
        }
        
        // Set up event listeners
        audio.addEventListener('loadeddata', onLoad, { once: true })
        audio.addEventListener('canplaythrough', onLoad, { once: true })
        audio.addEventListener('error', onError, { once: true })
        audio.addEventListener('stalled', onStalled)
        
        // Set source and load
        audio.src = audioUrl
        audio.load()
        
        // Timeout for mobile networks
        setTimeout(() => {
          cleanup()
          reject(false)
        }, 30000) // 30 second timeout
      })
    } catch (error) {
      console.error('Error streaming audio:', error)
      return false
    }
  }

  // Force user interaction for mobile (call this on play button click)
  forceUserInteraction(): void {
    this.isUserInteracted = true
    if (this.isMobile && !this.audioElement) {
      this.initializeAudio()
    }
    this.unlockAudio()
  }

  // Play audio with mobile compatibility
  async playAudio(): Promise<boolean> {
    try {
      if (!this.audioElement) {
        console.log('No audio element, initializing...')
        this.initializeAudio()
      }
      
      // For mobile devices, check and force user interaction if needed
      if (this.isMobile && !this.isUserInteracted) {
        this.forceUserInteraction()
        console.log('Mobile device detected, forcing user interaction')
      }
      
      // Reset audio element if it's in an error state
      if (this.audioElement!.error) {
        console.log('Resetting audio element due to error')
        const currentSrc = this.audioElement!.src
        this.audioElement!.load()
        this.audioElement!.src = currentSrc
      }
      
      // Ensure audio is not muted (OPPO phones sometimes auto-mute)
      this.audioElement!.muted = false
      
      // Multiple play attempts for stubborn browsers
      let playAttempts = 0
      const maxAttempts = 3
      
      while (playAttempts < maxAttempts) {
        try {
          const playPromise = this.audioElement!.play()
          
          if (playPromise !== undefined) {
            await playPromise
            console.log(`Audio playback started successfully on attempt ${playAttempts + 1}`)
            return true
          }
          
          console.log(`Play attempt ${playAttempts + 1} completed`)
          return true
          
        } catch (attemptError: any) {
          playAttempts++
          console.warn(`Play attempt ${playAttempts} failed:`, attemptError.message)
          
          if (playAttempts < maxAttempts) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
      }
      
      throw new Error(`Failed to play audio after ${maxAttempts} attempts`)
      
    } catch (error: any) {
      console.error('Error playing audio:', error)
      
      // Handle specific mobile browser errors
      if (error.name === 'NotAllowedError') {
        console.error('❌ OPPO/Mobile Browser blocked autoplay. User needs to interact first.')
        alert('Please tap the play button to start audio on your device!')
      } else if (error.name === 'NotSupportedError') {
        console.error('❌ Audio format not supported on this OPPO device')
        alert('Audio format not supported on your device. Please try a different song.')
      } else if (error.name === 'AbortError') {
        console.error('❌ Audio playback was aborted on OPPO device')
      }
      
      return false
    }
  }

  // Pause audio
  pauseAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause()
    }
  }

  // Set volume (0-1)
  setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume))
    }
  }

  // Set current time
  setCurrentTime(time: number): void {
    if (this.audioElement) {
      this.audioElement.currentTime = time
    }
  }

  // Get current time
  getCurrentTime(): number {
    return this.audioElement?.currentTime || 0
  }

  // Get duration
  getDuration(): number {
    return this.audioElement?.duration || 0
  }

  // Get audio element for event listeners
  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement
  }

  // Clean up
  destroy(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
      this.audioElement = null
    }
  }
}