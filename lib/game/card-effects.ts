import type { GameState, CardInstance, PendingTrigger } from "./types"
import { v4 as uuidv4 } from "uuid"
import { addGameLog } from "./logger"

/**
 * Parse "enters the battlefield with" counter effects from oracle text
 */
export function parseETBCounters(oracleText: string, cardName: string): {
  counterType: "p1p1" | "loyalty" | "charge" | null
  amount: number | "X"
  requiresChoice?: boolean // For cards like Sin that need player choice
} {
  if (!oracleText) return { counterType: null, amount: 0 }

  const text = oracleText.toLowerCase()
  const lowerCardName = cardName.toLowerCase()

  // Pattern: "enters the battlefield with X +1/+1 counters" (replacement effect)
  // Pattern: "enters with two +1/+1 counters" (replacement effect)
  // Pattern: "As [cardname] enters" (replacement effect like Sin, Unending Cataclysm)
  // 
  // NOT: "When [cardname] enters, put counters..." (triggered ability - Phase 2)

  // Only match replacement effects, not triggered abilities
  const hasReplacementEffect = 
    text.includes("enters the battlefield with") || 
    text.includes("enters with") ||
    text.includes(`as ${lowerCardName} enters`) ||
    (text.includes("as") && text.includes("enters") && text.includes(lowerCardName))

  if (hasReplacementEffect) {
    // Check for +1/+1 counters
    if (text.includes("+1/+1 counter")) {
      // Check for X counters
      if (text.includes("x +1/+1 counter") || text.includes("x additional +1/+1 counter")) {
        // Distinguish between X paid as mana (e.g., Walking Ballista) 
        // and X calculated from complex effects (e.g., Sin, Unending Cataclysm)
        const hasCalculatedX = 
          text.includes("where x is") || 
          text.includes("x is equal to") || 
          text.includes("x is the number") ||
          text.includes("x is twice")
        
        const requiresInteraction = 
          text.includes("any number of") || 
          text.includes("choose") || 
          text.includes("target") ||
          text.includes("move all") ||
          text.includes("remove all")
        
        if (hasCalculatedX && requiresInteraction) {
          // Complex ETB like Sin or Spike Cannibal that needs Phase 2 implementation
          console.log(`[ETB] ${cardName} has complex calculated X requiring player interaction (not yet implemented)`)
          return { counterType: "p1p1", amount: 0, requiresChoice: true }
        }
        
        // Simple X like Walking Ballista where X is paid as part of casting cost
        return { counterType: "p1p1", amount: "X" }
      }

      // Check for numeric amounts
      const numberWords: Record<string, number> = {
        a: 1,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      }

      // Try to match written numbers
      for (const [word, num] of Object.entries(numberWords)) {
        if (text.includes(`${word} +1/+1 counter`)) {
          return { counterType: "p1p1", amount: num }
        }
      }

      // Try to match digit numbers
      const digitMatch = text.match(/(\d+)\s*\+1\/\+1\s*counter/)
      if (digitMatch) {
        return { counterType: "p1p1", amount: parseInt(digitMatch[1]) }
      }

      // Default to 1 if just says "a +1/+1 counter"
      if (text.includes("a +1/+1 counter")) {
        return { counterType: "p1p1", amount: 1 }
      }
    }

    // Check for loyalty counters (planeswalkers)
    if (text.includes("loyalty counter")) {
      const digitMatch = text.match(/(\d+)\s*loyalty\s*counter/)
      if (digitMatch) {
        return { counterType: "loyalty", amount: parseInt(digitMatch[1]) }
      }
    }

    // Check for charge counters
    if (text.includes("charge counter")) {
      const digitMatch = text.match(/(\d+)\s*charge\s*counter/)
      if (digitMatch) {
        return { counterType: "charge", amount: parseInt(digitMatch[1]) }
      }
      if (text.includes("a charge counter")) {
        return { counterType: "charge", amount: 1 }
      }
    }
  }

  return { counterType: null, amount: 0 }
}

/**
 * Apply ETB counter effects when a creature enters the battlefield
 * This includes both inherent ETB counters and replacement effects like Tromell
 */
export function applyETBCounters(
  gameState: GameState,
  card: CardInstance,
  xValue: number = 0,
): void {
  const result = parseETBCounters(card.oracleText || "", card.name)
  const { counterType, amount, requiresChoice } = result

  // Check for Tromell bonus (applies to all nontoken creatures)
  const isCreature = card.typeLine.toLowerCase().includes("creature")
  const tromellBonus = isCreature ? getTromellBonus(gameState, card.controllerId, card) : 0

  // If no inherent counters and no Tromell bonus, exit early
  if ((!counterType || amount === 0) && tromellBonus === 0) return

  // Log if this card requires player choice but we're auto-resolving
  if (requiresChoice) {
    console.log(`[ETB] ${card.name} requires player choice - auto-resolving with 0 bonus counters`)
  }

  // Calculate base counters from the card itself
  const baseAmount = amount === "X" ? xValue : (amount || 0)

  // Apply Hardened Scales replacement effect if controller has it
  const hardenedScalesMultiplier = getHardenedScalesMultiplier(gameState, card.controllerId)

  // Calculate total counters: (base + Tromell) * Hardened Scales
  const totalBeforeScale = baseAmount + tromellBonus
  const countersToAdd = totalBeforeScale * hardenedScalesMultiplier

  // Use p1p1 as the counter type if we only have Tromell bonus
  const finalCounterType = counterType || "p1p1"

  if (countersToAdd > 0) {
    console.log(
      `[ETB] ${card.name} enters with ${countersToAdd} ${finalCounterType} counters (base: ${baseAmount}, Tromell: ${tromellBonus}, multiplier: ${hardenedScalesMultiplier})`,
    )

    card.counters[finalCounterType] += countersToAdd
  }

  // Update power/toughness for creatures with +1/+1 counters
  if (finalCounterType === "p1p1" && card.power && card.toughness) {
    const basePower = parseInt(card.power) || 0
    const baseToughness = parseInt(card.toughness) || 0
    // Note: In a real implementation, we'd track base stats separately
    // For now, this is tracked in the counters
  }
}

/**
 * Check if a card enters the battlefield tapped
 */
export function checkEntersTapped(oracleText: string, cardName: string): boolean {
  if (!oracleText) return false

  const text = oracleText.toLowerCase()
  const lowerCardName = cardName.toLowerCase()

  // Pattern: "[cardname] enters the battlefield tapped"
  // Pattern: "enters the battlefield tapped"
  // Pattern: "enters tapped"
  if (
    text.includes("enters the battlefield tapped") ||
    text.includes("enters tapped") ||
    text.includes(`${lowerCardName} enters the battlefield tapped`)
  ) {
    return true
  }

  return false
}

/**
 * Check if controller has Hardened Scales and return multiplier
 */
function getHardenedScalesMultiplier(gameState: GameState, playerId: string): number {
  let multiplier = 1

  // Check all enchantments on battlefield controlled by player
  for (const cardId of gameState.battlefield) {
    const card = gameState.entities[cardId]
    if (
      card.controllerId === playerId &&
      card.name === "Hardened Scales" &&
      card.zone === "BATTLEFIELD"
    ) {
      multiplier += 1
    }
  }

  return multiplier
}

/**
 * Check if controller has Tromell and return bonus counters
 * Tromell: "Each other nontoken creature you control enters with an additional +1/+1 counter on it."
 */
function getTromellBonus(gameState: GameState, playerId: string, enteringCard: CardInstance): number {
  let bonus = 0

  // Check all creatures on battlefield controlled by player
  for (const cardId of gameState.battlefield) {
    const card = gameState.entities[cardId]
    if (
      card.controllerId === playerId &&
      card.name === "Tromell, Seymour's Butler" &&
      card.zone === "BATTLEFIELD"
    ) {
      // Tromell only affects OTHER nontoken creatures
      if (!enteringCard.isToken && card.instanceId !== enteringCard.instanceId) {
        bonus += 1
      }
    }
  }

  return bonus
}

/**
 * Parse triggered abilities from oracle text
 */
export interface TriggeredAbility {
  trigger:
    | "etb" // enters the battlefield
    | "attack" // when attacks
    | "damage" // when deals damage
    | "cast" // when cast spell
    | "dies" // when dies
    | "counter_added" // when counter added
  effect: string
  target?: "self" | "target" | "each" | "other" | "opponent"
  amount?: number
  cardName: string
}

export function parseTriggeredAbilities(oracleText: string, cardName: string): TriggeredAbility[] {
  if (!oracleText) return []

  const abilities: TriggeredAbility[] = []
  const text = oracleText.toLowerCase()

  // ETB triggers - "When [cardname] enters the battlefield..."
  if ((text.includes("when") || text.includes("whenever")) && text.includes("enters")) {
    // "support X" - put a +1/+1 counter on each of up to X target creatures
    if (text.includes("support")) {
      const supportMatch = text.match(/support\s+(\d+|x)/i)
      if (supportMatch) {
        const amount = supportMatch[1].toLowerCase() === 'x' ? 'X' : parseInt(supportMatch[1])
        abilities.push({
          trigger: "etb",
          effect: "support",
          target: "target",
          amount: typeof amount === 'string' ? 999 : amount, // X or numeric - amount is number of TARGETS, not counters per target
          cardName,
        })
      }
    }
    // "put a +1/+1 counter on target creature"
    else if (text.includes("put") && text.includes("+1/+1 counter") && text.includes("target creature")) {
      const amountMatch = text.match(/(\w+)\s+\+1\/\+1\s+counter/)
      const amount = amountMatch ? parseNumberWord(amountMatch[1]) : 1
      
      abilities.push({
        trigger: "etb",
        effect: "add_counter_target",
        target: "target",
        amount,
        cardName,
      })
    }
    // "put a +1/+1 counter on each other creature you control"
    else if (text.includes("put") && text.includes("+1/+1 counter") && text.includes("each") && !text.includes("for each")) {
      abilities.push({
        trigger: "etb",
        effect: "add_counter_each",
        target: "each",
        amount: 1,
        cardName,
      })
    }
    // Bane of Progress: "destroy all artifacts and enchantments. Put a +1/+1 counter on [cardname] for each permanent destroyed"
    else if (text.includes("destroy all artifacts") && text.includes("for each permanent destroyed")) {
      abilities.push({
        trigger: "etb",
        effect: "bane_of_progress",
        target: "self",
        cardName,
      })
    }
    // "scry" (e.g., Temple lands)
    else if (text.includes("scry")) {
      const scryMatch = text.match(/scry (\d+)/)
      const amount = scryMatch ? parseInt(scryMatch[1]) : 1
      abilities.push({
        trigger: "etb",
        effect: "scry",
        target: "self",
        amount,
        cardName,
      })
    }
    // "draw a card"
    else if (text.includes("draw a card") || text.includes("draw") && text.includes("card")) {
      abilities.push({
        trigger: "etb",
        effect: "draw_card",
        target: "self",
        cardName,
      })
    }
    // "choose target creature" or "target creature" (generic targeting)
    else if (text.includes("choose") || text.includes("target")) {
      abilities.push({
        trigger: "etb",
        effect: "complex_target",
        target: "target",
        cardName,
      })
    }
  }

  // Attack triggers - "Whenever [cardname] attacks..."
  if (text.includes("whenever") && text.includes("attacks")) {
    // Proliferate
    if (text.includes("proliferate")) {
      abilities.push({
        trigger: "attack",
        effect: "proliferate",
        target: "self",
        cardName,
      })
    }
    // "put a +1/+1 counter on [cardname]"
    else if (text.includes("put") && text.includes("+1/+1 counter") && !text.includes("target")) {
      abilities.push({
        trigger: "attack",
        effect: "add_counter_self",
        target: "self",
        amount: 1,
        cardName,
      })
    }
  }

  // Damage triggers - "Whenever [cardname] deals combat damage..."
  if (text.includes("whenever") && text.includes("deals combat damage")) {
    // "to a player"
    if (text.includes("to a player") || text.includes("to an opponent")) {
      // Draw cards
      if (text.includes("draw") && text.includes("card")) {
        abilities.push({
          trigger: "damage",
          effect: "draw_card",
          target: "self",
          cardName,
        })
      }
      // Proliferate
      if (text.includes("proliferate")) {
        abilities.push({
          trigger: "damage",
          effect: "proliferate",
          target: "self",
          cardName,
        })
      }
    }
  }

  // Counter added triggers - "Whenever one or more +1/+1 counters are put on [cardname]..."
  if (
    text.includes("whenever") &&
    (text.includes("+1/+1 counter") && (text.includes("put on") || text.includes("is put on")))
  ) {
    // Draw cards (e.g., Fathom Mage)
    if (text.includes("draw") && text.includes("card")) {
      abilities.push({
        trigger: "counter_added",
        effect: "draw_card",
        target: "self",
        cardName,
      })
    }
    // Create tokens (e.g., Chasm Skulker)
    if (text.includes("create") || text.includes("put") && text.includes("token")) {
      abilities.push({
        trigger: "counter_added",
        effect: "create_token",
        target: "self",
        cardName,
      })
    }
  }

  // Dies triggers - "When [cardname] dies..."
  if ((text.includes("when") || text.includes("whenever")) && text.includes("dies")) {
    if (text.includes("create") || text.includes("put") && text.includes("token")) {
      abilities.push({
        trigger: "dies",
        effect: "create_token",
        target: "self",
        cardName,
      })
    }
    if (text.includes("draw") && text.includes("card")) {
      abilities.push({
        trigger: "dies",
        effect: "draw_card",
        target: "self",
        cardName,
      })
    }
  }

  return abilities
}

/**
 * Parse number words to integers
 */
function parseNumberWord(word: string): number {
  const numberMap: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  }
  return numberMap[word.toLowerCase()] || 1
}

/**
 * Check if a card has a specific keyword ability
 */
export function hasKeyword(card: CardInstance, keyword: string): boolean {
  if (card.keywords.includes(keyword)) return true

  // Also check oracle text for keyword
  const text = card.oracleText?.toLowerCase() || ""
  return text.includes(keyword.toLowerCase())
}

/**
 * Get current power and toughness including counters
 */
export function getCurrentStats(card: CardInstance): { power: number; toughness: number } {
  const basePower = parseInt(card.power || "0")
  const baseToughness = parseInt(card.toughness || "0")

  const power = basePower + card.counters.p1p1
  const toughness = baseToughness + card.counters.p1p1

  return { power, toughness }
}

/**
 * Phase 2: Register a triggered ability when an event occurs
 */
export function registerTrigger(
  gameState: GameState,
  sourceCard: CardInstance,
  triggerType: PendingTrigger["trigger"],
  abilities: TriggeredAbility[],
): void {
  const matchingAbilities = abilities.filter((ability) => ability.trigger === triggerType)

  for (const ability of matchingAbilities) {
    const validTargets = getValidTargets(gameState, ability, sourceCard)
    // Proliferate and support don't use requiresTarget flag - they need special handling
    const requiresTarget = ability.target === "target" && ability.effect !== "proliferate" && ability.effect !== "support"

    const trigger: PendingTrigger = {
      id: uuidv4(),
      sourceCardId: sourceCard.instanceId,
      controllerId: sourceCard.controllerId,
      trigger: ability.trigger,
      effect: ability.effect,
      requiresTarget,
      validTargets,
      amount: ability.amount,
      resolved: false,
    }

    gameState.triggerQueue.push(trigger)
    
    addGameLog(gameState, `triggered ${ability.effect.replace(/_/g, " ")}`, "trigger", sourceCard.controllerId, {
      cardName: sourceCard.name,
      cardText: sourceCard.oracleText || undefined,
      details: requiresTarget ? `Requires target selection` : undefined,
    })
    
    console.log(
      `[TRIGGER] Registered ${ability.effect} from ${sourceCard.name} (requires target: ${requiresTarget})`,
    )
  }
}

/**
 * Get valid targets for a triggered ability
 */
function getValidTargets(
  gameState: GameState,
  ability: TriggeredAbility,
  sourceCard: CardInstance,
): string[] | undefined {
  if (!ability.target || ability.target === "self") return undefined

  const validTargets: string[] = []

  switch (ability.effect) {
    case "add_counter_target":
      // Target creature you control or any creature
      for (const cardId of gameState.battlefield) {
        const card = gameState.entities[cardId]
        if (card.typeLine.toLowerCase().includes("creature")) {
          // Check if ability restricts to "you control"
          if (ability.cardName.includes("you control") || ability.cardName.includes("target creature you control")) {
            if (card.controllerId === sourceCard.controllerId) {
              validTargets.push(cardId)
            }
          } else {
            validTargets.push(cardId)
          }
        }
      }
      break

    case "complex_target":
      // Generic targeting - all creatures
      for (const cardId of gameState.battlefield) {
        const card = gameState.entities[cardId]
        if (card.typeLine.toLowerCase().includes("creature")) {
          validTargets.push(cardId)
        }
      }
      break
  }

  return validTargets.length > 0 ? validTargets : undefined
}

/**
 * Bot strategy: Select best targets for proliferate
 */
function getBotProliferateTargets(gameState: GameState, botPlayerId: string): string[] {
  const targets: string[] = []

  // Prioritize bot's own creatures with counters
  for (const cardId of gameState.battlefield) {
    const card = gameState.entities[cardId]
    if (card.controllerId === botPlayerId) {
      const hasCounters = 
        card.counters.p1p1 > 0 || 
        card.counters.loyalty > 0 || 
        card.counters.charge > 0 ||
        card.counters.poison > 0
      
      if (hasCounters) {
        targets.push(cardId)
      }
    }
  }

  // If bot has poison counters on opponent, proliferate those too
  const opponentId = Object.keys(gameState.players).find(id => id !== botPlayerId)
  if (opponentId) {
    const opponent = gameState.players[opponentId]
    if (opponent.poisonCounters > 0 || opponent.energyCounters > 0) {
      targets.push(opponentId)
    }
  }

  return targets
}

/**
 * Bot strategy: Select best target for a triggered ability
 */
function getBotTargetForTrigger(
  gameState: GameState,
  botPlayerId: string,
  trigger: PendingTrigger,
): string | undefined {
  if (!trigger.validTargets || trigger.validTargets.length === 0) return undefined

  switch (trigger.effect) {
    case "add_counter_target":
      // Find bot's best creature to buff
      const botCreatures = trigger.validTargets.filter((id) => {
        const card = gameState.entities[id]
        return card && card.controllerId === botPlayerId
      })

      if (botCreatures.length > 0) {
        // Target creature with highest power
        botCreatures.sort((a, b) => {
          const { power: powerA } = getCurrentStats(gameState.entities[a])
          const { power: powerB } = getCurrentStats(gameState.entities[b])
          return powerB - powerA
        })
        return botCreatures[0]
      }
      break

    case "complex_target":
      // Generic targeting - target opponent's best creature
      const opponentId = Object.keys(gameState.players).find((id) => id !== botPlayerId)
      if (opponentId) {
        const opponentCreatures = trigger.validTargets.filter((id) => {
          const card = gameState.entities[id]
          return card && card.controllerId === opponentId
        })

        if (opponentCreatures.length > 0) {
          // Target opponent's strongest creature
          opponentCreatures.sort((a, b) => {
            const { power: powerA } = getCurrentStats(gameState.entities[a])
            const { power: powerB } = getCurrentStats(gameState.entities[b])
            return powerB - powerA
          })
          return opponentCreatures[0]
        }
      }
      break
  }

  // Default: pick first valid target
  return trigger.validTargets[0]
}

/**
 * Resolve all pending triggers in the queue
 * Returns true if all triggers were auto-resolved, false if player input is needed
 */
export function resolveTriggers(gameState: GameState): boolean {
  let needsPlayerInput = false

  for (const trigger of gameState.triggerQueue) {
    if (trigger.resolved) continue

    // Support needs player input to choose multiple targets UNLESS it's a bot trigger
    if (trigger.effect === "support") {
      const sourceCard = gameState.entities[trigger.sourceCardId]
      if (sourceCard && sourceCard.controllerId && gameState.players[sourceCard.controllerId]?.name === "Bot") {
        // Bot auto-selects support targets (up to amount)
        const validTargets = trigger.validTargets || []
        const numTargets = Math.min(trigger.amount || 1, validTargets.length)
        const selectedTargets = validTargets.slice(0, numTargets)
        
        // Add counters to each selected target
        selectedTargets.forEach(targetId => {
          addCounterToTarget(gameState, targetId, 1, sourceCard.controllerId)
        })
        
        trigger.resolved = true
        console.log(`[TRIGGER] Bot auto-resolved support ${numTargets} with ${selectedTargets.length} target(s)`)
      } else {
        // Human player needs to choose
        needsPlayerInput = true
        console.log(`[TRIGGER] Support requires player selection of up to ${trigger.amount} targets`)
      }
      continue
    }

    // Scry needs player input UNLESS it's a bot trigger
    if (trigger.effect === "scry") {
      const sourceCard = gameState.entities[trigger.sourceCardId]
      if (sourceCard && sourceCard.controllerId && gameState.players[sourceCard.controllerId]?.name === "Bot") {
        // Bot just keeps cards on top
        trigger.resolved = true
        console.log(`[TRIGGER] Bot auto-resolved scry ${trigger.amount}`)
      } else {
        // Human player needs to choose
        needsPlayerInput = true
        console.log(`[TRIGGER] Scry requires player selection`)
      }
      continue
    }

    // Proliferate needs player input UNLESS it's a bot trigger
    if (trigger.effect === "proliferate") {
      // Check if this is a bot's trigger
      const sourceCard = gameState.entities[trigger.sourceCardId]
      if (sourceCard && sourceCard.controllerId && gameState.players[sourceCard.controllerId]?.name === "Bot") {
        // Bot auto-selects proliferate targets
        const targets = getBotProliferateTargets(gameState, sourceCard.controllerId)
        trigger.proliferateTargets = targets
        executeTriggerEffect(gameState, trigger, sourceCard, undefined)
        trigger.resolved = true
        console.log(`[TRIGGER] Bot auto-resolved proliferate with ${targets.length} target(s)`)
      } else {
        // Human player needs to choose
        needsPlayerInput = true
        console.log(`[TRIGGER] Proliferate requires player selection`)
      }
      continue
    }

    // If trigger requires target selection, check if it's a bot trigger
    if (trigger.requiresTarget && trigger.validTargets && trigger.validTargets.length > 0) {
      const sourceCard = gameState.entities[trigger.sourceCardId]
      if (sourceCard && sourceCard.controllerId && gameState.players[sourceCard.controllerId]?.name === "Bot") {
        // Bot auto-selects target
        const target = getBotTargetForTrigger(gameState, sourceCard.controllerId, trigger)
        if (target) {
          executeTriggerEffect(gameState, trigger, sourceCard, target)
          trigger.resolved = true
          console.log(`[TRIGGER] Bot auto-resolved ${trigger.effect} targeting ${gameState.entities[target]?.name || target}`)
        } else {
          // No valid target found, resolve anyway
          trigger.resolved = true
          console.log(`[TRIGGER] Bot couldn't find valid target for ${trigger.effect}`)
        }
      } else {
        // Human player needs to choose
        needsPlayerInput = true
        console.log(`[TRIGGER] ${trigger.effect} requires target selection - pausing for player input`)
      }
      continue
    }

    // Auto-resolve triggers that don't need targets
    if (!trigger.requiresTarget) {
      const sourceCard = gameState.entities[trigger.sourceCardId]
      if (sourceCard) {
        executeTriggerEffect(gameState, trigger, sourceCard, undefined)
        trigger.resolved = true
      }
    }
  }

  // Remove resolved triggers
  gameState.triggerQueue = gameState.triggerQueue.filter((t) => !t.resolved)

  return !needsPlayerInput
}

/**
 * Execute a trigger effect with an optional target
 */
export function executeTriggerEffect(
  gameState: GameState,
  trigger: PendingTrigger,
  sourceCard: CardInstance,
  targetCardId?: string,
): void {
  console.log(`[TRIGGER] Executing ${trigger.effect} from ${sourceCard.name}`)

  switch (trigger.effect) {
    case "support":
      // Support handled in resolveTriggers with multiple targets
      console.log(`[TRIGGER] Support effect (should be handled in resolveTriggers)`)
      break

    case "add_counter_target":
      if (targetCardId) {
        addCounterToTarget(gameState, targetCardId, trigger.amount || 1, sourceCard.controllerId)
      }
      break

    case "add_counter_self":
      addCounterToTarget(gameState, sourceCard.instanceId, trigger.amount || 1, sourceCard.controllerId)
      break

    case "add_counter_each":
      // Add counter to each other creature controlled by player
      for (const cardId of gameState.battlefield) {
        const card = gameState.entities[cardId]
        if (
          card.instanceId !== sourceCard.instanceId &&
          card.controllerId === sourceCard.controllerId &&
          card.typeLine.toLowerCase().includes("creature")
        ) {
          addCounterToTarget(gameState, cardId, trigger.amount || 1, sourceCard.controllerId)
        }
      }
      break

    case "bane_of_progress":
      // Bane of Progress: Destroy all artifacts and enchantments, then add counters equal to number destroyed
      let destroyedCount = 0
      const permanentsToDestroy = [...gameState.battlefield] // Copy array since we'll modify it
      
      for (const cardId of permanentsToDestroy) {
        const card = gameState.entities[cardId]
        const isArtifact = card.typeLine.toLowerCase().includes("artifact")
        const isEnchantment = card.typeLine.toLowerCase().includes("enchantment")
        
        if (isArtifact || isEnchantment) {
          // Destroy this permanent
          const owner = gameState.players[card.controllerId]
          gameState.battlefield = gameState.battlefield.filter(id => id !== cardId)
          owner.graveyard.push(cardId)
          card.zone = "GRAVEYARD"
          destroyedCount++
          console.log(`[BANE] Destroyed ${card.name}`)
          
          addGameLog(gameState, `destroyed ${card.name}`, "effect", sourceCard.controllerId, {
            cardName: sourceCard.name,
            targetName: card.name,
            details: isArtifact && isEnchantment ? "Artifact Enchantment" : isArtifact ? "Artifact" : "Enchantment",
          })
        }
      }
      
      // Add counters to Bane of Progress equal to number of permanents destroyed
      if (destroyedCount > 0) {
        sourceCard.counters.p1p1 += destroyedCount
        console.log(`[BANE] Added ${destroyedCount} +1/+1 counters to ${sourceCard.name}`)
        
        addGameLog(gameState, `added ${destroyedCount} counters to ${sourceCard.name}`, "effect", sourceCard.controllerId, {
          cardName: sourceCard.name,
          details: `Destroyed ${destroyedCount} permanents`,
        })
      }
      break

    case "draw_card":
      drawCard(gameState, trigger.controllerId)
      break

    case "scry":
      // Scry mechanic - needs UI for player to choose
      const scryPlayer = gameState.players[trigger.controllerId]
      if (scryPlayer.name === "Bot") {
        // Bot just keeps cards on top (already in correct position)
        console.log(`[TRIGGER] Bot scry ${trigger.amount || 1} - keeping cards on top`)
      } else {
        // Human player - will show scry UI
        console.log(`[TRIGGER] Scry ${trigger.amount || 1} - waiting for player input`)
      }
      break

    case "proliferate":
      // Phase 3: Proliferate mechanic
      if (trigger.proliferateTargets && trigger.proliferateTargets.length > 0) {
        executeProliferate(gameState, trigger.proliferateTargets)
      } else {
        console.log(`[TRIGGER] Proliferate awaiting target selection`)
      }
      break

    case "create_token":
      // Token creation
      createTokens(gameState, sourceCard, trigger.amount || 1)
      break

    case "complex_target":
      if (targetCardId) {
        // Complex targeting effects need card-specific logic
        console.log(`[TRIGGER] Complex target effect for ${sourceCard.name} on ${targetCardId}`)
      }
      break
  }
}

/**
 * Add +1/+1 counter to a target creature
 */
function addCounterToTarget(
  gameState: GameState,
  targetCardId: string,
  amount: number,
  controllerId: string,
): void {
  const targetCard = gameState.entities[targetCardId]
  if (!targetCard) return

  const multiplier = getHardenedScalesMultiplier(gameState, controllerId)
  const countersToAdd = amount * multiplier

  targetCard.counters.p1p1 += countersToAdd
  console.log(
    `[TRIGGER] Added ${countersToAdd} +1/+1 counter(s) to ${targetCard.name} (base: ${amount}, multiplier: ${multiplier})`,
  )

  // Trigger counter_added abilities
  const abilities = parseTriggeredAbilities(targetCard.oracleText || "", targetCard.name)
  registerTrigger(gameState, targetCard, "counter_added", abilities)
}

/**
 * Draw a card for a player
 */
function drawCard(gameState: GameState, playerId: string): void {
  const player = gameState.players[playerId]
  if (!player || player.library.length === 0) return

  const cardId = player.library.pop()!
  player.hand.push(cardId)
  gameState.entities[cardId].zone = "HAND"
  console.log(`[TRIGGER] ${player.name} draws a card`)
}

/**
 * Create token creatures on the battlefield
 */
function createTokens(gameState: GameState, sourceCard: CardInstance, count: number): void {
  const controllerId = sourceCard.controllerId
  
  // Parse token type from oracle text
  const text = sourceCard.oracleText?.toLowerCase() || ""
  
  // Common token patterns:
  // "create a 1/1 white Soldier creature token"
  // "create X 1/1 green Saproling creature tokens"
  // "create a token that's a copy of target creature"
  
  let tokenPower = 1
  let tokenToughness = 1
  let tokenColors: string[] = []
  let tokenTypes = ["Creature"]
  let tokenSubtype = "Token"
  let tokenName = "Token"
  
  // Try to parse power/toughness
  const ptMatch = text.match(/(\d+)\/(\d+)/)
  if (ptMatch) {
    tokenPower = parseInt(ptMatch[1])
    tokenToughness = parseInt(ptMatch[2])
  }
  
  // Try to parse color
  if (text.includes("white")) tokenColors.push("W")
  if (text.includes("blue")) tokenColors.push("U")
  if (text.includes("black")) tokenColors.push("B")
  if (text.includes("red")) tokenColors.push("R")
  if (text.includes("green")) tokenColors.push("G")
  
  // Try to parse creature type
  const typePatterns = [
    "soldier", "saproling", "goblin", "elf", "zombie", "spirit",
    "angel", "demon", "dragon", "beast", "elemental", "insect",
    "squirrel", "snake", "bird", "fish", "horror"
  ]
  
  for (const type of typePatterns) {
    if (text.includes(type)) {
      tokenSubtype = type.charAt(0).toUpperCase() + type.slice(1)
      tokenName = `${tokenSubtype} Token`
      break
    }
  }
  
  // Create the tokens
  for (let i = 0; i < count; i++) {
    const tokenId = `token-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`
    
    const token: CardInstance = {
      instanceId: tokenId,
      ownerId: controllerId,
      controllerId: controllerId,
      dbReferenceId: "token",
      
      // Token card data
      name: tokenName,
      manaCost: "",
      cmc: 0,
      types: tokenTypes,
      typeLine: `Creature — ${tokenSubtype}`,
      oracleText: undefined,
      power: tokenPower.toString(),
      toughness: tokenToughness.toString(),
      colors: tokenColors,
      colorIdentity: tokenColors,
      keywords: [],
      imageUrl: undefined,
      
      // Token state
      zone: "BATTLEFIELD",
      tapped: false,
      faceDown: false,
      summoningSick: true,
      isToken: true,
      
      counters: { p1p1: 0, loyalty: 0, charge: 0, poison: 0 },
      temporaryModifiers: [],
    }
    
    gameState.entities[tokenId] = token
    gameState.battlefield.push(tokenId)
    
    console.log(`[TOKEN] Created ${tokenName} (${tokenPower}/${tokenToughness}) for ${gameState.players[controllerId].name}`)
  }
  
  addGameLog(gameState, `created ${count} token${count === 1 ? "" : "s"}`, "effect", controllerId, {
    cardName: sourceCard.name,
    details: `${tokenName} (${tokenPower}/${tokenToughness})`,
  })
}

/**
 * Resolve a trigger with a chosen target (called by UI)
 */
export function resolveTriggerWithTarget(
  gameState: GameState,
  triggerId: string,
  targetCardId: string,
): boolean {
  const trigger = gameState.triggerQueue.find((t) => t.id === triggerId)
  if (!trigger || trigger.resolved) return false

  const sourceCard = gameState.entities[trigger.sourceCardId]
  if (!sourceCard) return false

  // Validate target
  if (trigger.validTargets && !trigger.validTargets.includes(targetCardId)) {
    console.log(`[TRIGGER] Invalid target ${targetCardId} for trigger ${triggerId}`)
    return false
  }

  executeTriggerEffect(gameState, trigger, sourceCard, targetCardId)
  trigger.resolved = true

  // Remove resolved trigger
  gameState.triggerQueue = gameState.triggerQueue.filter((t) => !t.resolved)

  return true
}

/**
 * Phase 3: Resolve proliferate with chosen targets
 */
export function resolveProliferate(
  gameState: GameState,
  triggerId: string,
  selectedTargets: string[],
): boolean {
  const trigger = gameState.triggerQueue.find((t) => t.id === triggerId)
  if (!trigger || trigger.resolved || trigger.effect !== "proliferate") return false

  const sourceCard = gameState.entities[trigger.sourceCardId]
  if (!sourceCard) return false

  trigger.proliferateTargets = selectedTargets
  executeTriggerEffect(gameState, trigger, sourceCard, undefined)
  trigger.resolved = true

  // Remove resolved trigger
  gameState.triggerQueue = gameState.triggerQueue.filter((t) => !t.resolved)

  return true
}

/**
 * Resolve support with chosen targets (multiple targets)
 */
export function resolveSupport(
  gameState: GameState,
  triggerId: string,
  selectedTargets: string[],
): boolean {
  const trigger = gameState.triggerQueue.find((t) => t.id === triggerId)
  if (!trigger || trigger.resolved || trigger.effect !== "support") return false

  const sourceCard = gameState.entities[trigger.sourceCardId]
  if (!sourceCard) return false

  // Add 1 counter to each selected target
  selectedTargets.forEach(targetId => {
    addCounterToTarget(gameState, targetId, 1, sourceCard.controllerId)
  })

  trigger.resolved = true

  // Remove resolved trigger
  gameState.triggerQueue = gameState.triggerQueue.filter((t) => !t.resolved)

  console.log(`[SUPPORT] Resolved support with ${selectedTargets.length} target(s)`)
  return true
}

/**
 * Phase 3: Execute proliferate on selected targets
 */
function executeProliferate(gameState: GameState, targetIds: string[]): void {
  console.log(`[PROLIFERATE] Proliferating ${targetIds.length} target(s)`)

  for (const targetId of targetIds) {
    // Check if it's a card on battlefield
    if (gameState.entities[targetId]) {
      const card = gameState.entities[targetId]
      let proliferated = false

      if (card.counters.p1p1 > 0) {
        card.counters.p1p1 += 1
        proliferated = true
      }
      if (card.counters.loyalty > 0) {
        card.counters.loyalty += 1
        proliferated = true
      }
      if (card.counters.charge > 0) {
        card.counters.charge += 1
        proliferated = true
      }
      if (card.counters.poison > 0) {
        card.counters.poison += 1
        proliferated = true
      }

      if (proliferated) {
        console.log(`[PROLIFERATE] ${card.name} gets +1 counter of each type`)
        
        // Trigger counter_added abilities for +1/+1 counters
        if (card.counters.p1p1 > 0) {
          const abilities = parseTriggeredAbilities(card.oracleText || "", card.name)
          registerTrigger(gameState, card, "counter_added", abilities)
        }
      }
    }
    // Check if it's a player
    else if (gameState.players[targetId]) {
      const player = gameState.players[targetId]
      let proliferated = false

      if (player.poisonCounters > 0) {
        player.poisonCounters += 1
        proliferated = true
      }
      if (player.energyCounters > 0) {
        player.energyCounters += 1
        proliferated = true
      }

      if (proliferated) {
        console.log(`[PROLIFERATE] ${player.name} gets +1 counter of each type`)
      }
    }
  }
}

/**
 * Phase 5: Parse activated abilities from oracle text
 */
export interface ActivatedAbility {
  cost: {
    tap?: boolean
    mana?: string // Mana cost like "{2}{G}"
    sacrifice?: boolean
    discardCount?: number
    removeCounters?: { type: string; amount: number }
  }
  effect: string
  target?: "self" | "target" | "any" | "player" | "creature"
  amount?: number
  manaToAdd?: string[] // For add_mana effects, array of colors like ["G", "W"]
  timing: "instant" | "sorcery" // When can it be activated
}

export function parseActivatedAbilities(oracleText: string, cardName: string): ActivatedAbility[] {
  if (!oracleText) return []

  const abilities: ActivatedAbility[] = []
  const text = oracleText.toLowerCase()

  // Pattern: "{cost}: effect"
  // Look for lines with colons that aren't replacement effects or triggers
  const lines = text.split('\n')
  
  for (const line of lines) {
    // Skip triggered abilities (when, whenever, at)
    if (line.includes('when') || line.includes('whenever') || line.includes('at the beginning')) {
      continue
    }

    // Look for activated ability pattern: cost : effect
    // Common patterns: {T}: effect, {1}{T}: effect, {X}, {T}: effect
    const activatedPattern = /([^:]+):\s*(.+)/
    const match = line.match(activatedPattern)
    
    if (match) {
      const costText = match[1].trim()
      const effectText = match[2].trim()

      // Parse cost
      const cost: ActivatedAbility['cost'] = {}
      
      // Check for tap symbol {T}
      if (costText.includes('{t}')) {
        cost.tap = true
      }

      // Check for mana cost {X}, {1}, {2}{G}, etc.
      const manaPattern = /{[^}]+}/g
      const manaCosts = costText.match(manaPattern)
      if (manaCosts && manaCosts.length > 0) {
        // Filter out {T} which we already handled
        const actualManaCosts = manaCosts.filter(m => m.toLowerCase() !== '{t}')
        if (actualManaCosts.length > 0) {
          cost.mana = actualManaCosts.join('')
        }
      }

      // Check for sacrifice cost
      if (costText.includes('sacrifice')) {
        cost.sacrifice = true
      }

      // Check for discard cost
      if (costText.includes('discard')) {
        const discardMatch = costText.match(/discard (a|an|one|two|three|\d+) card/)
        if (discardMatch) {
          cost.discardCount = parseNumberWord(discardMatch[1])
        }
      }

      // Check for remove counter cost
      if (costText.includes('remove')) {
        // "Remove a +1/+1 counter", "Remove two charge counters", etc.
        cost.removeCounters = { type: 'p1p1', amount: 1 } // Simplified
      }

      // Determine timing (most activated abilities are instant speed)
      const timing: ActivatedAbility['timing'] = 
        effectText.includes('only as a sorcery') || 
        effectText.includes('activate only as a sorcery')
          ? 'sorcery'
          : 'instant'

      // Parse effect
      let effect = 'unknown'
      let target: ActivatedAbility['target'] | undefined = undefined
      let amount: number | undefined = undefined

      // Deal damage
      if (effectText.includes('deal') && effectText.includes('damage')) {
        effect = 'deal_damage'
        const damageMatch = effectText.match(/(\d+|x)\s*damage/)
        if (damageMatch) {
          amount = damageMatch[1].toLowerCase() === 'x' ? -1 : parseInt(damageMatch[1])
        }
        
        if (effectText.includes('target creature')) {
          target = 'creature'
        } else if (effectText.includes('any target')) {
          target = 'any'
        } else if (effectText.includes('target player')) {
          target = 'player'
        }
      }
      // Add mana
      else if (effectText.includes('add')) {
        effect = 'add_mana'
        // Parse what mana is being added: "Add {G}{W}", "Add {C}", etc.
        const manaAddPattern = /add\s+({[^}]+})+/g
        const manaMatch = effectText.match(manaAddPattern)
        if (manaMatch) {
          // Extract individual mana symbols
          const manaSymbols = manaMatch[0].match(/{([^}]+)}/g)
          if (manaSymbols) {
            const manaToAdd: string[] = []
            manaSymbols.forEach(symbol => {
              const color = symbol.slice(1, -1) // Remove { }
              if (['W', 'U', 'B', 'R', 'G', 'C'].includes(color.toUpperCase())) {
                manaToAdd.push(color.toUpperCase())
              }
            })
            if (manaToAdd.length > 0) {
              abilities.push({
                cost,
                effect,
                manaToAdd,
                timing,
              })
              continue // Skip the generic push at the end
            }
          }
        }
      }
      // Draw card
      else if (effectText.includes('draw')) {
        effect = 'draw_card'
        const drawMatch = effectText.match(/draw (a|an|one|two|three|\d+) card/)
        if (drawMatch) {
          amount = parseNumberWord(drawMatch[1])
        }
      }
      // Put counter
      else if (effectText.includes('put') && effectText.includes('counter')) {
        effect = 'add_counter'
        target = effectText.includes('target') ? 'target' : 'self'
      }

      abilities.push({
        cost,
        effect,
        target,
        amount,
        timing,
      })
    }
  }

  return abilities
}
