import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { quantity } = body

    if (!quantity || quantity < 1) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
    }

    // Get the card to verify ownership and check constraints
    const { data: deckCard } = await supabase
      .from("deck_cards")
      .select("*, decks!inner(user_id)")
      .eq("id", id)
      .single()

    if (!deckCard) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    // Verify the deck belongs to the user
    if (deckCard.decks.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all cards in the deck to calculate total
    const { data: allCards } = await supabase.from("deck_cards").select("quantity").eq("deck_id", deckCard.deck_id)

    // Calculate total excluding this card, then add new quantity
    const otherCardsTotal = allCards?.filter((c) => c.id !== id).reduce((sum, c) => sum + (c.quantity || 1), 0) || 0

    if (otherCardsTotal + quantity > 99) {
      return NextResponse.json(
        { error: `Cannot set quantity to ${quantity}. Deck would exceed 99 cards.` },
        { status: 400 },
      )
    }

    // Check MTG rules: max 4 copies for non-basic lands
    const isBasicLand = deckCard.type_line?.toLowerCase().includes("basic land")
    if (!isBasicLand && quantity > 4) {
      return NextResponse.json({ error: "Maximum 4 copies allowed for non-basic lands" }, { status: 400 })
    }

    // Update the quantity
    const { error } = await supabase.from("deck_cards").update({ quantity }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true, quantity })
  } catch (error) {
    console.error("Error updating card quantity:", error)
    return NextResponse.json({ error: "Failed to update quantity" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Verify the card belongs to a deck owned by the user
    const { data: card } = await supabase.from("deck_cards").select("deck_id, decks(user_id)").eq("id", id).single()

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    const { error } = await supabase.from("deck_cards").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing card:", error)
    return NextResponse.json({ error: "Failed to remove card" }, { status: 500 })
  }
}
