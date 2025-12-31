import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get deck info
    const { data: deck } = await supabase.from("decks").select("*").eq("id", id).eq("user_id", user.id).single()

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    // Get all cards in the deck
    const { data: deckCards } = await supabase
      .from("deck_cards")
      .select("card_name, quantity, type_line")
      .eq("deck_id", id)
      .order("card_name")

    if (!deckCards) {
      return NextResponse.json({ error: "Failed to fetch deck cards" }, { status: 500 })
    }

    // Group cards by type for better organization
    const creatures = deckCards.filter((c) => c.type_line?.toLowerCase().includes("creature"))
    const instants = deckCards.filter((c) => c.type_line?.toLowerCase().includes("instant"))
    const sorceries = deckCards.filter((c) => c.type_line?.toLowerCase().includes("sorcery"))
    const enchantments = deckCards.filter(
      (c) => c.type_line?.toLowerCase().includes("enchantment") && !c.type_line?.toLowerCase().includes("creature"),
    )
    const artifacts = deckCards.filter(
      (c) => c.type_line?.toLowerCase().includes("artifact") && !c.type_line?.toLowerCase().includes("creature"),
    )
    const planeswalkers = deckCards.filter((c) => c.type_line?.toLowerCase().includes("planeswalker"))
    const lands = deckCards.filter((c) => c.type_line?.toLowerCase().includes("land"))
    const other = deckCards.filter(
      (c) =>
        !creatures.includes(c) &&
        !instants.includes(c) &&
        !sorceries.includes(c) &&
        !enchantments.includes(c) &&
        !artifacts.includes(c) &&
        !planeswalkers.includes(c) &&
        !lands.includes(c),
    )

    // Build deck list text
    let deckListText = `# ${deck.name}\n`
    deckListText += `# Commander: ${deck.commander_name}\n`
    deckListText += `# Total Cards: ${deckCards.reduce((sum, c) => sum + (c.quantity || 1), 0)}\n\n`

    const addSection = (title: string, cards: typeof deckCards) => {
      if (cards.length > 0) {
        deckListText += `## ${title} (${cards.reduce((sum, c) => sum + (c.quantity || 1), 0)})\n`
        cards.forEach((card) => {
          deckListText += `${card.quantity || 1} ${card.card_name}\n`
        })
        deckListText += "\n"
      }
    }

    addSection("Creatures", creatures)
    addSection("Instants", instants)
    addSection("Sorceries", sorceries)
    addSection("Enchantments", enchantments)
    addSection("Artifacts", artifacts)
    addSection("Planeswalkers", planeswalkers)
    addSection("Lands", lands)
    addSection("Other", other)

    // Return as downloadable text file
    return new NextResponse(deckListText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${deck.name.replace(/[^a-z0-9]/gi, "_")}_deck.txt"`,
      },
    })
  } catch (error) {
    console.error("Error exporting deck:", error)
    return NextResponse.json({ error: "Failed to export deck" }, { status: 500 })
  }
}
