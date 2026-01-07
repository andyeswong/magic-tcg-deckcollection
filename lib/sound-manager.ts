/**
 * Sound Manager for Magic TCG App
 * Handles playing sound effects and background music
 */

type SoundEffect = 
  | "attack"
  | "blocked"
  | "cast"
  | "destroyed"
  | "heal"
  | "instant"
  | "draw"
  | "play-land"
  | "tap-land"
  | "counter"
  | "damage"

type MusicTrack = string

class SoundManager {
  private static instance: SoundManager
  private soundEffectsVolume: number = 0.5
  private musicVolume: number = 0.3
  private musicEnabled: boolean = true
  private soundEffectsEnabled: boolean = true
  private currentMusic: HTMLAudioElement | null = null
  private currentMusicTrack: MusicTrack | null = null
  private soundCache: Map<SoundEffect, HTMLAudioElement> = new Map()
  private initialized: boolean = false
  private pendingIntro: boolean = false
  private pendingMusic: boolean = false
  private availableTracks: MusicTrack[] = []
  private tracksLoaded: boolean = false

  private constructor() {
    // Load all sound effects into cache
    this.preloadSounds()
    // Load available music tracks
    this.loadAvailableTracks()
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  /**
   * Load available music tracks from API
   */
  private async loadAvailableTracks() {
    // Only load in browser environment
    if (typeof window === 'undefined') {
      this.availableTracks = []
      this.tracksLoaded = true
      return
    }

    try {
      const response = await fetch('/api/music')
      const data = await response.json()
      this.availableTracks = data.tracks || []
      this.tracksLoaded = true
      console.log(`[SOUND] Loaded ${this.availableTracks.length} music tracks:`, this.availableTracks)
    } catch (error) {
      console.warn('[SOUND] Failed to load music tracks:', error)
      // Fallback to default tracks if API fails
      this.availableTracks = [
        "dnd medieval 1",
        "dnd medieval 2",
        "dnd tech 1",
        "dnd tech 2"
      ]
      this.tracksLoaded = true
    }
  }

  private preloadSounds() {
    // Only preload in browser environment
    if (typeof window === 'undefined') return

    const sounds: SoundEffect[] = [
      "attack",
      "blocked",
      "cast",
      "destroyed",
      "heal",
      "instant"
    ]

    sounds.forEach(sound => {
      const audio = new Audio(`/sounds/${sound}.mp3`)
      audio.volume = this.soundEffectsVolume
      audio.preload = "auto"
      this.soundCache.set(sound, audio)
    })
  }

  /**
   * Play a sound effect
   */
  public playSound(effect: SoundEffect) {
    if (typeof window === 'undefined' || !this.soundEffectsEnabled) return

    try {
      // Use cached sound if available
      let audio = this.soundCache.get(effect)
      
      if (!audio) {
        // Fallback: create new audio element
        audio = new Audio(`/sounds/${this.mapEffectToFile(effect)}`)
        audio.volume = this.soundEffectsVolume
      } else {
        // Clone the audio to allow simultaneous plays
        audio = audio.cloneNode() as HTMLAudioElement
        audio.volume = this.soundEffectsVolume
      }

      audio.play().catch(err => {
        console.warn(`Failed to play sound effect: ${effect}`, err)
      })
    } catch (err) {
      console.warn(`Error playing sound effect: ${effect}`, err)
    }
  }

  /**
   * Play the intro welcome sound
   */
  public playIntro() {
    if (typeof window === 'undefined' || !this.soundEffectsEnabled) return

    // If not initialized yet, mark as pending
    if (!this.initialized) {
      this.pendingIntro = true
      return
    }

    try {
      const audio = new Audio("/sounds/intro welcome.wav")
      audio.volume = this.soundEffectsVolume
      audio.play().catch(err => {
        console.warn("Failed to play intro sound:", err)
      })
    } catch (err) {
      console.warn("Error playing intro sound:", err)
    }
  }

  /**
   * Initialize audio system (call after user interaction)
   */
  public async initialize(): Promise<void> {
    if (typeof window === 'undefined' || this.initialized) return

    try {
      // Try to play a silent audio to "unlock" audio context
      const silence = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA")
      await silence.play()
      silence.pause()
      
      this.initialized = true

      // Play pending intro if requested
      if (this.pendingIntro) {
        this.pendingIntro = false
        this.playIntro()
      }

      // Start pending music if requested
      if (this.pendingMusic) {
        this.pendingMusic = false
        setTimeout(() => this.playMusic(undefined, true), 1500)
      }
    } catch (err) {
      console.warn("Failed to initialize audio:", err)
    }
  }

  /**
   * Check if audio system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Map effect names to actual file names
   */
  private mapEffectToFile(effect: SoundEffect): string {
    const mapping: Record<SoundEffect, string> = {
      "attack": "attack.mp3",
      "blocked": "blocked.mp3",
      "cast": "cast.mp3",
      "destroyed": "destroyed.mp3",
      "heal": "heal.mp3",
      "instant": "instant.mp3",
      "draw": "cast.mp3", // Reuse cast sound
      "play-land": "cast.mp3", // Reuse cast sound (softer)
      "tap-land": "cast.mp3", // Reuse cast sound
      "counter": "instant.mp3", // Reuse instant sound
      "damage": "attack.mp3", // Reuse attack sound
    }
    return mapping[effect] || "cast.mp3"
  }

  /**
   * Start playing background music
   */
  public playMusic(track?: MusicTrack, forceNew: boolean = false) {
    if (typeof window === 'undefined' || !this.musicEnabled) return

    // If not initialized yet, mark as pending
    if (!this.initialized) {
      this.pendingMusic = true
      return
    }

    // If no track specified, pick a random one
    const selectedTrack = track || this.getRandomTrack()

    // Don't restart if already playing the same track (unless forced)
    if (!forceNew && this.currentMusic && this.currentMusicTrack === selectedTrack && !this.currentMusic.paused) {
      return
    }

    // Stop current music
    this.stopMusic()

    try {
      this.currentMusic = new Audio(`/music/${selectedTrack}.mp3`)
      this.currentMusic.volume = this.musicVolume
      this.currentMusic.loop = true
      this.currentMusicTrack = selectedTrack

      this.currentMusic.play().catch(err => {
        console.warn("Failed to play background music:", err)
      })
    } catch (err) {
      console.warn("Error starting background music:", err)
    }
  }

  /**
   * Stop background music
   */
  public stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause()
      this.currentMusic.currentTime = 0
      this.currentMusic = null
    }
  }

  /**
   * Pause background music
   */
  public pauseMusic() {
    if (this.currentMusic && !this.currentMusic.paused) {
      this.currentMusic.pause()
    }
  }

  /**
   * Resume background music
   */
  public resumeMusic() {
    if (this.currentMusic && this.currentMusic.paused) {
      this.currentMusic.play().catch(err => {
        console.warn("Failed to resume music:", err)
      })
    }
  }

  /**
   * Get a random music track
   */
  private getRandomTrack(): MusicTrack {
    if (this.availableTracks.length === 0) {
      // Fallback if no tracks loaded yet
      return "dnd medieval 1"
    }
    return this.availableTracks[Math.floor(Math.random() * this.availableTracks.length)]
  }

  /**
   * Set sound effects volume (0.0 to 1.0)
   */
  public setSoundEffectsVolume(volume: number) {
    this.soundEffectsVolume = Math.max(0, Math.min(1, volume))
    // Update cached sounds
    this.soundCache.forEach(audio => {
      audio.volume = this.soundEffectsVolume
    })
  }

  /**
   * Set music volume (0.0 to 1.0)
   */
  public setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume
    }
  }

  /**
   * Get current sound effects volume
   */
  public getSoundEffectsVolume(): number {
    return this.soundEffectsVolume
  }

  /**
   * Get current music volume
   */
  public getMusicVolume(): number {
    return this.musicVolume
  }

  /**
   * Toggle sound effects on/off
   */
  public toggleSoundEffects(enabled?: boolean) {
    this.soundEffectsEnabled = enabled ?? !this.soundEffectsEnabled
    return this.soundEffectsEnabled
  }

  /**
   * Toggle music on/off
   */
  public toggleMusic(enabled?: boolean) {
    this.musicEnabled = enabled ?? !this.musicEnabled
    
    if (this.musicEnabled) {
      this.playMusic()
    } else {
      this.stopMusic()
    }
    
    return this.musicEnabled
  }

  /**
   * Check if sound effects are enabled
   */
  public isSoundEffectsEnabled(): boolean {
    return this.soundEffectsEnabled
  }

  /**
   * Check if music is enabled
   */
  public isMusicEnabled(): boolean {
    return this.musicEnabled
  }

  /**
   * Get current music track name
   */
  public getCurrentTrack(): MusicTrack | null {
    return this.currentMusicTrack
  }

  /**
   * Get all available music tracks
   */
  public getAvailableTracks(): MusicTrack[] {
    return this.availableTracks
  }

  /**
   * Check if tracks are loaded
   */
  public areTracksLoaded(): boolean {
    return this.tracksLoaded
  }
}

// Export singleton instance
export const soundManager = SoundManager.getInstance()

// Export types
export type { SoundEffect, MusicTrack }
