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
import { ArrowDown, ArrowUp } from "lucide-react"

interface ScryDialogProps {
  open: boolean
  cards: CardInstance[]
  scryAmount: number
  onConfirm: (topCards: string[], bottomCards: string[]) => void
}

export function ScryDialog({
  open,
  cards,
  scryAmount,
  onConfirm,
}: ScryDialogProps) {
  const [topCards, setTopCards] = useState<string[]>(cards.map(c => c.instanceId))
  const [bottomCards, setBottomCards] = useState<string[]>([])

  const moveToBottom = (cardId: string) => {
    setTopCards(prev => prev.filter(id => id !== cardId))
    setBottomCards(prev => [...prev, cardId])
  }

  const moveToTop = (cardId: string) => {
    setBottomCards(prev => prev.filter(id => id !== cardId))
    setTopCards(prev => [...prev, cardId])
  }

  const moveUp = (cardId: string) => {
    const index = topCards.indexOf(cardId)
    if (index > 0) {
      const newTop = [...topCards]
      ;[newTop[index - 1], newTop[index]] = [newTop[index], newTop[index - 1]]
      setTopCards(newTop)
    }
  }

  const moveDown = (cardId: string) => {
    const index = topCards.indexOf(cardId)
    if (index < topCards.length - 1) {
      const newTop = [...topCards]
      ;[newTop[index], newTop[index + 1]] = [newTop[index + 1], newTop[index]]
      setTopCards(newTop)
    }
  }

  const handleConfirm = () => {
    onConfirm(topCards, bottomCards)
    // Reset state
    setTopCards(cards.map(c => c.instanceId))
    setBottomCards([])
  }

  const getCard = (cardId: string) => cards.find(c => c.instanceId === cardId)!

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scry {scryAmount}</DialogTitle>
          <DialogDescription>
            Look at the top {scryAmount} card{scryAmount === 1 ? "" : "s"} of your library.
            Put any number on the bottom in any order, then put the rest on top in any order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Top of Library */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">
              Top of Library ({topCards.length})
            </h3>
            <div className="grid grid-cols-7 gap-2 min-h-[200px] bg-blue-950/20 p-3 rounded-lg border border-blue-500/30">
              {topCards.map((cardId, index) => {
                const card = getCard(cardId)
                return (
                  <CardPreview key={cardId} card={card}>
                    <div className="relative">
                      <img
                        src={card.imageUrl || "/card-back.jpg"}
                        alt={card.name}
                        className="w-full rounded border-2 border-blue-500"
                      />
                      <p className="text-xs text-center mt-1 truncate text-white">
                        {index + 1}. {card.name}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => moveUp(cardId)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => moveDown(cardId)}
                          disabled={index === topCards.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 flex-1 text-xs"
                          onClick={() => moveToBottom(cardId)}
                        >
                          Bottom
                        </Button>
                      </div>
                    </div>
                  </CardPreview>
                )
              })}
            </div>
          </div>

          {/* Bottom of Library */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">
              Bottom of Library ({bottomCards.length})
            </h3>
            <div className="grid grid-cols-7 gap-2 min-h-[200px] bg-red-950/20 p-3 rounded-lg border border-red-500/30">
              {bottomCards.map((cardId) => {
                const card = getCard(cardId)
                return (
                  <CardPreview key={cardId} card={card}>
                    <div className="relative">
                      <img
                        src={card.imageUrl || "/card-back.jpg"}
                        alt={card.name}
                        className="w-full rounded border-2 border-red-500"
                      />
                      <p className="text-xs text-center mt-1 truncate text-white">
                        {card.name}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-full mt-1 text-xs"
                        onClick={() => moveToTop(cardId)}
                      >
                        To Top
                      </Button>
                    </div>
                  </CardPreview>
                )
              })}
            </div>
          </div>

          {/* Confirm button */}
          <div className="flex justify-end">
            <Button onClick={handleConfirm}>
              Confirm Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
