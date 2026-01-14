"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Upload, Play, Settings } from "lucide-react"
import { DeckImportDialog } from "@/components/deck-import-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface DeckActionsProps {
  deckId: string
  deckName: string
}

export function DeckActions({ deckId, deckName }: DeckActionsProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false)
  const [seed, setSeed] = useState("")
  const [devMode, setDevMode] = useState(false)
  const router = useRouter()

  const handleExport = () => {
    // Trigger download by navigating to export endpoint
    window.location.href = `/api/decks/${deckId}/export`
  }

  const handleStartGame = () => {
    // Build URL with query parameters for game options
    const params = new URLSearchParams()
    if (seed) params.set('seed', seed)
    if (devMode) params.set('devMode', 'true')
    
    const url = `/play/${deckId}${params.toString() ? `?${params.toString()}` : ''}`
    console.log('[DECK-ACTIONS] Navigating to:', url)
    
    // Navigate to play page
    router.push(url)
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setGameSettingsOpen(true)}>
          <Play className="mr-2 h-4 w-4" />
          Play
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <DeckImportDialog deckId={deckId} open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <Dialog open={gameSettingsOpen} onOpenChange={setGameSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Game Settings</DialogTitle>
            <DialogDescription>
              Configure testing options before starting the game
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="seed">Seed (Optional)</Label>
              <Input
                id="seed"
                placeholder="Enter seed for reproducible hands"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use the same seed to get the same starting hands for testing
              </p>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="dev-mode">Developer Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Start with 999 of each mana color
                </p>
              </div>
              <Switch
                id="dev-mode"
                checked={devMode}
                onCheckedChange={setDevMode}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setGameSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartGame}>
              <Play className="mr-2 h-4 w-4" />
              Start Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
