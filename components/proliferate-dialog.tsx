"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { GameCard } from "@/components/game-card"
import type { PendingTrigger, CardInstance, GameState } from "@/lib/game/types"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"

interface ProliferateDialogProps {
  trigger: PendingTrigger | null
  sourceCard: CardInstance | null
  gameState: GameState | null
  onConfirm: (triggerId: string, selectedTargets: string[]) => void
  onClose: () => void
}

export function ProliferateDialog({
  trigger,
  sourceCard,
  gameState,
  onConfirm,
  onClose,
}: ProliferateDialogProps) {
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set())

  if (!trigger || !sourceCard || !gameState) return null

  // Get all permanents and players with counters
  const targetsWithCounters: Array<{ id: string; type: "card" | "player"; item: CardInstance | any }> = []

  // Cards on battlefield with counters
  for (const cardId of gameState.battlefield) {
    const card = gameState.entities[cardId]
    const hasCounters =
      card.counters.p1p1 > 0 ||
      card.counters.loyalty > 0 ||
      card.counters.charge > 0 ||
      card.counters.poison > 0

    if (hasCounters) {
      targetsWithCounters.push({ id: cardId, type: "card", item: card })
    }
  }

  // Players with counters
  Object.values(gameState.players).forEach((player) => {
    const hasCounters = player.poisonCounters > 0 || player.energyCounters > 0
    if (hasCounters) {
      targetsWithCounters.push({ id: player.id, type: "player", item: player })
    }
  })

  const toggleTarget = (targetId: string) => {
    const newSelected = new Set(selectedTargets)
    if (newSelected.has(targetId)) {
      newSelected.delete(targetId)
    } else {
      newSelected.add(targetId)
    }
    setSelectedTargets(newSelected)
  }

  const handleConfirm = () => {
    onConfirm(trigger.id, Array.from(selectedTargets))
    setSelectedTargets(new Set())
  }

  const getCounterSummary = (target: typeof targetsWithCounters[0]) => {
    if (target.type === "card") {
      const card = target.item as CardInstance
      const counters: string[] = []
      if (card.counters.p1p1 > 0) counters.push(`${card.counters.p1p1} +1/+1`)
      if (card.counters.loyalty > 0) counters.push(`${card.counters.loyalty} loyalty`)
      if (card.counters.charge > 0) counters.push(`${card.counters.charge} charge`)
      if (card.counters.poison > 0) counters.push(`${card.counters.poison} poison`)
      return counters.join(", ")
    } else {
      const player = target.item
      const counters: string[] = []
      if (player.poisonCounters > 0) counters.push(`${player.poisonCounters} poison`)
      if (player.energyCounters > 0) counters.push(`${player.energyCounters} energy`)
      return counters.join(", ")
    }
  }

  return (
    <Dialog open={!!trigger} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proliferate: {sourceCard.name}</DialogTitle>
          <DialogDescription>
            Choose any number of permanents and/or players with counters on them. Each gets another counter of each
            kind already there.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">Source Card:</p>
            <GameCard card={sourceCard} size="medium" />
          </div>

          {targetsWithCounters.length === 0 && (
            <p className="text-sm text-muted-foreground">No permanents or players with counters available</p>
          )}

          {targetsWithCounters.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold">Select targets to proliferate:</p>

              {/* Cards */}
              {targetsWithCounters.some((t) => t.type === "card") && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Permanents:</p>
                  <div className="grid grid-cols-4 gap-4">
                    {targetsWithCounters
                      .filter((t) => t.type === "card")
                      .map((target) => (
                        <div key={target.id} className="space-y-2">
                          <div
                            className="cursor-pointer"
                            onClick={() => toggleTarget(target.id)}
                          >
                            <GameCard
                              card={target.item as CardInstance}
                              size="medium"
                              selected={selectedTargets.has(target.id)}
                              selectable
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedTargets.has(target.id)}
                              onCheckedChange={() => toggleTarget(target.id)}
                            />
                            <span className="text-xs">{getCounterSummary(target)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Players */}
              {targetsWithCounters.some((t) => t.type === "player") && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Players:</p>
                  <div className="space-y-2">
                    {targetsWithCounters
                      .filter((t) => t.type === "player")
                      .map((target) => (
                        <div
                          key={target.id}
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted"
                          onClick={() => toggleTarget(target.id)}
                        >
                          <Checkbox
                            checked={selectedTargets.has(target.id)}
                            onCheckedChange={() => toggleTarget(target.id)}
                          />
                          <div className="flex-1">
                            <p className="font-semibold">{target.item.name}</p>
                            <p className="text-xs text-muted-foreground">{getCounterSummary(target)}</p>
                          </div>
                          <Badge variant="secondary">{selectedTargets.has(target.id) ? "Selected" : ""}</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4">
            <p className="text-sm text-muted-foreground">{selectedTargets.size} target(s) selected</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                Confirm Proliferate
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
