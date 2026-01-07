"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GameCard } from "@/components/game-card"
import type { CardInstance } from "@/lib/game/types"

interface LibrarySearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spellName: string
  searchableCards: CardInstance[]
  searchPrompt: string // e.g., "Search for a Forest card"
  onSelectCard: (cardId: string) => void
  onDecline: () => void
}

export function LibrarySearchDialog({
  open,
  onOpenChange,
  spellName,
  searchableCards,
  searchPrompt,
  onSelectCard,
  onDecline,
}: LibrarySearchDialogProps) {
  const [searchFilter, setSearchFilter] = useState("")
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const filteredCards = searchableCards.filter(card =>
    card.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    card.typeLine.toLowerCase().includes(searchFilter.toLowerCase())
  )

  const handleConfirm = () => {
    if (!selectedCardId) return
    onSelectCard(selectedCardId)
    onOpenChange(false)
    setSelectedCardId(null)
    setSearchFilter("")
  }

  const handleDecline = () => {
    onDecline()
    onOpenChange(false)
    setSelectedCardId(null)
    setSearchFilter("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{spellName}</DialogTitle>
          <DialogDescription>{searchPrompt}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search filter */}
          <div>
            <Input
              placeholder="Filter by name or type..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-6 gap-2 max-h-96 overflow-y-auto p-2 border rounded-lg bg-muted/20">
            {filteredCards.length === 0 ? (
              <div className="col-span-6 text-center py-8 text-muted-foreground">
                No matching cards found
              </div>
            ) : (
              filteredCards.map(card => (
                <div
                  key={card.instanceId}
                  className={`cursor-pointer transition-all ${
                    selectedCardId === card.instanceId
                      ? "ring-2 ring-primary scale-105"
                      : "hover:scale-105"
                  }`}
                  onClick={() => setSelectedCardId(card.instanceId)}
                >
                  <GameCard card={card} size="small" showDetails={false} />
                </div>
              ))
            )}
          </div>

          {/* Selected card preview */}
          {selectedCardId && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Selected:</p>
              <div className="flex items-center gap-4 bg-primary/10 p-3 rounded-lg">
                <div className="w-32">
                  <GameCard
                    card={searchableCards.find(c => c.instanceId === selectedCardId)!}
                    size="medium"
                  />
                </div>
                <div>
                  <p className="font-semibold">
                    {searchableCards.find(c => c.instanceId === selectedCardId)!.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchableCards.find(c => c.instanceId === selectedCardId)!.typeLine}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleDecline}>
              Don't Search
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedCardId}>
              Choose This Card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
