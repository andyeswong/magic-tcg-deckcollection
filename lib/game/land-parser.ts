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

  // Parse oracle text for mana abilities with choices (contains "or")
  // Look for patterns like "{T}: Add {G} or {W}"
  // Split by lines/sentences to handle multiple abilities
  const lines = oracleText?.split(/[.\n]/) || []

  for (const line of lines) {
    // Only look at lines with "or" in them (choice abilities)
    if (line.includes(" or ") && line.includes("{T}") && line.includes("Add")) {
      // Extract all mana symbols from this line
      const symbols = line.match(/\{([WUBRGC])\}/g)
      if (symbols) {
        symbols.forEach((symbol) => {
          const color = symbol.slice(1, -1) as ManaColor
          if (!options.includes(color)) {
            options.push(color)
          }
        })
      }
    }
  }

  // If no choice abilities found, look for single fixed ability
  if (options.length === 0) {
    const singlePattern = /\{T\}:\s*Add\s+\{([WUBRGC])\}/i
    const match = oracleText?.match(singlePattern)
    if (match) {
      options.push(match[1] as ManaColor)
    }
  }

  // If still no mana found, default to colorless
  if (options.length === 0) {
    options.push("C")
  }

  return options
}

// Check if a land produces multiple mana types (requires choice)
export function isDualLand(oracleText: string, name: string): boolean {
  // Basic lands are not dual lands
  if (
    name.includes("Plains") ||
    name.includes("Island") ||
    name.includes("Swamp") ||
    name.includes("Mountain") ||
    name.includes("Forest")
  ) {
    return false
  }

  // Check if oracle text has a choice ability (contains "or")
  const lines = oracleText?.split(/[.\n]/) || []
  for (const line of lines) {
    if (line.includes(" or ") && line.includes("{T}") && line.includes("Add")) {
      // Count how many mana symbols are in the choice
      const symbols = line.match(/\{([WUBRGC])\}/g)
      if (symbols && symbols.length > 1) {
        return true
      }
    }
  }

  return false
}
