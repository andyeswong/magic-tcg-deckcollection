"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { GameCard } from "@/components/game-card"
import type { PendingTrigger, CardInstance } from "@/lib/game/types"
import { useState } from "react"

interface SupportTargetDialogProps {
  trigger: PendingTrigger | null
  sourceCard: CardInstance | null
  validTargets: CardInstance[]
  onConfirm: (triggerId: string, selectedTargetIds: string[]) => void
  onClose: () => void
}

export function SupportTargetDialog({
  trigger,
  sourceCard,
  validTargets,
  onConfirm,
  onClose,
}: SupportTargetDialogProps) {
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])

  if (!trigger || !sourceCard) return null

  const maxTargets = trigger.amount || 1
  const canSelectMore = selectedTargetIds.length < maxTargets

  const toggleTarget = (targetId: string) => {
    if (selectedTargetIds.includes(targetId)) {
      setSelectedTargetIds(selectedTargetIds.filter(id => id !== targetId))
    } else if (canSelectMore) {
      setSelectedTargetIds([...selectedTargetIds, targetId])
    }
  }

  const handleConfirm = () => {
    onConfirm(trigger.id, selectedTargetIds)
    setSelectedTargetIds([])
  }

  return (
    <Dialog open={!!trigger} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Support: {sourceCard.name}</DialogTitle>
          <DialogDescription>
            Put a +1/+1 counter on each of up to {maxTargets} target creature{maxTargets > 1 ? 's' : ''}
            <br />
            Selected: {selectedTargetIds.length} / {maxTargets}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">Source Card:</p>
            <GameCard card={sourceCard} size="medium" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Select up to {maxTargets} target creature{maxTargets > 1 ? 's' : ''}:</p>
            <div className="grid grid-cols-4 gap-4">
              {validTargets.map((target) => {
                const isSelected = selectedTargetIds.includes(target.instanceId)
                return (
                  <div
                    key={target.instanceId}
                    className="cursor-pointer"
                    onClick={() => toggleTarget(target.instanceId)}
                  >
                    <GameCard
                      card={target}
                      size="medium"
                      selected={isSelected}
                      selectable
                    />
                  </div>
                )
              })}
            </div>

            {validTargets.length === 0 && (
              <p className="text-sm text-muted-foreground">No valid targets available</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Skip (0 targets)
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedTargetIds.length === 0}
            >
              Confirm {selectedTargetIds.length} Target{selectedTargetIds.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
