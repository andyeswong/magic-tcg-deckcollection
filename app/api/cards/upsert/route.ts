import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

interface CardData {
  id: string
  name: string
  oracle_text?: string
  flavor_text?: string
  type_line?: string
  mana_cost?: string
  cmc?: number
  colors?: string[]
  color_identity?: string[]
  keywords?: string[]
  power?: string
  toughness?: string
  rarity?: string
  source: string
  image_url?: string
  set_code?: string
  set_name?: string
  rulings?: any[]
  legalities?: Record<string, string>
}

// Normalize card data from different API sources
function normalizeCardData(card: any): CardData {
  // Handle both MTG API and Scryfall API formats
  const isScryfallSource = card.source === "scryfall"

  return {
    id: card.id,
    name: card.name,
    oracle_text: isScryfallSource ? card.text : card.oracle_text,
    flavor_text: isScryfallSource ? card.flavor : card.flavor_text,
    type_line: isScryfallSource ? card.type : card.type_line,
    mana_cost: isScryfallSource ? card.manaCost : card.mana_cost,
    cmc: card.cmc,
    colors: card.colors || [],
    color_identity: isScryfallSource ? card.colorIdentity : card.color_identity || [],
    keywords: card.keywords || [],
    power: card.power,
    toughness: card.toughness,
    rarity: card.rarity,
    source: card.source,
    image_url: isScryfallSource ? card.imageUrl : card.image_uris?.normal || card.image_uris?.large,
    set_code: isScryfallSource ? card.set : card.set,
    set_name: isScryfallSource ? card.setName : card.set_name,
    rulings: card.rulings || [],
    legalities: card.legalities || {},
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { cards } = await request.json()

    if (!cards || !Array.isArray(cards)) {
      return NextResponse.json({ error: "Cards array required" }, { status: 400 })
    }

    console.log("[UPSERT] Received cards:", JSON.stringify(cards, null, 2))

    // Normalize all cards
    const normalizedCards = cards.map(normalizeCardData)

    console.log("[UPSERT] Normalized cards:", JSON.stringify(normalizedCards, null, 2))

    // Upsert cards into the database
    const { data, error } = await supabase.from("cards").upsert(normalizedCards, {
      onConflict: "id",
      ignoreDuplicates: false, // Update existing records
    })

    if (error) {
      console.error("[v0] Server: Error upserting cards:", error)
      return NextResponse.json({ error: "Failed to save cards" }, { status: 500 })
    }

    console.log("[v0] Server: Successfully upserted", normalizedCards.length, "cards")
    return NextResponse.json({ success: true, count: normalizedCards.length })
  } catch (error) {
    console.error("[v0] Server: Error in card upsert endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
