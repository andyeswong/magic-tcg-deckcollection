"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Volume2, VolumeX, Music, Music2 } from "lucide-react"
import { soundManager } from "@/lib/sound-manager"
import type { MusicTrack } from "@/lib/sound-manager"
import { cn } from "@/lib/utils"

interface AudioControlsProps {
  className?: string
  compact?: boolean
}

export function AudioControls({ className, compact = false }: AudioControlsProps) {
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(soundManager.getSoundEffectsVolume())
  const [musicVolume, setMusicVolume] = useState(soundManager.getMusicVolume())
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(soundManager.isSoundEffectsEnabled())
  const [musicEnabled, setMusicEnabled] = useState(soundManager.isMusicEnabled())
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(soundManager.getCurrentTrack())

  // Update sound effects volume
  const handleSoundEffectsVolumeChange = (value: number[]) => {
    const volume = value[0]
    setSoundEffectsVolume(volume)
    soundManager.setSoundEffectsVolume(volume)
  }

  // Update music volume
  const handleMusicVolumeChange = (value: number[]) => {
    const volume = value[0]
    setMusicVolume(volume)
    soundManager.setMusicVolume(volume)
  }

  // Toggle sound effects
  const toggleSoundEffects = () => {
    const enabled = soundManager.toggleSoundEffects()
    setSoundEffectsEnabled(enabled)
  }

  // Toggle music
  const toggleMusic = () => {
    const enabled = soundManager.toggleMusic()
    setMusicEnabled(enabled)
    if (enabled && !currentTrack) {
      setCurrentTrack(soundManager.getCurrentTrack())
    }
  }

  // Change music track
  const handleTrackChange = (track: MusicTrack) => {
    soundManager.playMusic(track)
    setCurrentTrack(track)
  }

  // Test sound effect
  const testSoundEffect = () => {
    soundManager.playSound("cast")
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSoundEffects}
          title={soundEffectsEnabled ? "Mute sound effects" : "Unmute sound effects"}
        >
          {soundEffectsEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMusic}
          title={musicEnabled ? "Stop music" : "Play music"}
        >
          {musicEnabled ? (
            <Music className="h-4 w-4" />
          ) : (
            <Music2 className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="text-lg">Audio Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sound Effects */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound Effects
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSoundEffects}
            >
              {soundEffectsEnabled ? "Mute" : "Unmute"}
            </Button>
          </div>
          <div className="space-y-2">
            <Slider
              value={[soundEffectsVolume]}
              onValueChange={handleSoundEffectsVolumeChange}
              max={1}
              step={0.05}
              disabled={!soundEffectsEnabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{Math.round(soundEffectsVolume * 100)}%</span>
              <span>100%</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={testSoundEffect}
            disabled={!soundEffectsEnabled}
            className="w-full"
          >
            Test Sound Effect
          </Button>
        </div>

        {/* Music */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Music className="h-4 w-4" />
              Background Music
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMusic}
            >
              {musicEnabled ? "Stop" : "Play"}
            </Button>
          </div>
          <div className="space-y-2">
            <Slider
              value={[musicVolume]}
              onValueChange={handleMusicVolumeChange}
              max={1}
              step={0.05}
              disabled={!musicEnabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{Math.round(musicVolume * 100)}%</span>
              <span>100%</span>
            </div>
          </div>
          
          {/* Track Selection */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Music Track</label>
            <Select
              value={currentTrack || undefined}
              onValueChange={(value) => handleTrackChange(value as MusicTrack)}
              disabled={!musicEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a track" />
              </SelectTrigger>
              <SelectContent>
                {soundManager.getAvailableTracks().map((track) => (
                  <SelectItem key={track} value={track}>
                    {track.charAt(0).toUpperCase() + track.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
