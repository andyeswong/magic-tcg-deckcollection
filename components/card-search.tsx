"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Loader2, Plus, Minus } from "lucide-react"
import type { MTGCard } from "@/lib/types"
import { searchCards } from "@/lib/mtg-api"
import { createClient } from "@/lib/supabase/client"

interface CardSearchProps {
  deckId: string
  commanderColors: string[]
  onCardAdded?: () => void
}

export function CardSearch({ deckId, onCardAdded }: CardSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<MTGCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [addingCardId, setAddingCardId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({})
  const [deckCardQuantities, setDeckCardQuantities] = useState<Record<string, number>>({})

  // Load current deck card quantities
  useEffect(() => {
    const loadDeckQuantities = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("deck_cards")
        .select("card_id, quantity")
        .eq("deck_id", deckId)

      if (data) {
        const quantities: Record<string, number> = {}
        data.forEach((card) => {
          quantities[card.card_id] = card.quantity || 1
        })
        setDeckCardQuantities(quantities)
      }
    }

    loadDeckQuantities()
  }, [deckId])

  const handleSearch = async () => {
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const cards = await searchCards(searchTerm, false)
      setResults(cards)

      if (cards.length === 0) {
        setError("No cards found. Try a different search.")
      }
    } catch (err) {
      setError("Failed to search for cards. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCard = async (card: MTGCard, quantity: number = 1) => {
    setAddingCardId(card.id)
    try {
      const response = await fetch("/api/deck-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId,
          card, // Send the full card object
          quantity,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add card")
      }

      // Update deck quantities
      setDeckCardQuantities({
        ...deckCardQuantities,
        [card.id]: (deckCardQuantities[card.id] || 0) + quantity,
      })

      // Reset quantity selector for this card
      setCardQuantities({
        ...cardQuantities,
        [card.id]: 1,
      })

      // Notify parent component that a card was added
      onCardAdded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add card. Please try again.")
      console.error(err)
    } finally {
      setAddingCardId(null)
    }
  }

  const updateQuantity = (cardId: string, delta: number) => {
    const current = cardQuantities[cardId] || 1
    const newQuantity = Math.max(1, Math.min(4, current + delta))
    setCardQuantities({
      ...cardQuantities,
      [cardId]: newQuantity,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="Search for cards by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {results.map((card) => (
          <Card key={card.id} className="overflow-hidden group relative">
            {card.imageUrl && (
              <img src={card.imageUrl || "/placeholder.svg"} alt={card.name} className="w-full h-auto" />
            )}
            <CardContent className="p-4">
              <p className="font-semibold mb-1 text-sm">{card.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{card.type}</p>
              {card.manaCost && <p className="text-xs text-muted-foreground mt-1">{card.manaCost}</p>}

              {/* Show current quantity in deck */}
              {deckCardQuantities[card.id] > 0 && (
                <div className="mt-2 px-2 py-1 bg-primary/10 text-primary rounded text-xs font-semibold">
                  In deck: {deckCardQuantities[card.id]}x
                </div>
              )}

              {card.source === "scryfall" && (
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                  Scryfall
                </span>
              )}

              {/* Quantity selector */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center border rounded-md">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      updateQuantity(card.id, -1)
                    }}
                    disabled={addingCardId === card.id}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{cardQuantities[card.id] || 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      updateQuantity(card.id, 1)
                    }}
                    disabled={addingCardId === card.id}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAddCard(card, cardQuantities[card.id] || 1)}
                  disabled={addingCardId === card.id}
                >
                  {addingCardId === card.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
