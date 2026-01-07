"use client"

import { useState, useEffect } from "react"
import { CardSearch } from "@/components/card-search"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, Crown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface DeckBuilderProps {
  deckId: string
  initialDeck: any
  initialCards: any[]
}

export function DeckBuilder({ deckId, initialDeck, initialCards }: DeckBuilderProps) {
  const [deck, setDeck] = useState(initialDeck)
  const [deckCards, setDeckCards] = useState(initialCards)
  const [recentCards, setRecentCards] = useState<any[]>([])

  // Calculate total card count (sum of all quantities + commander)
  const cardCount = deckCards.reduce((sum, card) => sum + (card.quantity || 1), 0) + 1

  useEffect(() => {
    // Set up real-time subscription to deck_cards
    const supabase = createClient()
    const channel = supabase
      .channel(`deck_${deckId}_cards`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deck_cards",
          filter: `deck_id=eq.${deckId}`,
        },
        async (payload) => {
          console.log("Card change detected:", payload)

          // Refresh deck cards
          const { data } = await supabase.from("deck_cards").select("*").eq("deck_id", deckId).order("created_at", { ascending: false })

          if (data) {
            setDeckCards(data)
            // Update recent cards (last 10)
            setRecentCards(data.slice(0, 10))
          }
        },
      )
      .subscribe()

    // Set initial recent cards
    setRecentCards(initialCards.slice(0, 10))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [deckId, initialCards])

  const handleCardAdded = async () => {
    // Refresh the deck cards list
    const supabase = createClient()
    const { data } = await supabase.from("deck_cards").select("*").eq("deck_id", deckId).order("created_at", { ascending: false })

    if (data) {
      setDeckCards(data)
      setRecentCards(data.slice(0, 10))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/decks/${deckId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deck
          </Link>
        </Button>

        {/* Commander Display */}
        <Card className="mb-8 border-2 border-primary bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {deck.commander_image_url && (
                <div className="relative">
                  <img
                    src={deck.commander_image_url}
                    alt={deck.commander_name}
                    className="w-48 h-auto rounded-lg shadow-lg border-2 border-primary"
                  />
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-2">
                    <Crown className="h-5 w-5" />
                  </div>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Commander</span>
                </div>
                <h1 className="text-4xl font-bold mb-2">{deck.name}</h1>
                <p className="text-2xl text-muted-foreground mb-4">{deck.commander_name}</p>
                <div className="flex items-center gap-4">
                  <div className="text-lg">
                    <span className="font-bold text-2xl">{cardCount}</span>
                    <span className="text-muted-foreground"> / 100 cards</span>
                  </div>
                  {cardCount >= 100 && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded-full text-sm font-semibold">
                      Deck Complete!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Search */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Search for Cards</h2>
          <CardSearch deckId={deckId} commanderColors={[]} onCardAdded={handleCardAdded} />
        </div>

        {/* Recently Added Cards Preview */}
        {recentCards.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Recently Added Cards</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recentCards.map((card) => (
                <Card key={card.id} className="overflow-hidden relative">
                  {card.card_image_url && (
                    <img src={card.card_image_url} alt={card.card_name} className="w-full h-auto" />
                  )}
                  {card.quantity > 1 && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg">
                      {card.quantity}×
                    </div>
                  )}
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm truncate">{card.card_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{card.type_line}</p>
                    {card.quantity > 1 && (
                      <p className="text-xs text-primary font-semibold mt-1">Quantity: {card.quantity}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
