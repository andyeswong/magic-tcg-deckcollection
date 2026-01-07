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

interface MulliganDialogProps {
  open: boolean
  hand: CardInstance[]
  mulliganCount: number
  onMulligan: () => void
  onKeep: () => void
}

export function MulliganDialog({
  open,
  hand,
  mulliganCount,
  onMulligan,
  onKeep,
}: MulliganDialogProps) {
  // Calculate how many cards will be drawn if mulligan is taken
  const nextHandSize = Math.max(1, 7 - mulliganCount)

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mulliganCount === 0
              ? "Opening Hand - Mulligan?"
              : `Mulligan #${mulliganCount} - Keep or Mulligan Again?`}
          </DialogTitle>
          <DialogDescription>
            {mulliganCount === 0
              ? "This is your opening hand. You may mulligan (shuffle and draw a new hand)."
              : `If you mulligan again, you will draw ${nextHandSize} card${nextHandSize === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hand display */}
          <div className="grid grid-cols-7 gap-2">
            {hand.map((card) => (
              <CardPreview key={card.instanceId} card={card}>
                <div className="cursor-pointer transition-transform hover:scale-105">
                  <img
                    src={card.imageUrl || "/card-back.jpg"}
                    alt={card.name}
                    className="w-full rounded border-2 border-gray-300 hover:border-blue-500"
                  />
                  <p className="text-xs text-center mt-1 truncate">{card.name}</p>
                </div>
              </CardPreview>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onMulligan}>
              Mulligan
              {mulliganCount > 0 && ` (Draw ${nextHandSize})`}
            </Button>
            <Button onClick={onKeep}>Keep Hand</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
