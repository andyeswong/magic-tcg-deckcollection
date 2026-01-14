"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useGameStore } from "@/lib/game/store"
import { GameBoard } from "@/components/game-board"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Play } from "lucide-react"
import Link from "next/link"
import type { DeckData, DeckCardData } from "@/lib/game/types"

interface GameInitializerProps {
  deckData: DeckData
  deckCards: DeckCardData[]
  userId: string
  userName: string
}

export function GameInitializer({ deckData, deckCards, userId, userName }: GameInitializerProps) {
  const { gameState, initGame } = useGameStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [initialized, setInitialized] = useState(false)

  // Initialize game on mount if not already initialized
  useEffect(() => {
    if (initialized) {
      console.log('[GAME-INITIALIZER] Already initialized, skipping')
      return
    }
    
    if (!gameState || gameState.deckId !== deckData.id) {
      // Read game options from URL parameters
      const seed = searchParams.get('seed') || undefined
      const devMode = searchParams.get('devMode') === 'true'
      
      console.log('[GAME-INITIALIZER] Read from URL params - seed:', seed, 'devMode:', devMode)
      
      // Initialize game with options
      const options = (seed || devMode) ? { seed, devMode } : undefined
      console.log('[GAME-INITIALIZER] Calling initGame with options:', options)
      initGame(deckData, deckCards, userId, userName, options)
      setInitialized(true)
    }
  }, [deckData.id, initialized, searchParams])

  // Show start screen if game not initialized yet
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
        <div className="max-w-3xl mx-auto mt-20">
          <Button variant="ghost" asChild className="mb-6 text-white">
            <Link href={`/decks/${deckData.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Deck
            </Link>
          </Button>

          <Card className="bg-black/50 border-primary/50">
            <CardHeader>
              <CardTitle className="text-3xl text-white text-center">Loading Game...</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Deck: {deckData.name}</h3>
                  <p className="text-muted-foreground">Commander: {deckData.commander_name}</p>
                </div>

                {deckData.commander_image_url && (
                  <div className="flex justify-center">
                    <img
                      src={deckData.commander_image_url}
                      alt={deckData.commander_name}
                      className="w-64 rounded-lg shadow-xl"
                    />
                  </div>
                )}

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <p className="text-white">
                    <strong>Format:</strong> Commander (EDH)
                  </p>
                  <p className="text-white">
                    <strong>Starting Life:</strong> 40
                  </p>
                  <p className="text-white">
                    <strong>Opponent:</strong> Bot (Simple AI)
                  </p>
                  <p className="text-muted-foreground text-xs mt-4">
                    The bot will play with the same deck and make simple strategic decisions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show game board
  return <GameBoard />
}
