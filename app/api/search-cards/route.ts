import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

interface ScryfallCard {
  id: string
  name: string
  mana_cost?: string
  cmc?: number
  type_line?: string
  oracle_text?: string
  colors?: string[]
  color_identity?: string[]
  power?: string
  toughness?: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
    png?: string
  }
  rarity?: string
  legalities?: Record<string, string>
}

interface ScryfallResponse {
  object: string
  total_cards: number
  has_more: boolean
  data: ScryfallCard[]
}

// Convert Scryfall card to MTGCard format
function convertScryfallToMTG(scryfallCard: ScryfallCard): any {
  return {
    id: scryfallCard.id,
    name: scryfallCard.name,
    manaCost: scryfallCard.mana_cost,
    cmc: scryfallCard.cmc,
    colors: scryfallCard.colors,
    colorIdentity: scryfallCard.color_identity,
    type: scryfallCard.type_line || "",
    rarity: scryfallCard.rarity,
    text: scryfallCard.oracle_text,
    power: scryfallCard.power,
    toughness: scryfallCard.toughness,
    imageUrl: scryfallCard.image_uris?.normal || scryfallCard.image_uris?.large,
    source: "scryfall" as const,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get("q")
    const isCommander = searchParams.get("commander") === "true"

    if (!searchTerm) {
      return NextResponse.json({ error: "Search term required" }, { status: 400 })
    }

    // Try MTG API first
    const mtgUrl = isCommander
      ? `https://api.magicthegathering.io/v1/cards?name=${encodeURIComponent(
          searchTerm,
        )}&supertypes=legendary&types=creature&pageSize=20`
      : `https://api.magicthegathering.io/v1/cards?name=${encodeURIComponent(searchTerm)}&pageSize=30`

    console.log("[v0] Server: Searching MTG API:", mtgUrl)
    const mtgResponse = await fetch(mtgUrl)

    if (mtgResponse.ok) {
      const mtgData = await mtgResponse.json()
      if (mtgData.cards && mtgData.cards.length > 0) {
        console.log("[v0] Server: Found", mtgData.cards.length, "cards from MTG API")
        const cards = mtgData.cards.map((card: any) => ({ ...card, source: "mtg" }))
        return NextResponse.json({ cards })
      }
    }

    // Fallback to Scryfall API
    console.log("[v0] Server: No results from MTG API, trying Scryfall fallback...")
    const scryfallQuery = isCommander
      ? `${searchTerm} type:legendary type:creature`
      : searchTerm

    const scryfallUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryfallQuery)}`

    console.log("[v0] Server: Searching Scryfall API:", scryfallUrl)
    const scryfallResponse = await fetch(scryfallUrl)

    if (!scryfallResponse.ok) {
      console.error("[v0] Server: Scryfall API error:", scryfallResponse.status)
      return NextResponse.json({ cards: [] })
    }

    const scryfallData: ScryfallResponse = await scryfallResponse.json()

    if (!scryfallData.data || scryfallData.data.length === 0) {
      return NextResponse.json({ cards: [] })
    }

    console.log("[v0] Server: Found", scryfallData.data.length, "cards from Scryfall API")
    const cards = scryfallData.data.map(convertScryfallToMTG)
    return NextResponse.json({ cards })
  } catch (error) {
    console.error("[v0] Server: Error searching cards:", error)
    return NextResponse.json({ error: "Failed to search cards" }, { status: 500 })
  }
}
