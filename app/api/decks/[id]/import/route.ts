import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface ParsedCard {
  quantity: number
  name: string
}

function parseDeckList(deckListText: string): ParsedCard[] {
  const lines = deckListText.split("\n")
  const parsedCards: ParsedCard[] = []

  for (const line of lines) {
    // Skip empty lines and comments
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith("#") || trimmedLine.startsWith("//")) {
      continue
    }

    // Skip section headers (lines starting with ##)
    if (trimmedLine.startsWith("##")) {
      continue
    }

    // Parse line format: "4 Card Name" or "4x Card Name"
    const match = trimmedLine.match(/^(\d+)x?\s+(.+)$/i)
    if (match) {
      const quantity = parseInt(match[1], 10)
      const name = match[2].trim()
      parsedCards.push({ quantity, name })
    }
  }

  return parsedCards
}

async function searchCardByName(cardName: string): Promise<any> {
  try {
    // Use Scryfall API to search for exact card name
    const scryfallUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
    const response = await fetch(scryfallUrl)

    if (!response.ok) {
      console.warn(`Card not found: ${cardName}`)
      return null
    }

    const scryfallCard = await response.json()

    // Convert to our format
    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      manaCost: scryfallCard.mana_cost || "",
      cmc: scryfallCard.cmc || 0,
      colors: scryfallCard.colors || [],
      colorIdentity: scryfallCard.color_identity || [],
      type: scryfallCard.type_line || "",
      types: scryfallCard.type_line?.split("—")[0]?.trim().split(" ") || [],
      rarity: scryfallCard.rarity || "",
      set: scryfallCard.set || "",
      setName: scryfallCard.set_name || "",
      text: scryfallCard.oracle_text || "",
      flavor: scryfallCard.flavor_text || "",
      power: scryfallCard.power || null,
      toughness: scryfallCard.toughness || null,
      imageUrl: scryfallCard.image_uris?.normal || scryfallCard.image_uris?.large || "",
      keywords: scryfallCard.keywords || [],
      source: "scryfall",
    }
  } catch (error) {
    console.error(`Error searching for card ${cardName}:`, error)
    return null
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Verify deck ownership
    const { data: deck } = await supabase.from("decks").select("*").eq("id", id).eq("user_id", user.id).single()

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    // Get the deck list text from request body
    const body = await request.json()
    const { deckListText, clearExisting = false } = body

    if (!deckListText) {
      return NextResponse.json({ error: "Deck list text is required" }, { status: 400 })
    }

    // Parse the deck list
    const parsedCards = parseDeckList(deckListText)

    if (parsedCards.length === 0) {
      return NextResponse.json({ error: "No valid cards found in deck list" }, { status: 400 })
    }

    // Clear existing cards if requested
    if (clearExisting) {
      await supabase.from("deck_cards").delete().eq("deck_id", id)
    }

    // Get current cards to check total
    const { data: currentCards } = await supabase.from("deck_cards").select("quantity").eq("deck_id", id)

    const currentTotal = currentCards?.reduce((sum, c) => sum + (c.quantity || 1), 0) || 0
    const newCardsTotal = parsedCards.reduce((sum, c) => sum + c.quantity, 0)

    if (currentTotal + newCardsTotal > 99) {
      return NextResponse.json(
        {
          error: `Cannot import ${newCardsTotal} cards. Current deck has ${currentTotal} cards. Maximum is 99.`,
        },
        { status: 400 },
      )
    }

    // Search for each card and add to deck
    const results = {
      successful: 0,
      failed: [] as string[],
      total: parsedCards.length,
    }

    for (const parsedCard of parsedCards) {
      const cardData = await searchCardByName(parsedCard.name)

      if (!cardData) {
        results.failed.push(parsedCard.name)
        continue
      }

      try {
        // Upsert card data to cards table
        await supabase.from("cards").upsert(
          {
            id: cardData.id,
            name: cardData.name,
            oracle_text: cardData.text,
            flavor_text: cardData.flavor,
            type_line: cardData.type,
            mana_cost: cardData.manaCost,
            cmc: cardData.cmc,
            colors: cardData.colors,
            color_identity: cardData.colorIdentity,
            keywords: cardData.keywords,
            power: cardData.power,
            toughness: cardData.toughness,
            rarity: cardData.rarity,
            source: cardData.source,
            image_url: cardData.imageUrl,
            set_code: cardData.set,
            set_name: cardData.setName,
          },
          { onConflict: "id" },
        )

        // Check if card already exists in deck
        const { data: existingCard } = await supabase
          .from("deck_cards")
          .select("*")
          .eq("deck_id", id)
          .eq("card_id", cardData.id)
          .maybeSingle()

        if (existingCard) {
          // Update quantity
          const newQuantity = (existingCard.quantity || 1) + parsedCard.quantity

          // Check MTG rules
          const isBasicLand = cardData.type?.toLowerCase().includes("basic land")
          if (!isBasicLand && newQuantity > 4) {
            results.failed.push(`${parsedCard.name} (would exceed 4 copies)`)
            continue
          }

          await supabase.from("deck_cards").update({ quantity: newQuantity }).eq("id", existingCard.id)
        } else {
          // Check MTG rules before adding
          const isBasicLand = cardData.type?.toLowerCase().includes("basic land")
          if (!isBasicLand && parsedCard.quantity > 4) {
            results.failed.push(`${parsedCard.name} (exceeds 4 copy limit)`)
            continue
          }

          // Insert new card
          await supabase.from("deck_cards").insert({
            deck_id: id,
            card_id: cardData.id,
            card_name: cardData.name,
            mana_cost: cardData.manaCost,
            type_line: cardData.type,
            card_image_url: cardData.imageUrl,
            source: cardData.source,
            quantity: parsedCard.quantity,
          })
        }

        results.successful++
      } catch (error) {
        console.error(`Error adding card ${parsedCard.name}:`, error)
        results.failed.push(parsedCard.name)
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Successfully imported ${results.successful} out of ${results.total} cards`,
    })
  } catch (error) {
    console.error("Error importing deck:", error)
    return NextResponse.json({ error: "Failed to import deck" }, { status: 500 })
  }
}
