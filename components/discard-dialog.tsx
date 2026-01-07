"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { GameCard } from "@/components/game-card"
import type { CardInstance } from "@/lib/game/types"
import { X } from "lucide-react"

interface DiscardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hand: CardInstance[]
  discardCount: number
  onDiscard: (cardIds: string[]) => void
}

export function DiscardDialog({ open, onOpenChange, hand, discardCount, onDiscard }: DiscardDialogProps) {
  const [selectedCards, setSelectedCards] = useState<string[]>([])

  const toggleCard = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId))
    } else if (selectedCards.length < discardCount) {
      setSelectedCards([...selectedCards, cardId])
    }
  }

  const handleSubmit = () => {
    if (selectedCards.length === discardCount) {
      onDiscard(selectedCards)
      setSelectedCards([])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      // Prevent closing the dialog - must complete discards
      if (!open) return
      onOpenChange(open)
    }}>
      <DialogContent
        className="max-w-4xl max-h-[80vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Discard to Hand Size</DialogTitle>
          <DialogDescription>
            You have {hand.length} cards in hand. Maximum hand size is 7.
            <br />
            Select {discardCount} card{discardCount > 1 ? "s" : ""} to discard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected count */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              Selected: {selectedCards.length} / {discardCount}
            </span>
            {selectedCards.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedCards([])}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-4 gap-3">
            {hand.map((card) => {
              const isSelected = selectedCards.includes(card.instanceId)
              const canSelect = isSelected || selectedCards.length < discardCount

              return (
                <div
                  key={card.instanceId}
                  className={`cursor-pointer transition-all ${
                    !canSelect ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => canSelect && toggleCard(card.instanceId)}
                >
                  <GameCard
                    card={card}
                    size="medium"
                    selected={isSelected}
                    selectable={canSelect}
                  />
                </div>
              )
            })}
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={selectedCards.length !== discardCount}
              size="lg"
            >
              Discard {selectedCards.length} / {discardCount} Cards
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
