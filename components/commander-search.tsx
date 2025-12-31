"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Loader2 } from "lucide-react"
import type { MTGCard } from "@/lib/types"
import { useRouter } from "next/navigation"
import { searchCards } from "@/lib/mtg-api"

export function CommanderSearch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<MTGCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSearch = async () => {
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const cards = await searchCards(searchTerm, true)
      setResults(cards)

      if (cards.length === 0) {
        setError("No legendary creatures found. Try a different search.")
      }
    } catch (err) {
      setError("Failed to search for cards. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectCommander = async (card: MTGCard) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${card.name} Deck`,
          commander: card, // Send the full commander object
        }),
      })

      if (!response.ok) throw new Error("Failed to create deck")

      const { deckId } = await response.json()
      router.push(`/decks/${deckId}`)
    } catch (err) {
      setError("Failed to create deck. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="Search for legendary creatures (e.g., Atraxa, Urza, Yuna)..."
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
          <Card
            key={card.id}
            className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleSelectCommander(card)}
          >
            {card.imageUrl && (
              <img src={card.imageUrl || "/placeholder.svg"} alt={card.name} className="w-full h-auto" />
            )}
            <CardContent className="p-4">
              <p className="font-semibold mb-1">{card.name}</p>
              <p className="text-xs text-muted-foreground">{card.type}</p>
              {card.manaCost && <p className="text-xs text-muted-foreground mt-1">{card.manaCost}</p>}
              {card.source === "moxfield" && (
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] bg-accent/50 text-accent-foreground rounded-full">
                  Moxfield
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
