"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { MagicCard } from "@/lib/types"

interface ChangeCommanderButtonProps {
  deckId: string
  currentCommander: string
}

export function ChangeCommanderButton({ deckId, currentCommander }: ChangeCommanderButtonProps) {
  const [isChangingCommander, setIsChangingCommander] = useState(false)
  const [commanderSearch, setCommanderSearch] = useState("")
  const [commanderResults, setCommanderResults] = useState<MagicCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Debounced search
  useEffect(() => {
    if (!commanderSearch.trim()) {
      setCommanderResults([])
      return
    }

    const timer = setTimeout(() => {
      searchCommanders()
    }, 300)

    return () => clearTimeout(timer)
  }, [commanderSearch])

  const searchCommanders = async () => {
    if (!commanderSearch.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/search-cards?q=${encodeURIComponent(commanderSearch)}&commander=true`)
      const data = await response.json()
      
      // Filter for legendary creatures (additional check for Scryfall results)
      const legendaryCreatures = data.cards?.filter(
        (card: MagicCard) => 
          card.type?.toLowerCase().includes("legendary") && 
          card.type?.toLowerCase().includes("creature")
      ) || []
      
      setCommanderResults(legendaryCreatures)
    } catch (error) {
      console.error("Error searching commanders:", error)
      toast({
        title: "Error",
        description: "Failed to search for commanders",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleCommanderChange = async (commander: MagicCard) => {
    try {
      console.log("[COMMANDER CHANGE] Selected commander:", commander)
      console.log("[COMMANDER CHANGE] Mana cost:", commander.manaCost, commander.mana_cost)
      
      // First, add/update the commander card in the cards table
      const cardResponse = await fetch("/api/cards/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: [{
            id: commander.id,
            name: commander.name,
            type: commander.type,
            manaCost: commander.manaCost || commander.mana_cost || "",
            cmc: commander.cmc || 0,
            colors: commander.colors || [],
            colorIdentity: commander.colorIdentity || commander.color_identity || [],
            imageUrl: commander.imageUrl || commander.image_url,
            text: commander.text || commander.oracleText || commander.oracle_text || "",
            flavor: commander.flavor || commander.flavor_text,
            power: commander.power,
            toughness: commander.toughness,
            keywords: commander.keywords || [],
            source: commander.source || "scryfall",
            rarity: commander.rarity,
          }]
        }),
      })

      if (!cardResponse.ok) {
        const errorData = await cardResponse.json()
        console.error("[COMMANDER CHANGE] Upsert failed:", errorData)
        throw new Error("Failed to upsert card")
      }

      // Then update the deck's commander
      const deckResponse = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commander_name: commander.name,
          commander_image_url: commander.imageUrl,
        }),
      })

      if (!deckResponse.ok) throw new Error("Failed to update deck")

      toast({
        title: "Success",
        description: `Commander changed to ${commander.name}`,
      })

      setIsChangingCommander(false)
      router.refresh()
    } catch (error) {
      console.error("Error changing commander:", error)
      toast({
        title: "Error",
        description: "Failed to change commander",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isChangingCommander} onOpenChange={setIsChangingCommander}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Change Commander
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change Commander</DialogTitle>
          <DialogDescription>
            Search for a legendary creature to be your new commander. Current: {currentCommander}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search for a legendary creature..."
            value={commanderSearch}
            onChange={(e) => setCommanderSearch(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          />
          {isSearching && (
            <p className="text-center text-muted-foreground">Searching...</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {commanderResults.map((commander) => (
              <Card
                key={commander.id}
                className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => handleCommanderChange(commander)}
              >
                {commander.imageUrl && (
                  <img
                    src={commander.imageUrl}
                    alt={commander.name}
                    className="w-full h-auto"
                  />
                )}
                <CardContent className="p-3">
                  <p className="font-semibold text-sm truncate">{commander.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{commander.type}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
