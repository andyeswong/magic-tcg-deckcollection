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
    const { name, commander } = body

    // Support both old and new formats
    const commanderId = commander?.id || body.commanderCardId
    const commanderName = commander?.name || body.commanderName
    const commanderImageUrl = commander?.imageUrl || commander?.image_uris?.normal || body.commanderImageUrl
    const commanderSource = commander?.source || body.commanderSource || "mtg"

    // If we have a full commander object, save it to the cards table
    if (commander) {
      const { error: cardError } = await supabase.from("cards").upsert(
        {
          id: commander.id,
          name: commander.name,
          oracle_text: commander.text || commander.oracle_text,
          flavor_text: commander.flavor || commander.flavor_text,
          type_line: commander.type || commander.type_line,
          mana_cost: commander.manaCost || commander.mana_cost,
          cmc: commander.cmc,
          colors: commander.colors || [],
          color_identity: commander.colorIdentity || commander.color_identity || [],
          keywords: commander.keywords || [],
          power: commander.power,
          toughness: commander.toughness,
          rarity: commander.rarity,
          source: commanderSource,
          image_url: commanderImageUrl,
          set_code: commander.set,
          set_name: commander.setName || commander.set_name,
          rulings: commander.rulings || [],
          legalities: commander.legalities || {},
        },
        {
          onConflict: "id",
          ignoreDuplicates: false,
        },
      )

      if (cardError) {
        console.error("Error upserting commander card:", cardError)
        // Continue even if card upsert fails
      }
    }

    const { data, error } = await supabase
      .from("decks")
      .insert({
        user_id: user.id,
        name,
        commander_card_id: commanderId,
        commander_name: commanderName,
        commander_image_url: commanderImageUrl,
        commander_source: commanderSource,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ deckId: data.id })
  } catch (error) {
    console.error("Error creating deck:", error)
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
  }
}
