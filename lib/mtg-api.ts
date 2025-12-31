// Search cards via API route (handles MTG API + Scryfall fallback)
export async function searchCards(searchTerm: string, isCommander = false): Promise<any[]> {
  try {
    const url = `/api/search-cards?q=${encodeURIComponent(searchTerm)}&commander=${isCommander}`
    console.log("[v0] Client: Calling search API:", url)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error("Search failed")
    }

    const data = await response.json()
    console.log("[v0] Client: Received", data.cards?.length || 0, "cards")
    return data.cards || []
  } catch (error) {
    console.error("[v0] Client: Error searching cards:", error)
    throw error
  }
}
