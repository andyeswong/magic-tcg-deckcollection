import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/cards/[id]
 * Fetches comprehensive card details including abilities, rulings, and metadata
 * 
 * @param id - Card ID (Scryfall ID or other unique identifier)
 * @returns Card details with abilities or error response
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  try {
    // Fetch card details from the cards table
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", id)
      .single()

    if (cardError) {
      if (cardError.code === "PGRST116") {
        return NextResponse.json({ error: "Card not found" }, { status: 404 })
      }
      throw cardError
    }

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    // Fetch abilities from the card_abilities table
    const { data: abilities, error: abilitiesError } = await supabase
      .from("card_abilities")
      .select("*")
      .eq("card_id", id)
      .maybeSingle()

    // Don't throw error if abilities not found - many cards may not have abilities data yet
    if (abilitiesError && abilitiesError.code !== "PGRST116") {
      console.error("[API] Error fetching abilities:", abilitiesError)
    }

    // Construct comprehensive response
    const response = {
      // Basic card information
      id: card.id,
      name: card.name,
      oracleText: card.oracle_text,
      flavorText: card.flavor_text,
      typeLine: card.type_line,
      manaCost: card.mana_cost,
      cmc: card.cmc,
      colors: card.colors,
      colorIdentity: card.color_identity,
      keywords: card.keywords,
      power: card.power,
      toughness: card.toughness,
      rarity: card.rarity,
      imageUrl: card.image_url,

      // Set information
      setCode: card.set_code,
      setName: card.set_name,

      // Rules and legalities
      rulings: card.rulings,
      legalities: card.legalities,

      // Metadata
      source: card.source,
      createdAt: card.created_at,
      updatedAt: card.updated_at,

      // Structured abilities (JSON format)
      abilities: abilities
        ? {
            schemaVersion: abilities.schema_version,
            data: abilities.abilities,
            flags: {
              hasStaticAbilities: abilities.has_static_abilities,
              hasTriggeredAbilities: abilities.has_triggered_abilities,
              hasActivatedAbilities: abilities.has_activated_abilities,
              hasReplacementEffects: abilities.has_replacement_effects,
              hasKeywords: abilities.has_keywords,
            },
            metadata: {
              parsingConfidence: abilities.parsing_confidence,
              parsingNotes: abilities.parsing_notes,
              manuallyVerified: abilities.manually_verified,
              manuallyEdited: abilities.manually_edited,
            },
            createdAt: abilities.created_at,
            updatedAt: abilities.updated_at,
          }
        : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API] Error fetching card:", error)
    return NextResponse.json({ error: "Failed to fetch card details" }, { status: 500 })
  }
}
