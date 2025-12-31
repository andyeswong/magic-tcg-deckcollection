import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CommanderSearch } from "@/components/commander-search"

export default async function BuilderPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create New Deck</h1>
          <p className="text-muted-foreground">Search for a legendary creature to be your commander</p>
        </div>

        <CommanderSearch />
      </div>
    </div>
  )
}
