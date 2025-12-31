import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus } from "lucide-react"
import { DeleteDeckButton } from "@/components/delete-deck-button"
import type { Deck } from "@/lib/types"

export default async function DecksPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: decks } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Decks</h1>
            <p className="text-muted-foreground">Manage your Commander deck collection</p>
          </div>
          <Button asChild size="lg">
            <Link href="/builder">
              <Plus className="mr-2 h-5 w-5" />
              New Deck
            </Link>
          </Button>
        </div>

        {!decks || decks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <p className="text-xl text-muted-foreground">You haven&apos;t created any decks yet</p>
              <Button asChild>
                <Link href="/builder">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Deck
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map((deck: Deck) => (
              <Card key={deck.id} className="overflow-hidden hover:border-primary transition-colors">
                <Link href={`/decks/${deck.id}`}>
                  {deck.commander_image_url && (
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <img
                        src={deck.commander_image_url || "/placeholder.svg"}
                        alt={deck.commander_name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{deck.name}</CardTitle>
                    <CardDescription>Commander: {deck.commander_name}</CardDescription>
                  </CardHeader>
                </Link>
                <CardContent className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(deck.created_at).toLocaleDateString()}
                  </p>
                  <DeleteDeckButton deckId={deck.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
