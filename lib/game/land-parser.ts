import type { ManaColor } from "./types"

// Parse oracle text to determine what mana a land can produce
export function parseLandManaOptions(oracleText: string, name: string): ManaColor[] {
  const options: ManaColor[] = []

  // Basic lands
  if (name.includes("Plains")) return ["W"]
  if (name.includes("Island")) return ["U"]
  if (name.includes("Swamp")) return ["B"]
  if (name.includes("Mountain")) return ["R"]
  if (name.includes("Forest")) return ["G"]

  // Parse oracle text for mana abilities
  // Look for patterns like "{T}: Add {G} or {W}" or "{T}: Add {G} or {W} or {U}"
  const manaPattern = /\{T\}:\s*Add\s+([^.]+)/i
  const match = oracleText?.match(manaPattern)

  if (match) {
    const manaText = match[1]

    // Extract all mana symbols like {G}, {W}, {U}, etc.
    const symbols = manaText.match(/\{([WUBRGC])\}/g)
    if (symbols) {
      symbols.forEach((symbol) => {
        const color = symbol.slice(1, -1) as ManaColor
        if (!options.includes(color)) {
          options.push(color)
        }
      })
    }
  }

  // If no mana found, default to colorless
  if (options.length === 0) {
    options.push("C")
  }

  return options
}

// Check if a land produces multiple mana types
export function isDualLand(oracleText: string, name: string): boolean {
  const options = parseLandManaOptions(oracleText, name)
  return options.length > 1
}
