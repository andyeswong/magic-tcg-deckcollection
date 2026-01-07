/**
 * Generic spell effect parser
 * Identifies spell effects from oracle text patterns
 */

export interface SpellEffect {
  type:
    | "search_library"
    | "destroy_creatures"
    | "exile_permanents"
    | "add_counters"
    | "draw_cards"
    | "modal"
    | "sacrifice"
    | "return_from_graveyard"
    | "unknown"

  targets?: {
    count?: number // "up to three target creatures"
    restriction?: string // "with power 4 or greater"
    type?: string[] // ["creature", "enchantment"]
  }

  search?: {
    zone: "library" | "graveyard"
    cardType?: string[] // ["Forest", "Plains", "Island", "Swamp", "Mountain"]
    destination: "battlefield" | "hand" | "graveyard" | "exile"
    tapped?: boolean
  }

  destroy?: {
    all?: boolean
    target?: string // "creature", "enchantment"
    restriction?: string // "with no counters", "with power 4 or greater"
  }

  exile?: {
    all?: boolean
    target?: string[] // ["artifacts", "creatures", "enchantments", "graveyards"]
  }

  counters?: {
    type: string // "shield", "+1/+1", "vow"
    count: number
    targetCount?: number
    targetType?: string
    targetPlayer?: "self" | "target" | "each"
  }

  modal?: {
    modes: Array<{
      description: string
      effect: SpellEffect
    }>
    chooseCount: "one" | "one or more" | "all"
    escalate?: string // escalate cost
  }

  sacrifice?: {
    count: number
    type?: string
    controller: "self" | "each player"
  }

  returnFromGraveyard?: {
    count: number
    restriction?: string // "permanent", "creature"
    destination: "hand" | "battlefield"
  }
}

/**
 * Parse spell effects from oracle text
 */
export function parseSpellEffect(oracleText: string, cardName: string): SpellEffect[] {
  const text = oracleText.toLowerCase()
  const effects: SpellEffect[] = []

  // Check for modal spells first
  if (text.includes("choose one or more") || text.includes("choose one")) {
    const modalEffect = parseModalSpell(oracleText, cardName)
    if (modalEffect) {
      effects.push(modalEffect)
      return effects // Modal spells are their own thing
    }
  }

  // Search library effects
  if (text.includes("search your library")) {
    const searchEffect = parseLibrarySearch(text)
    if (searchEffect) effects.push(searchEffect)
  }

  // Destroy effects
  if (text.includes("destroy")) {
    const destroyEffect = parseDestroy(text)
    if (destroyEffect) effects.push(destroyEffect)
  }

  // Exile effects
  if (text.includes("exile")) {
    const exileEffect = parseExile(text)
    if (exileEffect) effects.push(exileEffect)
  }

  // Counter effects
  if (text.includes("counter") && !text.includes("counter target")) {
    const counterEffect = parseCounters(text)
    if (counterEffect) effects.push(counterEffect)
  }

  // Sacrifice effects
  if (text.includes("sacrifice")) {
    const sacrificeEffect = parseSacrifice(text)
    if (sacrificeEffect) effects.push(sacrificeEffect)
  }

  // Return from graveyard
  if (text.includes("from your graveyard to your hand") || text.includes("from your graveyard to the battlefield")) {
    const returnEffect = parseReturnFromGraveyard(text)
    if (returnEffect) effects.push(returnEffect)
  }

  if (effects.length === 0) {
    effects.push({ type: "unknown" })
  }

  return effects
}

function parseModalSpell(oracleText: string, cardName: string): SpellEffect | null {
  const lines = oracleText.split("\n")

  let chooseCount: "one" | "one or more" | "all" = "one"
  if (oracleText.toLowerCase().includes("choose one or more")) {
    chooseCount = "one or more"
  } else if (oracleText.toLowerCase().includes("choose all")) {
    chooseCount = "all"
  }

  let escalateCost: string | undefined
  if (oracleText.toLowerCase().includes("escalate")) {
    const escalateMatch = oracleText.match(/escalate[—–-]\s*(.+?)(?:\.|$)/i)
    if (escalateMatch) {
      escalateCost = escalateMatch[1].trim()
    }
  }

  const modes: Array<{ description: string; effect: SpellEffect }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith("•")) {
      const modeText = line.substring(1).trim()
      // Recursively parse each mode
      const modeEffects = parseSpellEffect(modeText, `${cardName} mode`)

      modes.push({
        description: modeText,
        effect: modeEffects[0] || { type: "unknown" }
      })
    }
  }

  if (modes.length === 0) return null

  return {
    type: "modal",
    modal: {
      modes,
      chooseCount,
      escalate: escalateCost
    }
  }
}

function parseLibrarySearch(text: string): SpellEffect | null {
  const effect: SpellEffect = {
    type: "search_library",
    search: {
      zone: "library",
      destination: "hand"
    }
  }

  // Determine card types to search for
  const cardTypes: string[] = []

  if (text.includes("forest")) cardTypes.push("Forest")
  if (text.includes("plains")) cardTypes.push("Plains")
  if (text.includes("island")) cardTypes.push("Island")
  if (text.includes("swamp")) cardTypes.push("Swamp")
  if (text.includes("mountain")) cardTypes.push("Mountain")
  if (text.includes("basic land")) cardTypes.push("basic land")
  if (text.includes("land card")) cardTypes.push("land")
  if (text.includes("creature card")) cardTypes.push("creature")
  if (text.includes("permanent card")) cardTypes.push("permanent")

  if (cardTypes.length > 0) {
    effect.search!.cardType = cardTypes
  }

  // Determine destination
  if (text.includes("onto the battlefield")) {
    effect.search!.destination = "battlefield"
  } else if (text.includes("to your hand") || text.includes("into your hand")) {
    effect.search!.destination = "hand"
  }

  // Check if enters tapped
  if (text.includes("tapped") && text.includes("onto the battlefield")) {
    effect.search!.tapped = true
  }

  return effect
}

function parseDestroy(text: string): SpellEffect | null {
  const effect: SpellEffect = {
    type: "destroy_creatures",
    destroy: {}
  }

  if (text.includes("destroy all")) {
    effect.destroy!.all = true
  }

  // Target type
  if (text.includes("creature")) effect.destroy!.target = "creature"
  if (text.includes("enchantment")) effect.destroy!.target = "enchantment"
  if (text.includes("artifact")) effect.destroy!.target = "artifact"

  // Restrictions
  if (text.includes("with no counters")) {
    effect.destroy!.restriction = "with no counters"
  } else if (text.includes("with power 4 or greater")) {
    effect.destroy!.restriction = "with power 4 or greater"
  } else if (text.includes("with power")) {
    const match = text.match(/with power (\d+) or (greater|less)/i)
    if (match) {
      effect.destroy!.restriction = `with power ${match[1]} or ${match[2]}`
    }
  }

  return effect
}

function parseExile(text: string): SpellEffect | null {
  const effect: SpellEffect = {
    type: "exile_permanents",
    exile: {
      target: []
    }
  }

  if (text.includes("exile all")) {
    effect.exile!.all = true

    // Find what to exile
    if (text.includes("artifacts")) effect.exile!.target!.push("artifacts")
    if (text.includes("creatures")) effect.exile!.target!.push("creatures")
    if (text.includes("enchantments")) effect.exile!.target!.push("enchantments")
    if (text.includes("graveyards")) effect.exile!.target!.push("graveyards")
  }

  return effect
}

function parseCounters(text: string): SpellEffect | null {
  const effect: SpellEffect = {
    type: "add_counters",
    counters: {
      type: "+1/+1",
      count: 1
    }
  }

  // Determine counter type
  if (text.includes("shield counter")) {
    effect.counters!.type = "shield"
  } else if (text.includes("vow counter")) {
    effect.counters!.type = "vow"
  } else if (text.includes("+1/+1 counter")) {
    effect.counters!.type = "+1/+1"
  } else if (text.includes("loyalty counter")) {
    effect.counters!.type = "loyalty"
  }

  // Determine count (look for "a" or numbers)
  const countMatch = text.match(/(\d+|\ba\b)\s+(?:shield|vow|\+1\/\+1|loyalty)\s+counter/i)
  if (countMatch) {
    effect.counters!.count = countMatch[1] === "a" ? 1 : parseInt(countMatch[1])
  }

  // Target count
  if (text.includes("up to three")) {
    effect.counters!.targetCount = 3
  } else if (text.includes("up to two")) {
    effect.counters!.targetCount = 2
  } else if (text.includes("target creature")) {
    effect.counters!.targetCount = 1
  } else if (text.includes("each creature")) {
    effect.counters!.targetPlayer = "each"
  }

  // Target type
  if (text.includes("target creature")) {
    effect.counters!.targetType = "creature"
  } else if (text.includes("each creature")) {
    effect.counters!.targetType = "creature"
  }

  return effect
}

function parseSacrifice(text: string): SpellEffect | null {
  const effect: SpellEffect = {
    type: "sacrifice",
    sacrifice: {
      count: 1,
      controller: "self"
    }
  }

  if (text.includes("each player")) {
    effect.sacrifice!.controller = "each player"
  }

  if (text.includes("sacrifice a creature")) {
    effect.sacrifice!.type = "creature"
    effect.sacrifice!.count = 1
  }

  // "sacrifices the rest" pattern from Promise of Loyalty
  if (text.includes("sacrifices the rest")) {
    effect.sacrifice!.count = -1 // Special: all except one
  }

  return effect
}

function parseReturnFromGraveyard(text: string): SpellEffect | null {
  const effect: SpellEffect = {
    type: "return_from_graveyard",
    returnFromGraveyard: {
      count: 1,
      destination: "hand"
    }
  }

  // Count
  if (text.includes("one or two")) {
    effect.returnFromGraveyard!.count = 2 // Max
  } else if (text.includes("up to two")) {
    effect.returnFromGraveyard!.count = 2
  }

  // Type restriction
  if (text.includes("permanent card")) {
    effect.returnFromGraveyard!.restriction = "permanent"
  } else if (text.includes("creature card")) {
    effect.returnFromGraveyard!.restriction = "creature"
  }

  // Destination
  if (text.includes("to the battlefield")) {
    effect.returnFromGraveyard!.destination = "battlefield"
  } else {
    effect.returnFromGraveyard!.destination = "hand"
  }

  return effect
}
