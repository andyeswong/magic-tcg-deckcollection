"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CardPreview } from "./card-preview"
import { CardInstance } from "@/lib/game/types"

interface MulliganScryDialogProps {
  open: boolean
  hand: CardInstance[]
  cardsToBottom: number
  onConfirm: (selectedCardIds: string[]) => void
}

export function MulliganScryDialog({
  open,
  hand,
  cardsToBottom,
  onConfirm,
}: MulliganScryDialogProps) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())

  const toggleCard = (cardId: string) => {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId)
    } else if (newSelected.size < cardsToBottom) {
      newSelected.add(cardId)
    }
    setSelectedCards(newSelected)
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedCards))
    setSelectedCards(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Cards to Put on Bottom</DialogTitle>
          <DialogDescription>
            Select {cardsToBottom} card{cardsToBottom === 1 ? "" : "s"} to put on the bottom of your library.
            ({selectedCards.size} / {cardsToBottom} selected)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hand display */}
          <div className="grid grid-cols-7 gap-2">
            {hand.map((card) => {
              const isSelected = selectedCards.has(card.instanceId)
              return (
                <CardPreview key={card.instanceId} card={card}>
                  <div
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      isSelected
                        ? "ring-4 ring-blue-500 shadow-lg shadow-blue-500/50"
                        : "border-2 border-gray-300 hover:border-blue-500"
                    }`}
                    onClick={() => toggleCard(card.instanceId)}
                  >
                    <img
                      src={card.imageUrl || "/card-back.jpg"}
                      alt={card.name}
                      className="w-full rounded"
                    />
                    <p className="text-xs text-center mt-1 truncate">{card.name}</p>
                  </div>
                </CardPreview>
              )
            })}
          </div>

          {/* Confirm button */}
          <div className="flex justify-end">
            <Button
              onClick={handleConfirm}
              disabled={selectedCards.size !== cardsToBottom}
            >
              Confirm Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
