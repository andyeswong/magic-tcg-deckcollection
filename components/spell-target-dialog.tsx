"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GameCard } from "@/components/game-card"
import type { CardInstance } from "@/lib/game/types"

interface SpellTargetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spellName: string
  targetPrompt: string // e.g., "Choose up to 3 target creatures"
  validTargets: CardInstance[]
  minTargets: number
  maxTargets: number
  onConfirm: (targetIds: string[]) => void
}

export function SpellTargetDialog({
  open,
  onOpenChange,
  spellName,
  targetPrompt,
  validTargets,
  minTargets,
  maxTargets,
  onConfirm,
}: SpellTargetDialogProps) {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])

  const handleToggleTarget = (cardId: string) => {
    if (selectedTargets.includes(cardId)) {
      setSelectedTargets(selectedTargets.filter(id => id !== cardId))
    } else {
      if (selectedTargets.length < maxTargets) {
        setSelectedTargets([...selectedTargets, cardId])
      }
    }
  }

  const handleConfirm = () => {
    if (selectedTargets.length < minTargets) return
    onConfirm(selectedTargets)
    onOpenChange(false)
    setSelectedTargets([])
  }

  const canConfirm = selectedTargets.length >= minTargets && selectedTargets.length <= maxTargets

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{spellName}</DialogTitle>
          <DialogDescription>{targetPrompt}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection counter */}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
            <p className="text-sm">
              Selected: <strong>{selectedTargets.length}</strong>
              {minTargets > 0 && ` / Required: ${minTargets}`}
              {maxTargets < 999 && ` / Max: ${maxTargets}`}
            </p>
            {selectedTargets.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTargets([])}
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Target grid */}
          <div className="grid grid-cols-6 gap-3 max-h-96 overflow-y-auto p-2 border rounded-lg bg-muted/20">
            {validTargets.length === 0 ? (
              <div className="col-span-6 text-center py-8 text-muted-foreground">
                No valid targets available
              </div>
            ) : (
              validTargets.map((card, index) => (
                <div
                  key={card.instanceId}
                  className={`relative cursor-pointer transition-all ${
                    selectedTargets.includes(card.instanceId)
                      ? "ring-2 ring-primary scale-105"
                      : "hover:scale-105"
                  }`}
                  onClick={() => handleToggleTarget(card.instanceId)}
                >
                  {selectedTargets.includes(card.instanceId) && (
                    <Badge className="absolute -top-2 -right-2 z-10 bg-primary">
                      {selectedTargets.indexOf(card.instanceId) + 1}
                    </Badge>
                  )}
                  <GameCard card={card} size="small" />
                </div>
              ))
            )}
          </div>

          {/* Selected targets preview */}
          {selectedTargets.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Selected Targets ({selectedTargets.length}):</p>
              <div className="flex flex-wrap gap-2">
                {selectedTargets.map(targetId => {
                  const card = validTargets.find(c => c.instanceId === targetId)!
                  return (
                    <div
                      key={targetId}
                      className="bg-primary/10 px-3 py-2 rounded-lg flex items-center gap-2"
                    >
                      <span className="text-sm font-medium">{card.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleTarget(targetId)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setSelectedTargets([])
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              Confirm Targets {selectedTargets.length > 0 && `(${selectedTargets.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
