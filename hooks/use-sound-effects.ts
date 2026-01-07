/**
 * Hook for managing sound effects in the game
 * Provides easy access to sound manager and game-specific sound effects
 */

import { useEffect, useCallback } from "react"
import { soundManager } from "@/lib/sound-manager"
import type { SoundEffect } from "@/lib/sound-manager"

export function useSoundEffects() {
  // Initialize music when hook is first used (typically in GameBoard)
  useEffect(() => {
    // Queue intro and music to play after user interaction
    soundManager.playIntro()
    soundManager.playMusic(undefined, true) // Force new random track

    // Set up click listener to initialize audio on first interaction
    const initializeAudio = async () => {
      if (!soundManager.isInitialized()) {
        await soundManager.initialize()
        // Remove listener after first interaction
        document.removeEventListener('click', initializeAudio)
        document.removeEventListener('keydown', initializeAudio)
      }
    }

    document.addEventListener('click', initializeAudio)
    document.addEventListener('keydown', initializeAudio)

    // Cleanup: pause music and remove listeners when component unmounts
    return () => {
      soundManager.pauseMusic()
      document.removeEventListener('click', initializeAudio)
      document.removeEventListener('keydown', initializeAudio)
    }
  }, [])

  // Wrapper functions for common game sounds
  const playCastSound = useCallback(() => {
    soundManager.playSound("cast")
  }, [])

  const playInstantSound = useCallback(() => {
    soundManager.playSound("instant")
  }, [])

  const playAttackSound = useCallback(() => {
    soundManager.playSound("attack")
  }, [])

  const playBlockedSound = useCallback(() => {
    soundManager.playSound("blocked")
  }, [])

  const playDestroyedSound = useCallback(() => {
    soundManager.playSound("destroyed")
  }, [])

  const playHealSound = useCallback(() => {
    soundManager.playSound("heal")
  }, [])

  const playDrawSound = useCallback(() => {
    soundManager.playSound("draw")
  }, [])

  const playLandSound = useCallback(() => {
    soundManager.playSound("play-land")
  }, [])

  const playTapLandSound = useCallback(() => {
    soundManager.playSound("tap-land")
  }, [])

  const playDamageSound = useCallback(() => {
    soundManager.playSound("damage")
  }, [])

  // Generic play sound function
  const playSound = useCallback((effect: SoundEffect) => {
    soundManager.playSound(effect)
  }, [])

  return {
    // Individual sound functions
    playCastSound,
    playInstantSound,
    playAttackSound,
    playBlockedSound,
    playDestroyedSound,
    playHealSound,
    playDrawSound,
    playLandSound,
    playTapLandSound,
    playDamageSound,
    
    // Generic play function
    playSound,
    
    // Direct access to sound manager for advanced controls
    soundManager,
  }
}
