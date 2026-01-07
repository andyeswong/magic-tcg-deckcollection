"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { GameCard } from "@/components/game-card"
import type { PendingTrigger, CardInstance } from "@/lib/game/types"
import { useState } from "react"

interface TriggerTargetDialogProps {
  trigger: PendingTrigger | null
  sourceCard: CardInstance | null
  validTargets: CardInstance[]
  onSelectTarget: (triggerId: string, targetCardId: string) => void
  onClose: () => void
}

export function TriggerTargetDialog({
  trigger,
  sourceCard,
  validTargets,
  onSelectTarget,
  onClose,
}: TriggerTargetDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)

  if (!trigger || !sourceCard) return null

  const handleConfirm = () => {
    if (selectedTargetId) {
      onSelectTarget(trigger.id, selectedTargetId)
      setSelectedTargetId(null)
    }
  }

  const getEffectDescription = (effect: string): string => {
    switch (effect) {
      case "add_counter_target":
        return `Put ${trigger.amount || 1} +1/+1 counter(s) on target creature`
      case "complex_target":
        return "Choose target creature"
      default:
        return effect
    }
  }

  return (
    <Dialog open={!!trigger} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Triggered Ability: {sourceCard.name}</DialogTitle>
          <DialogDescription>
            {getEffectDescription(trigger.effect)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">Source Card:</p>
            <GameCard card={sourceCard} size="medium" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Select a target creature:</p>
            <div className="grid grid-cols-4 gap-4">
              {validTargets.map((target) => (
                <div
                  key={target.instanceId}
                  className="cursor-pointer"
                  onClick={() => setSelectedTargetId(target.instanceId)}
                >
                  <GameCard
                    card={target}
                    size="medium"
                    selected={selectedTargetId === target.instanceId}
                    selectable
                  />
                </div>
              ))}
            </div>

            {validTargets.length === 0 && (
              <p className="text-sm text-muted-foreground">No valid targets available</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedTargetId}
            >
              Confirm Target
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
