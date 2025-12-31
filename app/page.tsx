import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sparkles, BookOpen, Wand2 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance">
              Build Your <span className="text-primary">Commander</span> Deck
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground text-balance max-w-2xl mx-auto">
              Create and manage your Magic: The Gathering Commander decks with ease. Search thousands of cards and build
              the perfect 100-card deck.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="text-lg px-8">
              <Link href="/auth/sign-up">
                <Sparkles className="mr-2 h-5 w-5" />
                Start Building
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 bg-transparent">
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
            <div className="bg-card p-6 rounded-lg border border-border">
              <Wand2 className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Choose Your Commander</h3>
              <p className="text-muted-foreground">Search for legendary creatures to lead your deck into battle.</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border">
              <BookOpen className="h-10 w-10 text-accent mb-4" />
              <h3 className="text-xl font-semibold mb-2">Build Your Deck</h3>
              <p className="text-muted-foreground">Add exactly 99 cards that match your commander's color identity.</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border">
              <Sparkles className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Manage Collections</h3>
              <p className="text-muted-foreground">Save multiple decks and switch between them effortlessly.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>Built with the Magic: The Gathering API</p>
        </div>
      </footer>
    </div>
  )
}
