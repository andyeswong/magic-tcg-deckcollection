import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { deckId, card, quantity = 1 } = body

    // Check if deck belongs to user
    const { data: deck, error: deckError } = await supabase
      .from("decks")
      .select("id, user_id")
      .eq("id", deckId)
      .eq("user_id", user.id)
      .single()

    if (deckError || !deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    // Calculate total card count (sum of all quantities)
    const { data: currentCards } = await supabase
      .from("deck_cards")
      .select("quantity")
      .eq("deck_id", deckId)

    const currentTotal = currentCards?.reduce((sum, c) => sum + (c.quantity || 1), 0) || 0

    if (currentTotal + quantity > 99) {
      return NextResponse.json(
        { error: `Cannot add ${quantity} card(s). Deck would exceed 99 cards (currently ${currentTotal}/99)` },
        { status: 400 }
      )
    }

    // First, upsert the full card data to the cards table
    const { error: cardError } = await supabase.from("cards").upsert(
      {
        id: card.id,
        name: card.name,
        oracle_text: card.text || card.oracle_text,
        flavor_text: card.flavor || card.flavor_text,
        type_line: card.type || card.type_line,
        mana_cost: card.manaCost || card.mana_cost,
        cmc: card.cmc,
        colors: card.colors || [],
        color_identity: card.colorIdentity || card.color_identity || [],
        keywords: card.keywords || [],
        power: card.power,
        toughness: card.toughness,
        rarity: card.rarity,
        source: card.source || "mtg",
        image_url: card.imageUrl || card.image_uris?.normal || card.image_uris?.large,
        set_code: card.set,
        set_name: card.setName || card.set_name,
        rulings: card.rulings || [],
        legalities: card.legalities || {},
      },
      {
        onConflict: "id",
        ignoreDuplicates: false,
      },
    )

    if (cardError) {
      console.error("Error upserting card:", cardError)
      // Continue even if card upsert fails - we can still add to deck_cards
    }

    // Check if card already exists in deck
    const { data: existingCard } = await supabase
      .from("deck_cards")
      .select("*")
      .eq("deck_id", deckId)
      .eq("card_id", card.id)
      .single()

    let data

    if (existingCard) {
      // Update quantity of existing card
      const newQuantity = (existingCard.quantity || 1) + quantity

      // Check MTG rules: max 4 copies of non-basic lands
      const isBasicLand = card.type?.toLowerCase().includes("basic land") ||
                         card.type_line?.toLowerCase().includes("basic land")

      if (!isBasicLand && newQuantity > 4) {
        return NextResponse.json(
          { error: `Cannot add ${quantity} more. Maximum 4 copies allowed (currently ${existingCard.quantity})` },
          { status: 400 }
        )
      }

      const { data: updated, error } = await supabase
        .from("deck_cards")
        .update({ quantity: newQuantity })
        .eq("id", existingCard.id)
        .select()
        .single()

      if (error) throw error
      data = updated
    } else {
      // Insert new card
      const { data: inserted, error } = await supabase
        .from("deck_cards")
        .insert({
          deck_id: deckId,
          card_id: card.id,
          card_name: card.name,
          card_image_url: card.imageUrl || card.image_uris?.normal || card.image_uris?.large,
          mana_cost: card.manaCost || card.mana_cost,
          type_line: card.type || card.type_line,
          source: card.source || "mtg",
          quantity: quantity,
        })
        .select()
        .single()

      if (error) throw error
      data = inserted
    }

    return NextResponse.json({ card: data })
  } catch (error) {
    console.error("Error adding card:", error)
    return NextResponse.json({ error: "Failed to add card to deck" }, { status: 500 })
  }
}
