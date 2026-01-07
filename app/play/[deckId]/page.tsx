import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { GameInitializer } from "@/components/game-initializer"

export default async function PlayGamePage({
  params,
}: {
  params: Promise<{ deckId: string }>
}) {
  const { deckId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch deck
  const { data: deck } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .single()

  if (!deck) {
    notFound()
  }

  // Fetch commander card data
  const { data: commanderCard } = await supabase
    .from("cards")
    .select("mana_cost, type_line, cmc, power, toughness, colors, color_identity, keywords, oracle_text")
    .eq("id", deck.commander_card_id)
    .single()

  // Fetch deck cards with full card data
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
        keywords,
        color_identity
      )
    `)
    .eq("deck_id", deckId)
    .order("card_name")

  if (!deckCards || deckCards.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Deck is Empty</h1>
          <p className="text-muted-foreground">Add cards to your deck before playing</p>
        </div>
      </div>
    )
  }

  // Flatten the data structure
  const cardsWithData = deckCards.map((dc: any) => ({
    ...dc,
    cards: {
      cmc: dc.cards?.cmc || 0,
      colors: dc.cards?.colors || [],
      type_line: dc.type_line || dc.cards?.type_line || "",
      oracle_text: dc.cards?.oracle_text || "",
      flavor_text: dc.cards?.flavor_text || "",
      power: dc.cards?.power || "",
      toughness: dc.cards?.toughness || "",
      keywords: dc.cards?.keywords || [],
      color_identity: dc.cards?.color_identity || [],
    },
  }))

  return (
    <GameInitializer
      deckData={{
        id: deck.id,
        name: deck.name,
        commander_name: deck.commander_name,
        commander_image_url: deck.commander_image_url,
        commander_card_id: deck.commander_card_id,
        commander_mana_cost: commanderCard?.mana_cost || "",
        commander_type_line: commanderCard?.type_line || "Legendary Creature",
        commander_cmc: commanderCard?.cmc || 0,
        commander_power: commanderCard?.power || "",
        commander_toughness: commanderCard?.toughness || "",
        commander_colors: commanderCard?.colors || [],
        commander_color_identity: commanderCard?.color_identity || [],
        commander_keywords: commanderCard?.keywords || [],
        commander_oracle_text: commanderCard?.oracle_text || "",
        user_id: deck.user_id,
      }}
      deckCards={cardsWithData}
      userId={user.id}
      userName={user.email || "Player"}
    />
  )
}
