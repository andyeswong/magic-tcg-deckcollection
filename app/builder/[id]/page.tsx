import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { DeckBuilder } from "@/components/deck-builder"

export default async function AddCardsPage({
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

  const { data: deckCards } = await supabase
    .from("deck_cards")
    .select("*")
    .eq("deck_id", id)
    .order("created_at", { ascending: false })

  return <DeckBuilder deckId={id} initialDeck={deck} initialCards={deckCards || []} />
}
