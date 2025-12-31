"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GameCard } from "@/components/game-card"
import { useGameStore } from "@/lib/game/store"
import { executeBotTurn } from "@/lib/game/bot"
import { Play, SkipForward, Swords } from "lucide-react"

export function GameBoard() {
  const {
    gameState,
    humanPlayerId,
    botPlayerId,
    playLand,
    castSpell,
    addManaFromLand,
    declareAttackers,
    advancePhase,
    endTurn,
  } = useGameStore()

  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [attackers, setAttackers] = useState<string[]>([])

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-muted-foreground">No game in progress</p>
      </div>
    )
  }

  const humanPlayer = gameState.players[humanPlayerId]
  const botPlayer = gameState.players[botPlayerId]
  const isHumanTurn = gameState.turnState.activePlayerId === humanPlayerId
  const phase = gameState.turnState.phase

  // Auto-play bot turn
  useEffect(() => {
    if (!isHumanTurn && gameState.status === "PLAYING") {
      // Delay to make it visible
      const timer = setTimeout(() => {
        executeBotTurn(gameState, botPlayerId)
        // Force re-render
        useGameStore.setState({ gameState: { ...gameState } })
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [isHumanTurn, gameState.turnState.turnNumber, phase])

  const handleCardClick = (cardId: string) => {
    if (!isHumanTurn) return

    const card = gameState.entities[cardId]

    // In DECLARE_ATTACKERS phase, select attackers
    if (phase === "DECLARE_ATTACKERS" && card.controllerId === humanPlayerId) {
      if (attackers.includes(cardId)) {
        setAttackers(attackers.filter((id) => id !== cardId))
      } else {
        setAttackers([...attackers, cardId])
      }
      return
    }

    // Otherwise, select card for action
    setSelectedCard(cardId === selectedCard ? null : cardId)
  }

  const handlePlayLand = () => {
    if (!selectedCard) return
    const success = playLand(humanPlayerId, selectedCard)
    if (success) setSelectedCard(null)
  }

  const handleTapForMana = () => {
    if (!selectedCard) return
    const success = addManaFromLand(humanPlayerId, selectedCard)
    if (success) setSelectedCard(null)
  }

  const handleCastSpell = () => {
    if (!selectedCard) return
    const success = castSpell(humanPlayerId, selectedCard)
    if (success) setSelectedCard(null)
  }

  const handleDeclareAttackers = () => {
    if (attackers.length === 0) return

    const attackersData = attackers.map((attackerId) => ({
      attackerId,
      targetId: botPlayerId,
    }))

    const success = declareAttackers(humanPlayerId, attackersData)
    if (success) {
      setAttackers([])
      advancePhase()
    }
  }

  const selectedCardData = selectedCard ? gameState.entities[selectedCard] : null

  // Get battlefield cards by controller
  const humanBattlefield = gameState.battlefield.filter(
    (id) => gameState.entities[id].controllerId === humanPlayerId,
  )
  const botBattlefield = gameState.battlefield.filter((id) => gameState.entities[id].controllerId === botPlayerId)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Game Status Header */}
        <Card className="bg-black/50 border-primary/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-white">
                  Turn {gameState.turnState.turnNumber} - {phase.replace(/_/g, " ")}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant={isHumanTurn ? "default" : "secondary"}>
                    {isHumanTurn ? "Your Turn" : "Bot's Turn"}
                  </Badge>
                  <Badge variant="outline" className="text-white">
                    {gameState.rulesConfig.startingLife} Life Format
                  </Badge>
                </div>
              </div>

              {isHumanTurn && (
                <div className="flex gap-2">
                  {phase === "DECLARE_ATTACKERS" ? (
                    <Button onClick={handleDeclareAttackers} disabled={attackers.length === 0}>
                      <Swords className="mr-2 h-4 w-4" />
                      Attack ({attackers.length})
                    </Button>
                  ) : null}
                  <Button onClick={advancePhase} variant="outline">
                    <SkipForward className="mr-2 h-4 w-4" />
                    Next Phase
                  </Button>
                  <Button onClick={endTurn} variant="default">
                    End Turn
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Bot Area */}
        <Card className="bg-red-950/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">{botPlayer.name}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge variant="destructive">❤️ {botPlayer.life}</Badge>
                  <Badge variant="secondary">📚 {botPlayer.library.length} cards</Badge>
                  <Badge variant="secondary">🎴 {botPlayer.hand.length} in hand</Badge>
                </div>
              </div>
              <div className="text-white text-sm">
                <div>Mana: {Object.entries(botPlayer.manaPool).map(([color, amount]) => amount > 0 && `${color}:${amount}`).filter(Boolean).join(" ") || "None"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Bot Battlefield */}
              <div>
                <p className="text-sm text-white mb-2">Battlefield ({botBattlefield.length})</p>
                <div className="flex flex-wrap gap-2">
                  {botBattlefield.map((cardId) => (
                    <GameCard key={cardId} card={gameState.entities[cardId]} size="small" />
                  ))}
                  {botBattlefield.length === 0 && (
                    <p className="text-muted-foreground text-sm">No permanents</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Human Player Area */}
        <Card className="bg-blue-950/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">{humanPlayer.name}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge variant="default">❤️ {humanPlayer.life}</Badge>
                  <Badge variant="secondary">📚 {humanPlayer.library.length} cards</Badge>
                  {humanPlayer.flags.landsPlayedThisTurn > 0 && (
                    <Badge variant="outline">⛰️ Land played</Badge>
                  )}
                </div>
              </div>
              <div className="text-white text-sm">
                <div>Mana: {Object.entries(humanPlayer.manaPool).map(([color, amount]) => amount > 0 && `${color}:${amount}`).filter(Boolean).join(" ") || "None"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Battlefield */}
              <div>
                <p className="text-sm text-white mb-2">Battlefield ({humanBattlefield.length})</p>
                <div className="flex flex-wrap gap-2">
                  {humanBattlefield.map((cardId) => (
                    <GameCard
                      key={cardId}
                      card={gameState.entities[cardId]}
                      size="small"
                      onClick={() => handleCardClick(cardId)}
                      selectable={isHumanTurn}
                      selected={selectedCard === cardId || attackers.includes(cardId)}
                    />
                  ))}
                  {humanBattlefield.length === 0 && (
                    <p className="text-muted-foreground text-sm">No permanents</p>
                  )}
                </div>
              </div>

              {/* Hand */}
              <div>
                <p className="text-sm text-white mb-2">Hand ({humanPlayer.hand.length})</p>
                <div className="flex flex-wrap gap-2">
                  {humanPlayer.hand.map((cardId) => (
                    <GameCard
                      key={cardId}
                      card={gameState.entities[cardId]}
                      size="medium"
                      onClick={() => handleCardClick(cardId)}
                      selectable={isHumanTurn}
                      selected={selectedCard === cardId}
                    />
                  ))}
                </div>
              </div>

              {/* Selected Card Actions */}
              {selectedCardData && isHumanTurn && (
                <Card className="bg-black/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-white font-semibold">{selectedCardData.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedCardData.typeLine}</p>
                        <p className="text-sm text-muted-foreground">Mana Cost: {selectedCardData.manaCost || "None"}</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedCardData.zone === "HAND" && selectedCardData.typeLine.toLowerCase().includes("land") && (
                          <Button onClick={handlePlayLand} variant="default" size="sm">
                            <Play className="mr-2 h-4 w-4" />
                            Play Land
                          </Button>
                        )}
                        {selectedCardData.zone === "HAND" && !selectedCardData.typeLine.toLowerCase().includes("land") && (
                          <Button onClick={handleCastSpell} variant="default" size="sm">
                            <Play className="mr-2 h-4 w-4" />
                            Cast Spell
                          </Button>
                        )}
                        {selectedCardData.zone === "BATTLEFIELD" &&
                          selectedCardData.typeLine.toLowerCase().includes("land") &&
                          !selectedCardData.tapped && (
                            <Button onClick={handleTapForMana} variant="default" size="sm">
                              Tap for Mana
                            </Button>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Game Over */}
        {gameState.status === "ENDED" && (
          <Card className="bg-black/80 border-yellow-500">
            <CardContent className="pt-6 text-center">
              <h2 className="text-3xl font-bold text-yellow-500 mb-2">Game Over!</h2>
              <p className="text-white text-xl">
                {gameState.winner === humanPlayerId ? "You Win!" : "Bot Wins!"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
