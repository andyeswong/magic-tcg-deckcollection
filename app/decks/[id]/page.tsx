import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { ArrowLeft, Plus, BarChart3, LayoutGrid } from "lucide-react"
import type { DeckCard } from "@/lib/types"
import { DeckView } from "@/components/deck-view"
import { DeckStatistics } from "@/components/deck-statistics"
import { DeckActions } from "@/components/deck-actions"

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: deck } = await supabase.from("decks").select("*").eq("id", id).eq("user_id", user.id).single()

  if (!deck) {
    notFound()
  }

  // Fetch deck cards with full card data from cards table
  const { data: deckCards } = await supabase
    .from("deck_cards")
    .select(`
      *,
      cards (
        cmc,
        colors,
        type_line,
        oracle_text,
        flavor_text,
        power,
        toughness,
        keywords
      )
    `)
    .eq("deck_id", id)
    .order("card_name")

  // Flatten the data structure for easier use
  const cardsWithData = deckCards?.map((dc: any) => ({
    ...dc,
    cmc: dc.cards?.cmc,
    colors: dc.cards?.colors,
    type_line: dc.type_line || dc.cards?.type_line,
    oracle_text: dc.cards?.oracle_text,
    flavor_text: dc.cards?.flavor_text,
    power: dc.cards?.power,
    toughness: dc.cards?.toughness,
    keywords: dc.cards?.keywords,
  }))

  // Calculate total card count (sum of all quantities + commander)
  const totalCards = (deckCards?.reduce((sum, card) => sum + (card.quantity || 1), 0) || 0) + 1
  const uniqueCards = deckCards?.length || 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link href="/decks">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Decks
            </Link>
          </Button>
          <DeckActions deckId={id} deckName={deck.name} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-3xl">{deck.name}</CardTitle>
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-bold text-lg text-foreground">{totalCards}</span> / 100 total cards
                </p>
                <p className="text-sm text-muted-foreground">
                  {uniqueCards} unique cards • {totalCards - 1} in deck + 1 commander
                </p>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Commander</CardTitle>
            </CardHeader>
            <CardContent>
              {deck.commander_image_url && (
                <img
                  src={deck.commander_image_url}
                  alt={deck.commander_name}
                  className="w-full rounded-lg mb-2"
                />
              )}
              <p className="font-semibold">{deck.commander_name}</p>
            </CardContent>
          </Card>
        </div>

        {!deckCards || deckCards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <p className="text-xl text-muted-foreground">No cards in this deck yet</p>
              <Button asChild>
                <Link href={`/builder/${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Card
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="cards" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="cards" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Cards
                </TabsTrigger>
                <TabsTrigger value="statistics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Statistics
                </TabsTrigger>
              </TabsList>
              {totalCards < 100 && (
                <Button asChild>
                  <Link href={`/builder/${id}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Cards
                  </Link>
                </Button>
              )}
            </div>

            <TabsContent value="cards" className="mt-0">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">Deck Cards</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {uniqueCards} unique • {totalCards - 1} total cards
                </p>
              </div>
              <DeckView deckId={id} deckCards={deckCards} />
            </TabsContent>

            <TabsContent value="statistics" className="mt-0">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">Deck Statistics</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Analysis of your deck composition and mana curve
                </p>
              </div>
              <DeckStatistics cards={cardsWithData || []} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
