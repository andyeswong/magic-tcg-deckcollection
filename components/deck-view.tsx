"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RemoveCardButton } from "@/components/remove-card-button"
import { ManaSymbols, ConvertedManaCost } from "@/components/mana-symbols"
import { Sparkles, Zap, BookOpen, Plus, Minus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { DeckCard } from "@/lib/types"

interface DeckViewProps {
  deckId: string
  deckCards: DeckCard[]
}

export function DeckView({ deckId, deckCards }: DeckViewProps) {
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null)
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false)
  const router = useRouter()

  const updateQuantity = async (newQuantity: number) => {
    if (!selectedCard) return

    setIsUpdatingQuantity(true)
    try {
      const response = await fetch(`/api/deck-cards/${selectedCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update quantity")
      }

      // Update local state
      setSelectedCard({ ...selectedCard, quantity: newQuantity })
      router.refresh()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to update quantity")
    } finally {
      setIsUpdatingQuantity(false)
    }
  }

  const incrementQuantity = async () => {
    if (!selectedCard) return
    const newQuantity = (selectedCard.quantity || 1) + 1

    // Check MTG rules: max 4 copies for non-basic lands
    const isBasicLand = selectedCard.type_line?.toLowerCase().includes("basic land")
    if (!isBasicLand && newQuantity > 4) {
      alert("Maximum 4 copies allowed for non-basic lands")
      return
    }

    // Calculate current deck total
    const currentTotal = deckCards.reduce((sum, card) => sum + (card.quantity || 1), 0)
    if (currentTotal >= 99) {
      alert("Deck is full (99 cards maximum)")
      return
    }

    await updateQuantity(newQuantity)
  }

  const decrementQuantity = async () => {
    if (!selectedCard) return
    const newQuantity = (selectedCard.quantity || 1) - 1

    if (newQuantity < 1) {
      alert("Use the remove button to delete this card")
      return
    }

    await updateQuantity(newQuantity)
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {deckCards.map((card: DeckCard) => (
          <Card
            key={card.id}
            className="overflow-hidden group relative cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => setSelectedCard(card)}
          >
            {card.card_image_url && (
              <img src={card.card_image_url} alt={card.card_name} className="w-full h-auto" />
            )}

            {/* Quantity Badge */}
            {card.quantity && card.quantity > 1 && (
              <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-lg">
                {card.quantity}×
              </div>
            )}

            <CardContent className="p-3">
              <p className="font-semibold text-sm truncate">{card.card_name}</p>
              {card.mana_cost && <p className="text-xs text-muted-foreground">{card.mana_cost}</p>}
              {card.quantity && card.quantity > 1 && (
                <p className="text-xs text-primary font-semibold mt-1">Qty: {card.quantity}</p>
              )}
            </CardContent>

            {/* Remove Button */}
            <div
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <RemoveCardButton deckId={deckId} cardId={card.id} />
            </div>
          </Card>
        ))}
      </div>

      {/* Card Details Modal */}
      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedCard && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedCard.card_name}</DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Card Image */}
                <div className="relative">
                  {selectedCard.card_image_url && (
                    <img
                      src={selectedCard.card_image_url}
                      alt={selectedCard.card_name}
                      className="w-full rounded-lg shadow-lg"
                    />
                  )}
                  {selectedCard.quantity && selectedCard.quantity > 1 && (
                    <div className="absolute top-4 left-4 bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl shadow-lg">
                      {selectedCard.quantity}×
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="space-y-4">
                  {/* Type Line */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Type
                    </h3>
                    <p className="text-lg font-medium">{selectedCard.type_line || "Unknown"}</p>
                  </div>

                  {/* Mana Cost */}
                  {selectedCard.mana_cost && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Mana Cost
                      </h3>
                      <div className="flex items-center gap-3">
                        <ManaSymbols manaCost={selectedCard.mana_cost} size="lg" />
                        {(selectedCard as any).cmc !== undefined && (
                          <ConvertedManaCost cmc={(selectedCard as any).cmc} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Power/Toughness */}
                  {(selectedCard as any).power && (selectedCard as any).toughness && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        Power / Toughness
                      </h3>
                      <p className="text-2xl font-bold">
                        {(selectedCard as any).power} / {(selectedCard as any).toughness}
                      </p>
                    </div>
                  )}

                  {/* Keywords */}
                  {(selectedCard as any).keywords && (selectedCard as any).keywords.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {(selectedCard as any).keywords.map((keyword: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Oracle Text */}
                  {(selectedCard as any).oracle_text && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        Card Text
                      </h3>
                      <p className="text-sm leading-relaxed bg-muted/50 p-3 rounded-lg">
                        {(selectedCard as any).oracle_text}
                      </p>
                    </div>
                  )}

                  {/* Flavor Text */}
                  {(selectedCard as any).flavor_text && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Flavor Text
                      </h3>
                      <p className="text-sm italic text-muted-foreground leading-relaxed">
                        {(selectedCard as any).flavor_text}
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Quantity in Deck */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Quantity in Deck
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 border rounded-lg p-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={decrementQuantity}
                          disabled={isUpdatingQuantity || (selectedCard.quantity || 1) <= 1}
                          className="h-8 w-8"
                        >
                          {isUpdatingQuantity ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="text-2xl font-bold text-primary min-w-[3rem] text-center">
                          {selectedCard.quantity || 1}×
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={incrementQuantity}
                          disabled={isUpdatingQuantity}
                          className="h-8 w-8"
                        >
                          {isUpdatingQuantity ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedCard.quantity === 1 ? "1 copy" : `${selectedCard.quantity} copies`}
                      </p>
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Source
                    </h3>
                    <Badge variant="outline" className="capitalize">
                      {selectedCard.source || "Unknown"}
                    </Badge>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedCard(null)}
                    >
                      Close
                    </Button>
                    <div onClick={(e) => e.stopPropagation()}>
                      <RemoveCardButton
                        deckId={deckId}
                        cardId={selectedCard.id}
                        onRemove={() => setSelectedCard(null)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
