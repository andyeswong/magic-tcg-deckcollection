import type { GameState, CardInstance, Phase } from "./types"
import { applyETBCounters, parseTriggeredAbilities, getCurrentStats, registerTrigger, resolveTriggers, hasKeyword, checkEntersTapped, type ActivatedAbility } from "./card-effects"
import { addGameLog } from "./logger"
import { parseSpellEffect } from "./spell-parser"

// Helper: Get next phase
export function getNextPhase(currentPhase: Phase): Phase {
  const phaseOrder: Phase[] = [
    "UNTAP",
    "UPKEEP",
    "DRAW",
    "MAIN_1",
    "COMBAT_BEGIN",
    "DECLARE_ATTACKERS",
    "DECLARE_BLOCKERS",
    "COMBAT_DAMAGE",
    "COMBAT_END",
    "MAIN_2",
    "END_STEP",
    "CLEANUP",
  ]

  const currentIndex = phaseOrder.indexOf(currentPhase)
  if (currentIndex === phaseOrder.length - 1) {
    return "UNTAP" // Loop back to start of next turn
  }
  return phaseOrder[currentIndex + 1]
}

// Helper: Check if phase requires player interaction
export function isInteractivePhase(phase: Phase): boolean {
  // Phases where player can take actions
  // DRAW is automatic (just draws a card), MAIN_1 is first interactive phase
  const interactivePhases: Phase[] = ["MAIN_1", "DECLARE_ATTACKERS", "MAIN_2"]

  const result = interactivePhases.includes(phase)
  console.log(`[PHASE] Is ${phase} interactive? ${result}`)
  return result
}

// Helper: Check if a spell requires targets
export function spellRequiresTargets(card: CardInstance): boolean {
  const effects = parseSpellEffect(card.oracleText || "", card.name)

  for (const effect of effects) {
    // Check for target counters
    if (effect.type === "add_counters" && effect.counters) {
      if (effect.counters.targetCount && effect.counters.targetCount > 0) {
        return true
      }
    }
    // Check for targeted destroy effects
    if (effect.type === "destroy_creatures" && effect.destroy && !effect.destroy.all) {
      return true
    }
    // Check for targeted exile effects
    if (effect.type === "exile_permanents" && effect.exile && !effect.exile.all) {
      return true
    }
  }

  return false
}

// Helper: Get valid targets for a spell
export function getValidTargetsForSpell(gameState: GameState, card: CardInstance): string[] {
  const effects = parseSpellEffect(card.oracleText || "", card.name)
  const validTargets: string[] = []

  for (const effect of effects) {
    if (effect.type === "add_counters" && effect.counters) {
      const targetType = effect.counters.targetType || "creature"

      // Get all creatures on battlefield
      for (const cardId of gameState.battlefield) {
        const targetCard = gameState.entities[cardId]
        if (targetCard.typeLine.toLowerCase().includes(targetType)) {
          validTargets.push(cardId)
        }
      }
    }
    // Add more target types as needed
  }

  return validTargets
}

// Action: Draw a card
export function drawCard(gameState: GameState, playerId: string): void {
  const player = gameState.players[playerId]

  if (player.library.length === 0) {
    // Lose the game (decked out)
    gameState.status = "ENDED"
    gameState.winner = Object.keys(gameState.players).find((id) => id !== playerId)
    return
  }

  const cardId = player.library.pop()!
  player.hand.push(cardId)
  const card = gameState.entities[cardId]
  card.zone = "HAND"

  addGameLog(gameState, "drew a card", "action", playerId, {
    cardName: card.name,
    cardText: card.oracleText || undefined,
  })

  // Trigger abilities that respond to drawing cards
  const { parseTriggeredAbilities } = require("./card-effects")
  for (const permanentId of gameState.battlefield) {
    const permanent = gameState.entities[permanentId]
    if (permanent.controllerId === playerId) {
      const triggers = parseTriggeredAbilities(permanent.oracleText || "", permanent.name)

      for (const trigger of triggers) {
        if (trigger.trigger === "draw") {
          console.log(`[TRIGGER] ${permanent.name} triggers on draw`)
          // Add +1/+1 counter (e.g., Chasm Skulker)
          if (trigger.effect === "add_counter_self") {
            permanent.counters.p1p1 += (trigger.amount || 1)
            console.log(`[TRIGGER] Added ${trigger.amount || 1} +1/+1 counter to ${permanent.name} (now has ${permanent.counters.p1p1})`)

            // Trigger store update to show counter change
            if (typeof window !== 'undefined') {
              const { useGameStore } = require('./store')
              useGameStore.setState({ gameState: { ...gameState } })
            }
          }
          // Can add more draw trigger effects here as needed
        }
      }
    }
  }
}

// Action: Discard a card from hand
export function discardCard(gameState: GameState, playerId: string, cardInstanceId: string): boolean {
  const player = gameState.players[playerId]

  // Validate: Is it in hand?
  if (!player.hand.includes(cardInstanceId)) {
    return false
  }

  // Move from hand to graveyard
  player.hand = player.hand.filter((id) => id !== cardInstanceId)
  player.graveyard.push(cardInstanceId)
  gameState.entities[cardInstanceId].zone = "GRAVEYARD"

  console.log(`[DISCARD] ${gameState.entities[cardInstanceId].name} discarded to graveyard`)
  return true
}

// Action: Play a land
export function playLand(gameState: GameState, playerId: string, cardInstanceId: string): boolean {
  const player = gameState.players[playerId]
  const card = gameState.entities[cardInstanceId]

  // Validate: Is it a land?
  if (!card.typeLine.toLowerCase().includes("land")) {
    return false
  }

  // Validate: Can player play land?
  if (player.flags.landsPlayedThisTurn >= player.flags.maxLandsPerTurn) {
    return false
  }

  // Validate: Is it in hand?
  if (!player.hand.includes(cardInstanceId)) {
    return false
  }

  // Move from hand to battlefield
  player.hand = player.hand.filter((id) => id !== cardInstanceId)
  gameState.battlefield.push(cardInstanceId)
  card.zone = "BATTLEFIELD"

  // Initialize runtime ability state (v1.1)
  const { initializeRuntimeState } = require("./runtime-state-manager")
  const { loadAbilities } = require("./ability-loader")

  // Load abilities and apply effects (async - doesn't block game flow)
  loadAbilities(card.dbReferenceId).then(async abilityData => {
    card.runtimeAbilityState = await initializeRuntimeState(card, abilityData || undefined)

    if (abilityData) {
      console.log(`[AbilitySystem] ${card.name} using JSON abilities from database`)
      console.log(`[JSON-ABILITIES] ${card.name} loaded abilities:`, JSON.stringify(abilityData.abilities, null, 2))

      // Apply ETB replacement effects from JSON
      if (abilityData.abilities.replacement) {
        for (const replacement of abilityData.abilities.replacement) {
          if (replacement.replaces === "etb") {
            // Check if this is a counter-adding replacement effect
            // The structure can be either replacement.effect or replacement.modification
            const effectData = replacement.effect || replacement.modification

            if (effectData?.action === "add_counters" && effectData.counters) {
              console.log(`[JSON-EFFECT] ETB replacement for ${card.name}:`, JSON.stringify(replacement, null, 2))
              const amount = effectData.counters.amount || 0
              const counterType = effectData.counters.type || "p1p1"
              if (amount > 0 && counterType in card.counters) {
                card.counters[counterType as keyof typeof card.counters] += amount
                console.log(`[AbilitySystem] Applied ETB replacement: ${card.name} enters with ${amount} ${counterType} counters`)
              }
            }
          }
        }
      }

      const abilities = []
      if (card.runtimeAbilityState?.saga) {
        abilities.push(`Saga (${card.runtimeAbilityState.saga.maxChapters} chapters)`)
      }
      if (card.runtimeAbilityState?.activeTriggeredAbilities.length > 0) {
        abilities.push(`${card.runtimeAbilityState.activeTriggeredAbilities.length} triggered`)
      }
      if (card.runtimeAbilityState?.activeReplacements.length > 0) {
        abilities.push(`${card.runtimeAbilityState.activeReplacements.length} replacement`)
      }
      if (abilities.length > 0) {
        console.log(`[AbilitySystem] Initialized runtime state for ${card.name}: ${abilities.join(', ')}`)
      }
    } else {
      console.log(`[AbilitySystem] ${card.name} has no JSON abilities in database`)
    }

    // Trigger store update to reflect runtime state changes
    if (typeof window !== 'undefined') {
      const { useGameStore } = require('./store')
      useGameStore.setState({ gameState: { ...gameState } })
    }
  }).catch(err => {
    console.error(`[AbilitySystem] Failed to load abilities for ${card.name}:`, err)

    // Trigger store update even on error
    if (typeof window !== 'undefined') {
      const { useGameStore } = require('./store')
      useGameStore.setState({ gameState: { ...gameState } })
    }
  })

  // Check if land enters tapped
  if (checkEntersTapped(card.oracleText || "", card.name)) {
    card.tapped = true
    console.log(`[LAND] ${card.name} enters the battlefield tapped`)
  }

  // Increment lands played
  player.flags.landsPlayedThisTurn++

  addGameLog(gameState, "played land", "action", playerId, {
    cardName: card.name,
    cardText: card.oracleText || undefined,
  })

  // Note: ETB triggers are now handled via JSON abilities only

  // Attempt to auto-resolve triggers that don't need targets
  resolveTriggers(gameState)

  return true
}

// Action: Tap a permanent
export function tapPermanent(gameState: GameState, cardInstanceId: string): boolean {
  const card = gameState.entities[cardInstanceId]

  if (card.zone !== "BATTLEFIELD" || card.tapped) {
    return false
  }

  card.tapped = true
  return true
}

// Action: Untap a permanent
export function untapPermanent(gameState: GameState, cardInstanceId: string): boolean {
  const card = gameState.entities[cardInstanceId]

  if (card.zone !== "BATTLEFIELD" || !card.tapped) {
    return false
  }

  card.tapped = false
  return true
}

// Action: Add mana to pool (when tapping a land)
export function addManaFromLand(
  gameState: GameState,
  playerId: string,
  cardInstanceId: string,
  chosenColor?: string,
): boolean {
  const card = gameState.entities[cardInstanceId]

  // Tap the land
  if (!tapPermanent(gameState, cardInstanceId)) {
    return false
  }

  const player = gameState.players[playerId]

  // If a color was chosen (for dual lands), use that
  if (chosenColor && ["W", "U", "B", "R", "G", "C"].includes(chosenColor)) {
    player.manaPool[chosenColor as keyof typeof player.manaPool]++
    return true
  }

  // Basic lands produce specific mana
  if (card.name === "Plains" || card.name.includes("Plains")) player.manaPool.W++
  else if (card.name === "Island" || card.name.includes("Island")) player.manaPool.U++
  else if (card.name === "Swamp" || card.name.includes("Swamp")) player.manaPool.B++
  else if (card.name === "Mountain" || card.name.includes("Mountain")) player.manaPool.R++
  else if (card.name === "Forest" || card.name.includes("Forest")) player.manaPool.G++
  else {
    // Non-basic land - add colorless for now
    player.manaPool.C++
  }

  return true
}

// Helper: Check if player can afford mana cost
export function canAffordManaCost(gameState: GameState, playerId: string, manaCost: string): boolean {
  const player = gameState.players[playerId]

  // Handle empty mana cost
  if (!manaCost || manaCost.trim() === "") {
    return true // Cards with no mana cost can always be cast
  }

  // Parse mana cost like "{2}{G}{U}"
  const symbols = manaCost.match(/\{([^}]+)\}/g)?.map((s) => s.slice(1, -1)) || []

  const required = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, generic: 0 }

  symbols.forEach((symbol) => {
    if (symbol === "W") required.W++
    else if (symbol === "U") required.U++
    else if (symbol === "B") required.B++
    else if (symbol === "R") required.R++
    else if (symbol === "G") required.G++
    else if (symbol === "C") required.C++
    else if (!isNaN(parseInt(symbol))) {
      required.generic += parseInt(symbol)
    }
  })

  // Check colored mana
  if (
    player.manaPool.W < required.W ||
    player.manaPool.U < required.U ||
    player.manaPool.B < required.B ||
    player.manaPool.R < required.R ||
    player.manaPool.G < required.G
  ) {
    return false
  }

  // Check total mana for generic cost
  const totalAvailable =
    player.manaPool.W +
    player.manaPool.U +
    player.manaPool.B +
    player.manaPool.R +
    player.manaPool.G +
    player.manaPool.C
  const totalRequired = required.W + required.U + required.B + required.R + required.G + required.C + required.generic

  const canAfford = totalAvailable >= totalRequired

  return canAfford
}

// Action: Spend mana (simplified - doesn't handle complex costs)
export function spendMana(gameState: GameState, playerId: string, manaCost: string): boolean {
  if (!canAffordManaCost(gameState, playerId, manaCost)) {
    return false
  }

  const player = gameState.players[playerId]
  const symbols = manaCost.match(/\{([^}]+)\}/g)?.map((s) => s.slice(1, -1)) || []

  // Spend colored mana first
  symbols.forEach((symbol) => {
    if (symbol === "W" && player.manaPool.W > 0) player.manaPool.W--
    else if (symbol === "U" && player.manaPool.U > 0) player.manaPool.U--
    else if (symbol === "B" && player.manaPool.B > 0) player.manaPool.B--
    else if (symbol === "R" && player.manaPool.R > 0) player.manaPool.R--
    else if (symbol === "G" && player.manaPool.G > 0) player.manaPool.G--
    else if (symbol === "C" && player.manaPool.C > 0) player.manaPool.C--
    else if (!isNaN(parseInt(symbol))) {
      // Generic mana - spend from any pool
      let remaining = parseInt(symbol)
      const colors: Array<keyof typeof player.manaPool> = ["W", "U", "B", "R", "G", "C"]
      for (const color of colors) {
        while (remaining > 0 && player.manaPool[color] > 0) {
          player.manaPool[color]--
          remaining--
        }
      }
    }
  })

  return true
}

// Helper: Calculate commander tax cost
function calculateCommanderCost(baseCost: string, taxCount: number): string {
  if (taxCount === 0) return baseCost

  // Add {2} for each time cast beyond the first
  const additionalCost = taxCount * 2

  // Parse base cost and add generic mana
  if (!baseCost) return `{${additionalCost}}`

  // Extract existing generic mana
  const genericMatch = baseCost.match(/\{(\d+)\}/)
  const existingGeneric = genericMatch ? parseInt(genericMatch[1]) : 0
  const newGeneric = existingGeneric + additionalCost

  // Replace or add generic cost
  if (genericMatch) {
    return baseCost.replace(/\{\d+\}/, `{${newGeneric}}`)
  } else {
    return `{${additionalCost}}` + baseCost
  }
}

// Action: Cast commander from command zone
export function castCommander(gameState: GameState, playerId: string): boolean {
  const player = gameState.players[playerId]

  // Check if there's a commander in command zone
  if (player.commandZone.length === 0) {
    console.log(`[COMMANDER] No commander in command zone`)
    return false
  }

  const commanderId = player.commandZone[0]
  const commander = gameState.entities[commanderId]

  // Calculate cost with tax
  const actualCost = calculateCommanderCost(commander.manaCost, player.commanderTax)

  // Check if can afford
  if (!canAffordManaCost(gameState, playerId, actualCost)) {
    console.log(`[COMMANDER] Cannot afford cost ${actualCost}`)
    return false
  }

  // Spend mana
  spendMana(gameState, playerId, actualCost)

  // Move from command zone to battlefield
  player.commandZone = player.commandZone.filter((id) => id !== commanderId)
  gameState.battlefield.push(commanderId)
  commander.zone = "BATTLEFIELD"
  commander.summoningSick = true

  // Initialize runtime ability state (v1.1)
  const { initializeRuntimeState } = require("./runtime-state-manager")
  const { loadAbilities } = require("./ability-loader")

  // Load abilities and apply effects (async - doesn't block game flow)
  loadAbilities(commander.dbReferenceId).then(async abilityData => {
    commander.runtimeAbilityState = await initializeRuntimeState(commander, abilityData || undefined)

    if (abilityData) {
      console.log(`[AbilitySystem] ${commander.name} using JSON abilities from database`)
      console.log(`[JSON-ABILITIES] ${commander.name} loaded abilities:`, JSON.stringify(abilityData.abilities, null, 2))

      // Apply ETB replacement effects from JSON
      if (abilityData.abilities.replacement) {
        for (const replacement of abilityData.abilities.replacement) {
          if (replacement.replaces === "etb") {
            // Check if this is a counter-adding replacement effect
            // The structure can be either replacement.effect or replacement.modification
            const effectData = replacement.effect || replacement.modification

            if (effectData?.action === "add_counters" && effectData.counters) {
              console.log(`[JSON-EFFECT] ETB replacement for ${commander.name}:`, JSON.stringify(replacement, null, 2))
              const amount = effectData.counters.amount || 0
              const counterType = effectData.counters.type || "p1p1"
              if (amount > 0 && counterType in commander.counters) {
                commander.counters[counterType as keyof typeof commander.counters] += amount
                console.log(`[AbilitySystem] Applied ETB replacement: ${commander.name} enters with ${amount} ${counterType} counters`)
              }
            }
          }
        }
      }

      const abilities = []
      if (commander.runtimeAbilityState?.saga) {
        abilities.push(`Saga (${commander.runtimeAbilityState.saga.maxChapters} chapters)`)
      }
      if (commander.runtimeAbilityState?.activeTriggeredAbilities.length > 0) {
        abilities.push(`${commander.runtimeAbilityState.activeTriggeredAbilities.length} triggered`)
      }
      if (commander.runtimeAbilityState?.activeReplacements.length > 0) {
        abilities.push(`${commander.runtimeAbilityState.activeReplacements.length} replacement`)
      }
      if (abilities.length > 0) {
        console.log(`[AbilitySystem] Initialized runtime state for ${commander.name}: ${abilities.join(', ')}`)
      }
    } else {
      console.log(`[AbilitySystem] ${commander.name} has no JSON abilities in database`)
    }

    // Trigger store update to reflect runtime state changes
    if (typeof window !== 'undefined') {
      const { useGameStore } = require('./store')
      useGameStore.setState({ gameState: { ...gameState } })
    }
  }).catch(err => {
    console.error(`[AbilitySystem] Failed to load abilities for ${commander.name}:`, err)

    // Trigger store update even on error
    if (typeof window !== 'undefined') {
      const { useGameStore } = require('./store')
      useGameStore.setState({ gameState: { ...gameState } })
    }
  })

  // Increment commander tax
  player.commanderTax++

  console.log(`[COMMANDER] Successfully cast ${commander.name} with tax ${player.commanderTax - 1}`)

  addGameLog(gameState, `cast commander from command zone`, "action", playerId, {
    cardName: commander.name,
    details: player.commanderTax > 1 ? `Commander tax: +${(player.commanderTax - 1) * 2}` : undefined,
  })

  return true
}

// Action: Cast a spell (uses stack system)
export async function castSpell(
  gameState: GameState,
  playerId: string,
  cardInstanceId: string,
  xValue: number = 0,
  targets: string[] = [],
  selectedModes?: number[],
): Promise<boolean> {
  const player = gameState.players[playerId]
  const card = gameState.entities[cardInstanceId]

  // Validate: Is it in hand?
  if (!player.hand.includes(cardInstanceId)) {
    return false
  }

  // Validate: Can afford mana cost?
  if (!canAffordManaCost(gameState, playerId, card.manaCost)) {
    return false
  }

  // Spend mana
  spendMana(gameState, playerId, card.manaCost)

  // Remove from hand and put on stack
  player.hand = player.hand.filter((id) => id !== cardInstanceId)
  card.zone = "STACK"

  addGameLog(gameState, `cast ${card.typeLine.toLowerCase().includes("instant") ? "instant" : card.typeLine.toLowerCase().includes("creature") ? "creature" : "spell"}`, "action", playerId, {
    cardName: card.name,
    cardText: card.oracleText || undefined,
    details: xValue > 0 ? `X=${xValue}` : undefined,
  })

  // Put spell on the stack
  await putSpellOnStack(gameState, cardInstanceId, playerId, xValue, targets, selectedModes)

  // Caster retains priority (can respond to their own spell)
  gameState.turnState.waitingForPriority = true
  gameState.turnState.priorityPasses = 0
  gameState.turnState.priorityPlayerId = playerId

  console.log(`[PRIORITY] ${gameState.players[playerId].name} retains priority after casting`)

  return true
}

// Put a spell on the stack
export async function putSpellOnStack(
  gameState: GameState,
  cardInstanceId: string,
  controllerId: string,
  xValue: number = 0,
  targets: string[] = [],
  selectedModes?: number[],
): Promise<void> {
  const card = gameState.entities[cardInstanceId]
  const stackItem: import("./types").StackItem = {
    id: `stack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: "SPELL",
    cardInstanceId,
    cardName: card.name,
    controllerId,
    targets,
    xValue,
    manaCost: card.manaCost,
    selectedModes,
  }

  gameState.turnState.stack.push(stackItem)
  console.log(`[STACK] ${card.name} added to stack (${gameState.turnState.stack.length} items) with ${targets.length} target(s)${selectedModes ? `, ${selectedModes.length} mode(s)` : ""}`)

  // Check for "cast_spell" triggers on battlefield permanents
  console.log('[CAST-SPELL-TRIGGER] Checking for cast_spell triggers on battlefield')
  for (const permanentId of gameState.battlefield) {
    const permanent = gameState.entities[permanentId]
    
    // Check if this permanent has JSON abilities with cast_spell triggers
    if (permanent.runtimeAbilityState?.activeTriggeredAbilities) {
      const { loadAbilities } = require("./ability-loader")
      const abilityData = await loadAbilities(permanent.dbReferenceId)
      
      try {
        if (abilityData?.abilities.triggered) {
          for (const trigger of abilityData.abilities.triggered) {
            if (trigger.trigger?.event === "cast_spell") {
              // Check trigger conditions
              let shouldTrigger = false
              
              if (trigger.trigger.controller === "you") {
                // Triggers when YOU cast a spell (permanent's controller casts)
                shouldTrigger = permanent.controllerId === controllerId
              } else if (trigger.trigger.conditions?.controller === "opponent") {
                // Triggers when OPPONENT casts a spell
                shouldTrigger = permanent.controllerId !== controllerId
              } else {
                // Triggers when ANY spell is cast
                shouldTrigger = true
              }
              
              if (shouldTrigger) {
                console.log(`[CAST-SPELL-TRIGGER] ${permanent.name} triggers on cast_spell (controller: ${trigger.trigger.controller || trigger.trigger.conditions?.controller}): ${trigger.effect.action}`)
                
                // Create trigger for proliferate or other cast_spell effects
                const { registerTrigger } = require("./card-effects")
                
                // Determine the effect type based on action and targets
                let effectType = trigger.effect.keywordAction || trigger.effect.action
                if (trigger.effect.action === "add_counters" && trigger.effect.targets?.type === "none") {
                  effectType = "add_counter_self"
                }
                
                // Convert JSON trigger to legacy format
                const legacyTrigger = {
                  trigger: "cast" as const,
                  effect: effectType,
                  amount: trigger.effect.keywordValue || trigger.effect.counters?.amount || trigger.effect.lifeGain?.amount || 1,
                  target: trigger.effect.targets?.type === "none" ? "self" : undefined,
                  cardName: permanent.name
                }
                
                registerTrigger(gameState, permanent, "cast", [legacyTrigger])
              }
            }
          }
        }
      } catch (err) {
        console.error(`[CAST-SPELL-TRIGGER] Failed to load abilities for ${permanent.name}:`, err)
      }
    }
  }
}

// Pass priority to the next player
export async function passPriority(gameState: GameState, autoContinueForBot: boolean = true): Promise<void> {
  console.log('[PRIORITY-ACTION] passPriority called')
  const playerIds = Object.keys(gameState.players)
  const currentIndex = playerIds.indexOf(gameState.turnState.priorityPlayerId)
  const nextIndex = (currentIndex + 1) % playerIds.length

  gameState.turnState.priorityPlayerId = playerIds[nextIndex]
  gameState.turnState.priorityPasses++

  console.log(`[PRIORITY] Passed to ${gameState.players[gameState.turnState.priorityPlayerId].name} (passes: ${gameState.turnState.priorityPasses})`)

  // If priority passed to bot and stack has items, auto-pass for bot
  if (autoContinueForBot && gameState.turnState.stack.length > 0) {
    const nextPlayer = gameState.players[gameState.turnState.priorityPlayerId]
    if (nextPlayer.name === "Bot") {
      console.log('[PRIORITY-ACTION] Bot received priority, auto-passing for bot')
      // Recursively pass priority for bot (without auto-continue to avoid infinite loop)
      await passPriority(gameState, false)
      return
    }
  }

  // If all players passed, resolve top of stack
  if (gameState.turnState.priorityPasses >= playerIds.length) {
    console.log('[PRIORITY-ACTION] All players passed, checking stack')
    if (gameState.turnState.stack.length > 0) {
      console.log('[PRIORITY-ACTION] Stack has items, resolving top')
      await resolveTopOfStack(gameState)
      console.log('[PRIORITY-ACTION] Stack item resolved')
      // Reset priority passes and give priority to active player
      gameState.turnState.priorityPasses = 0
      gameState.turnState.priorityPlayerId = gameState.turnState.activePlayerId

      // If stack is now empty, stop waiting for priority
      if (gameState.turnState.stack.length === 0) {
        console.log('[PRIORITY-ACTION] Stack empty, stopping priority')
        gameState.turnState.waitingForPriority = false
      }
    } else {
      console.log('[PRIORITY-ACTION] Stack empty, stopping priority')
      // Stack is empty, stop waiting
      gameState.turnState.waitingForPriority = false
      gameState.turnState.priorityPasses = 0
    }
  }
  console.log('[PRIORITY-ACTION] passPriority completed')
}

// Resolve the top item on the stack
export async function resolveTopOfStack(gameState: GameState): Promise<void> {
  if (gameState.turnState.stack.length === 0) {
    console.log(`[STACK] Nothing to resolve`)
    return
  }

  const stackItem = gameState.turnState.stack.pop()!
  console.log(`[STACK] Resolving ${stackItem.cardName}`)

  if (stackItem.type === "SPELL" && stackItem.cardInstanceId) {
    const card = gameState.entities[stackItem.cardInstanceId]
    const controller = gameState.players[stackItem.controllerId]

    // Check if it's a permanent
    if (
      card.typeLine.toLowerCase().includes("creature") ||
      card.typeLine.toLowerCase().includes("artifact") ||
      card.typeLine.toLowerCase().includes("enchantment") ||
      card.typeLine.toLowerCase().includes("planeswalker")
    ) {
      // Initialize runtime ability state (v1.1) - BEFORE moving to battlefield
      const { initializeRuntimeState } = require("./runtime-state-manager")
      const { loadAbilities } = require("./ability-loader")

      // Load abilities and apply effects synchronously
      const abilityData = await loadAbilities(card.dbReferenceId)
      card.runtimeAbilityState = await initializeRuntimeState(card, abilityData || undefined)

      if (abilityData) {
        console.log(`[AbilitySystem] ${card.name} using JSON abilities from database`)
        console.log(`[JSON-ABILITIES] ${card.name} loaded abilities:`, JSON.stringify(abilityData.abilities, null, 2))

        // Apply ETB replacement effects from JSON BEFORE moving to battlefield
        if (abilityData.abilities.replacement) {
          console.log(`[ETB-CHECK] ${card.name} has ${abilityData.abilities.replacement.length} replacement effects`)
          for (const replacement of abilityData.abilities.replacement) {
            console.log(`[ETB-CHECK] Checking replacement:`, replacement.replaces)
            if (replacement.replaces === "etb") {
              // Check if this is a counter-adding replacement effect
              // The structure can be either replacement.effect or replacement.modification
              const effectData = replacement.effect || replacement.modification
              console.log(`[ETB-CHECK] ETB replacement effectData:`, effectData)

              // Check for both 'action' and 'type' since JSON schema uses 'type'
              const isAddCounters = effectData?.action === "add_counters" || effectData?.type === "add_counters"
              if (isAddCounters && effectData.counters) {
                console.log(`[JSON-EFFECT] ETB replacement for ${card.name}:`, JSON.stringify(replacement, null, 2))
                const amount = effectData.counters.amount || 0
                const counterType = effectData.counters.type || "p1p1"
                console.log(`[ETB-COUNTER] Attempting to add ${amount} ${counterType} counters to ${card.name}`)
                console.log(`[ETB-COUNTER] Current counters before:`, JSON.stringify(card.counters))
                console.log(`[ETB-COUNTER] Counter type exists in card.counters:`, counterType in card.counters)
                if (amount > 0 && counterType in card.counters) {
                  card.counters[counterType as keyof typeof card.counters] += amount
                  console.log(`[ETB-COUNTER] ✅ Applied ${amount} ${counterType} counters to ${card.name}`)
                  console.log(`[ETB-COUNTER] Current counters after:`, JSON.stringify(card.counters))
                } else {
                  console.log(`[ETB-COUNTER] ❌ Failed to add counters - amount: ${amount}, exists: ${counterType in card.counters}`)
                }
              }
            }
          }
        }

        const abilities = []
        if (card.runtimeAbilityState?.saga) {
          abilities.push(`Saga (${card.runtimeAbilityState.saga.maxChapters} chapters)`)
        }
        if (card.runtimeAbilityState?.activeTriggeredAbilities.length > 0) {
          abilities.push(`${card.runtimeAbilityState.activeTriggeredAbilities.length} triggered`)
        }
        if (card.runtimeAbilityState?.activeReplacements.length > 0) {
          abilities.push(`${card.runtimeAbilityState.activeReplacements.length} replacement`)
        }
        if (abilities.length > 0) {
          console.log(`[AbilitySystem] Initialized runtime state for ${card.name}: ${abilities.join(', ')}`)
        }
      } else {
        console.log(`[AbilitySystem] ${card.name} has no JSON abilities in database`)
      }

      // NOW move from stack to battlefield (after counters are applied)
      gameState.battlefield.push(stackItem.cardInstanceId)
      card.zone = "BATTLEFIELD"

      // Register ETB triggers from JSON abilities
      if (abilityData?.abilities.triggered && abilityData.abilities.triggered.length > 0) {
        const hasETBTriggers = abilityData.abilities.triggered.some(
          trigger => trigger.trigger.event === "etb" || trigger.trigger.event === "self_etb"
        )

        if (hasETBTriggers) {
          // TODO: Implement proper JSON trigger registration
          // For now, still use text parsing but only if there are actual ETB triggers in JSON
          const triggers = parseTriggeredAbilities(card.oracleText || "", card.name)
          registerTrigger(gameState, card, "etb", triggers)
          console.log(`[AbilitySystem] Registered ETB triggers from JSON for ${card.name}`)
        }
      }

      // Check if permanent enters tapped
      if (checkEntersTapped(card.oracleText || "", card.name)) {
        card.tapped = true
        console.log(`[STACK] ${card.name} enters the battlefield tapped`)
      }

      // Creatures have summoning sickness
      if (card.typeLine.toLowerCase().includes("creature")) {
        card.summoningSick = true
      }

      // Attempt to auto-resolve ETB triggers
      resolveTriggers(gameState)

    } else {
      // Instant/Sorcery - execute effect and move to graveyard
      executeSpellEffect(gameState, card, stackItem.xValue, stackItem.selectedModes, stackItem.targets)
      controller.graveyard.push(stackItem.cardInstanceId)
      card.zone = "GRAVEYARD"
    }

    // Resolve any cast_spell triggers (e.g., Sunscorch Regent)
    // This needs to run for ALL spell types, not just permanents
    resolveTriggers(gameState)

    addGameLog(gameState, `resolved`, "effect", stackItem.controllerId, {
      cardName: card.name,
    })
  }
}

// Action: Declare attackers
export function declareAttackers(
  gameState: GameState,
  playerId: string,
  attackers: Array<{ attackerId: string; targetId: string }>,
): boolean {
  // Validate: It's the active player's turn
  if (gameState.turnState.activePlayerId !== playerId) {
    return false
  }

  // Validate: All attackers are controlled by player and can attack
  for (const attack of attackers) {
    const attacker = gameState.entities[attack.attackerId]
    if (
      attacker.controllerId !== playerId ||
      attacker.zone !== "BATTLEFIELD" ||
      attacker.tapped ||
      attacker.summoningSick ||
      !attacker.typeLine.toLowerCase().includes("creature")
    ) {
      return false
    }
  }

  // Tap all attackers
  attackers.forEach((attack) => {
    const attacker = gameState.entities[attack.attackerId]
    if (!attacker.keywords.includes("vigilance")) {
      tapPermanent(gameState, attack.attackerId)
    }

    // Phase 2: Register attack triggers
    const triggers = parseTriggeredAbilities(attacker.oracleText || "", attacker.name)
    registerTrigger(gameState, attacker, "attack", triggers)
  })

  // Resolve attack triggers
  resolveTriggers(gameState)

  // Set combat state
  gameState.combat = {
    attackers: attackers.map((a) => ({
      attackerId: a.attackerId,
      targetId: a.targetId,
      blocked: false,
      blockers: [],
    })),
  }

  // Log attackers
  attackers.forEach((attack) => {
    const attacker = gameState.entities[attack.attackerId]
    const target = gameState.players[attack.targetId]
    addGameLog(gameState, "declared attacker", "combat", playerId, {
      cardName: attacker.name,
      targetName: target.name,
      details: `${getCurrentStats(attacker).power}/${getCurrentStats(attacker).toughness}`,
    })
  })

  return true
}

// Action: Declare blockers
export function declareBlockers(
  gameState: GameState,
  playerId: string,
  blocks: Array<{ blockerId: string; attackerId: string }>,
): boolean {
  if (!gameState.combat) return false

  // Validate: It's the defending player's turn (blockers are declared by non-active player)
  if (gameState.turnState.activePlayerId === playerId) {
    return false
  }

  // Validate: All blockers are valid
  for (const block of blocks) {
    const blocker = gameState.entities[block.blockerId]
    const attack = gameState.combat.attackers.find((a) => a.attackerId === block.attackerId)

    if (!attack) return false
    if (!blocker) return false
    if (blocker.controllerId !== playerId) return false
    if (blocker.zone !== "BATTLEFIELD") return false
    if (blocker.tapped) return false
    if (!blocker.typeLine.toLowerCase().includes("creature")) return false

    // Check if blocker can block this attacker (flying rules)
    const attacker = gameState.entities[block.attackerId]
    if (!canBlock(blocker, attacker)) return false
  }

  // Assign blockers
  for (const block of blocks) {
    const attack = gameState.combat.attackers.find((a) => a.attackerId === block.attackerId)
    if (attack) {
      attack.blocked = true
      if (!attack.blockers.includes(block.blockerId)) {
        attack.blockers.push(block.blockerId)
      }
    }
  }

  // Validate menace: creatures with menace must be blocked by 2+ creatures
  for (const attack of gameState.combat.attackers) {
    const attacker = gameState.entities[attack.attackerId]
    const hasMenace = hasKeyword(attacker, "menace")
    
    if (hasMenace && attack.blocked && attack.blockers.length === 1) {
      console.log(`[COMBAT] ${attacker.name} has menace and must be blocked by 2+ creatures`)
      return false
    }
  }

  // Log blockers
  blocks.forEach((block) => {
    const blocker = gameState.entities[block.blockerId]
    const attacker = gameState.entities[block.attackerId]
    addGameLog(gameState, "declared blocker", "combat", playerId, {
      cardName: blocker.name,
      targetName: attacker.name,
      details: `${getCurrentStats(blocker).power}/${getCurrentStats(blocker).toughness} blocking`,
    })
  })

  console.log(`[COMBAT] ${blocks.length} blocker(s) declared`)
  return true
}

// Helper: Check if a creature can block another (flying/reach rules)
function canBlock(blocker: CardInstance, attacker: CardInstance): boolean {
  const attackerHasFlying = hasKeyword(attacker, "flying")
  const blockerHasFlying = hasKeyword(blocker, "flying")
  const blockerHasReach = hasKeyword(blocker, "reach")

  // Flying creatures can only be blocked by flying or reach
  if (attackerHasFlying && !blockerHasFlying && !blockerHasReach) {
    return false
  }

  return true
}

// Action: Combat damage
export function dealCombatDamage(gameState: GameState): void {
  if (!gameState.combat) return

  console.log(`[COMBAT-DEBUG] Starting combat damage resolution`)
  console.log(`[COMBAT-DEBUG] Battlefield before combat:`, gameState.battlefield)
  console.log(`[COMBAT-DEBUG] Number of attackers:`, gameState.combat.attackers.length)

  // Track creatures that need to die this turn
  const creaturesToDie: string[] = []
  const damageDealt: Record<string, number> = {} // Track damage on each creature

  // Process combat in two steps: first strike, then normal
  const processStrike = (strikeStep: "first" | "normal") => {
    gameState.combat!.attackers.forEach((attack) => {
      const attacker = gameState.entities[attack.attackerId]
      if (!attacker || attacker.zone !== "BATTLEFIELD") return

      // Check if creature participates in this strike step
      const hasFirstStrike = hasKeyword(attacker, "first strike")
      const hasDoubleStrike = hasKeyword(attacker, "double strike")
      
      if (strikeStep === "first" && !hasFirstStrike && !hasDoubleStrike) return
      if (strikeStep === "normal" && hasFirstStrike && !hasDoubleStrike) return

      const attackerStats = getCurrentStats(attacker)
      const { power } = attackerStats
      const attackerController = gameState.players[attacker.controllerId]

      if (power <= 0) return

      // Check combat keywords
      const hasTrample = hasKeyword(attacker, "trample")
      const hasLifelink = hasKeyword(attacker, "lifelink")
      const hasDeathtouch = hasKeyword(attacker, "deathtouch")

      if (attack.blocked && attack.blockers.length > 0) {
        // Attacker is blocked - deal damage to blockers
        let remainingDamage = power

        attack.blockers.forEach((blockerId) => {
          const blocker = gameState.entities[blockerId]
          if (!blocker || blocker.zone !== "BATTLEFIELD") return

          // Check if blocker already died in first strike step
          if (creaturesToDie.includes(blockerId)) return

          const blockerStats = getCurrentStats(blocker)
          const blockerController = gameState.players[blocker.controllerId]

          // Calculate damage to blocker
          let damageToBlocker: number
          if (hasDeathtouch) {
            // Deathtouch: any amount of damage is lethal
            damageToBlocker = Math.min(1, remainingDamage)
          } else {
            damageToBlocker = Math.min(remainingDamage, blockerStats.toughness)
          }

          // Blocker deals damage back to attacker
          const blockerHasFirstStrike = hasKeyword(blocker, "first strike")
          const blockerHasDoubleStrike = hasKeyword(blocker, "double strike")
          const blockerHasDeathtouch = hasKeyword(blocker, "deathtouch")
          const blockerHasLifelink = hasKeyword(blocker, "lifelink")
          
          // Check if blocker can deal damage in this step
          const blockerCanDealDamage = 
            (strikeStep === "first" && (blockerHasFirstStrike || blockerHasDoubleStrike)) ||
            (strikeStep === "normal" && (!blockerHasFirstStrike || blockerHasDoubleStrike))

          if (blockerCanDealDamage && blockerStats.power > 0 && !creaturesToDie.includes(attack.attackerId)) {
            const damageToAttacker = blockerHasDeathtouch ? 1 : blockerStats.power
            damageDealt[attack.attackerId] = (damageDealt[attack.attackerId] || 0) + damageToAttacker

            console.log(
              `[COMBAT] ${blocker.name} deals ${damageToAttacker} to ${attacker.name}${blockerHasDeathtouch ? " (deathtouch)" : ""}`
            )

            // Lifelink on blocker
            if (blockerHasLifelink) {
              blockerController.life += damageToAttacker
              console.log(`[COMBAT] ${blocker.name} gains ${damageToAttacker} life (lifelink)`)
            }

            // Check if attacker dies from blocker damage
            if (damageDealt[attack.attackerId] >= attackerStats.toughness || blockerHasDeathtouch) {
              if (!creaturesToDie.includes(attack.attackerId)) {
                creaturesToDie.push(attack.attackerId)
              }
            }
          }

          console.log(
            `[COMBAT] ${attacker.name} deals ${damageToBlocker} to ${blocker.name}${hasDeathtouch ? " (deathtouch)" : ""}`
          )

          damageDealt[blockerId] = (damageDealt[blockerId] || 0) + damageToBlocker
          remainingDamage -= damageToBlocker

          // Check if blocker dies
          if (damageDealt[blockerId] >= blockerStats.toughness || hasDeathtouch) {
            if (!creaturesToDie.includes(blockerId)) {
              console.log(`[COMBAT-DEBUG] Marking blocker ${blocker.name} (${blockerId}) to die - damage: ${damageDealt[blockerId]}, toughness: ${blockerStats.toughness}, deathtouch: ${hasDeathtouch}`)
              creaturesToDie.push(blockerId)
            }
          }
        })

        // Trample: excess damage goes to player
        if (hasTrample && remainingDamage > 0) {
          const targetPlayer = gameState.players[attack.targetId]
          if (targetPlayer) {
            targetPlayer.life -= remainingDamage
            console.log(`[COMBAT] ${attacker.name} tramples ${remainingDamage} damage to ${targetPlayer.name}`)

            // Lifelink on trample damage
            if (hasLifelink) {
              attackerController.life += remainingDamage
            }

            // Check for lethal
            if (targetPlayer.life <= 0) {
              gameState.status = "ENDED"
              gameState.winner = gameState.turnState.activePlayerId
            }
          }
        }

        // Lifelink on blocked damage
        if (hasLifelink) {
          const damageDealtToBlockers = power - remainingDamage
          attackerController.life += damageDealtToBlockers
          console.log(`[COMBAT] ${attacker.name} gains ${damageDealtToBlockers} life (lifelink)`)
        }

      } else {
        // Attacker is not blocked - deal damage to player
        const targetPlayer = gameState.players[attack.targetId]
        if (targetPlayer) {
          targetPlayer.life -= power

          // Track commander damage (if this is a commander/legendary creature)
          if (attacker.typeLine.toLowerCase().includes("legendary creature")) {
            targetPlayer.commanderDamageTaken[attack.attackerId] =
              (targetPlayer.commanderDamageTaken[attack.attackerId] || 0) + power
          }

          console.log(`[COMBAT] ${attacker.name} dealt ${power} damage to ${targetPlayer.name}`)

          // Lifelink
          if (hasLifelink) {
            attackerController.life += power
            console.log(`[COMBAT] ${attacker.name} gains ${power} life (lifelink)`)
          }

          // Phase 2: Register damage triggers
          const triggers = parseTriggeredAbilities(attacker.oracleText || "", attacker.name)
          registerTrigger(gameState, attacker, "damage", triggers)

          // Check for lethal
          if (targetPlayer.life <= 0) {
            gameState.status = "ENDED"
            gameState.winner = gameState.turnState.activePlayerId
          }

          // Check for commander damage lethal
          if (targetPlayer.commanderDamageTaken[attack.attackerId] >= 21) {
            gameState.status = "ENDED"
            gameState.winner = gameState.turnState.activePlayerId
          }
        }
      }
    })
  }

  // First strike damage step
  processStrike("first")

  // Normal damage step
  processStrike("normal")

  // Move dead creatures to graveyard (or exile if tokens)
  console.log(`[COMBAT-DEBUG] Processing ${creaturesToDie.length} creatures to die:`, creaturesToDie)
  for (const creatureId of creaturesToDie) {
    const creature = gameState.entities[creatureId]
    console.log(`[COMBAT-DEBUG] Processing death for ${creatureId}: exists=${!!creature}, zone=${creature?.zone}`)
    if (creature && creature.zone === "BATTLEFIELD") {
      const controller = gameState.players[creature.controllerId]
      console.log(`[COMBAT-DEBUG] Moving ${creature.name} (${creatureId}) from BATTLEFIELD to ${creature.isToken ? "EXILE" : "GRAVEYARD"}`)
      gameState.battlefield = gameState.battlefield.filter((id) => id !== creatureId)
      console.log(`[COMBAT-DEBUG] Battlefield after removal:`, gameState.battlefield)
      
      if (creature.isToken) {
        // Tokens are exiled when they die, not put in graveyard
        creature.zone = "EXILE"
        console.log(`[COMBAT] ${creature.name} (token) exiled`)
        // Don't add to any zone array - tokens cease to exist
        delete gameState.entities[creatureId]
      } else {
        controller.graveyard.push(creatureId)
        creature.zone = "GRAVEYARD"
        console.log(`[COMBAT] ${creature.name} died - added to graveyard of ${controller.name}`)
        console.log(`[COMBAT-DEBUG] Graveyard after:`, controller.graveyard)
      }
    } else if (creature) {
      console.log(`[COMBAT-DEBUG] WARNING: Creature ${creature.name} (${creatureId}) not on battlefield (zone: ${creature.zone})`)
    } else {
      console.log(`[COMBAT-DEBUG] WARNING: Creature ${creatureId} not found in entities`)
    }
  }

  // Clear combat
  gameState.combat = undefined
}

// Phase 5: Activate an ability on a permanent
export async function activateAbility(
  gameState: GameState,
  playerId: string,
  cardInstanceId: string,
  abilityIndex: number,
  targetCardId?: string,
): Promise<boolean> {
  const player = gameState.players[playerId]
  const card = gameState.entities[cardInstanceId]

  // Validate: Card is on battlefield
  if (card.zone !== "BATTLEFIELD") {
    console.log(`[ABILITY] Card ${card.name} not on battlefield`)
    return false
  }

  // Validate: Player controls the card
  if (card.controllerId !== playerId) {
    console.log(`[ABILITY] Player doesn't control ${card.name}`)
    return false
  }

  // Load JSON abilities
  const { loadAbilities } = require("./ability-loader")
  const abilityData = await loadAbilities(card.dbReferenceId)

  let abilities: ActivatedAbility[] = []

  if (!abilityData?.abilities.activated || abilityData.abilities.activated.length === 0) {
    console.log(`[AbilitySystem] ${card.name} has no JSON activated abilities`)
    return false
  }

  console.log(`[AbilitySystem] Using JSON activated abilities for ${card.name}`)
  // Convert JSON activated abilities to game format
  abilities = abilityData.abilities.activated.map((jsonAbility: any) => {
    const gameAbility: ActivatedAbility = {
      cost: jsonAbility.cost || {},
      effect: jsonAbility.effect?.action || "unknown",
      timing: jsonAbility.timing || "instant",
    }

    // Check for additional costs (not yet implemented)
    if (jsonAbility.cost?.additionalCosts && jsonAbility.cost.additionalCosts.length > 0) {
      gameAbility.hasAdditionalCosts = true
      console.log(`[AbilitySystem] ${card.name} ability has additional costs (not yet supported)`)
    }

    // Handle mana-adding abilities
    if (jsonAbility.effect?.action === "add_mana") {
      if (jsonAbility.effect.mana?.colors) {
        gameAbility.manaToAdd = jsonAbility.effect.mana.colors
      }
      gameAbility.amount = jsonAbility.effect.mana?.amount
    }

    // Handle abilities with targets
    if (jsonAbility.effect?.targets) {
      gameAbility.target = "target"
      gameAbility.targetRestriction = jsonAbility.effect.targets.restriction
      gameAbility.targetFilters = jsonAbility.effect.targets.filters
    }

    // Handle counter-adding abilities
    if (jsonAbility.effect?.action === "add_counters") {
      gameAbility.amount = jsonAbility.effect.counters?.amount
      gameAbility.counterType = jsonAbility.effect.counters?.type
    }

    return gameAbility
  })

  if (abilityIndex < 0 || abilityIndex >= abilities.length) {
    console.log(`[ABILITY] Invalid ability index ${abilityIndex}`)
    return false
  }

  const ability = abilities[abilityIndex]

  // Check for unsupported additional costs
  if ((ability as any).hasAdditionalCosts) {
    console.log(`[ABILITY] ${card.name} ability requires additional costs (not yet implemented)`)
    return false
  }

  // Validate timing
  if (ability.timing === "sorcery") {
    const phase = gameState.turnState.phase
    const isActivePlayer = gameState.turnState.activePlayerId === playerId
    const isMainPhase = phase === "MAIN_1" || phase === "MAIN_2"
    
    if (!isActivePlayer || !isMainPhase) {
      console.log(`[ABILITY] Sorcery-speed ability can only be activated during your main phase`)
      return false
    }
  }

  // Validate and pay costs
  if (ability.cost.tap) {
    if (card.tapped) {
      console.log(`[ABILITY] ${card.name} is already tapped`)
      return false
    }
    if (card.summoningSick && card.typeLine.toLowerCase().includes("creature")) {
      console.log(`[ABILITY] ${card.name} has summoning sickness`)
      return false
    }
  }

  if (ability.cost.mana) {
    if (!canAffordManaCost(gameState, playerId, ability.cost.mana)) {
      return false
    }
  }

  if (ability.cost.sacrifice) {
    // Will sacrifice the permanent after effect resolves
  }

  if (ability.cost.discardCount && ability.cost.discardCount > 0) {
    if (player.hand.length < ability.cost.discardCount) {
      console.log(`[ABILITY] Not enough cards to discard`)
      return false
    }
  }

  // Validate target if needed
  if (ability.target && ability.target !== "self" && !targetCardId) {
    console.log(`[ABILITY] Ability requires a target`)
    return false
  }

  // Pay costs
  if (ability.cost.tap) {
    tapPermanent(gameState, cardInstanceId)
  }

  if (ability.cost.mana) {
    spendMana(gameState, playerId, ability.cost.mana)
  }

  if (ability.cost.discardCount && ability.cost.discardCount > 0) {
    // Discard random cards
    for (let i = 0; i < ability.cost.discardCount; i++) {
      if (player.hand.length > 0) {
        const cardToDiscard = player.hand[0]
        discardCard(gameState, playerId, cardToDiscard)
      }
    }
  }

  // Execute effect
  executeAbilityEffect(gameState, card, ability, targetCardId)

  // Pay sacrifice cost after effect
  if (ability.cost.sacrifice) {
    player.graveyard.push(cardInstanceId)
    gameState.battlefield = gameState.battlefield.filter((id) => id !== cardInstanceId)
    card.zone = "GRAVEYARD"
    console.log(`[ABILITY] Sacrificed ${card.name}`)
  }

  console.log(`[ABILITY] Activated ${ability.effect} ability on ${card.name}`)
  return true
}

// Helper: Execute ability effect
function executeAbilityEffect(
  gameState: GameState,
  sourceCard: CardInstance,
  ability: ActivatedAbility,
  targetCardId?: string,
): void {
  switch (ability.effect) {
    case "deal_damage":
      if (targetCardId) {
        const target = gameState.entities[targetCardId]
        if (target) {
          // Deal damage to creature
          const { toughness } = getCurrentStats(target)
          const damage = ability.amount || 0
          
          console.log(`[ABILITY] ${sourceCard.name} deals ${damage} damage to ${target.name}`)
          
          // Check if creature dies
          if (damage >= toughness) {
            const controller = gameState.players[target.controllerId]
            gameState.battlefield = gameState.battlefield.filter((id) => id !== targetCardId)
            controller.graveyard.push(targetCardId)
            target.zone = "GRAVEYARD"
            console.log(`[ABILITY] ${target.name} died`)
          }
        } else {
          // Target is a player
          const player = gameState.players[targetCardId]
          if (player) {
            const damage = ability.amount || 0
            player.life -= damage
            console.log(`[ABILITY] ${sourceCard.name} deals ${damage} damage to ${player.name}`)
            
            if (player.life <= 0) {
              gameState.status = "ENDED"
              gameState.winner = sourceCard.controllerId
            }
          }
        }
      }
      break

    case "add_mana":
      // Add mana to controller's mana pool
      if (ability.manaToAdd && ability.manaToAdd.length > 0) {
        const player = gameState.players[sourceCard.controllerId]
        const amount = ability.amount || 1

        ability.manaToAdd.forEach(color => {
          // Normalize color string (handle both "C" and "colorless")
          const normalizedColor = color === "colorless" ? "C" : color

          if (normalizedColor === "W") player.manaPool.W += amount
          else if (normalizedColor === "U") player.manaPool.U += amount
          else if (normalizedColor === "B") player.manaPool.B += amount
          else if (normalizedColor === "R") player.manaPool.R += amount
          else if (normalizedColor === "G") player.manaPool.G += amount
          else if (normalizedColor === "C") player.manaPool.C += amount
        })

        console.log(`[AbilitySystem] Added ${amount} mana of ${ability.manaToAdd.join(', ')} to ${player.name}'s pool`)
      }
      break

    case "draw_card":
      const amount = ability.amount || 1
      for (let i = 0; i < amount; i++) {
        drawCard(gameState, sourceCard.controllerId)
      }
      break

    case "add_counter":
    case "add_counters":
      if (targetCardId) {
        const target = gameState.entities[targetCardId]
        if (target) {
          const counterType = (ability as any).counterType || "p1p1"
          const amount = ability.amount || 1

          if (counterType in target.counters) {
            target.counters[counterType as keyof typeof target.counters] += amount
            console.log(`[AbilitySystem] Added ${amount} ${counterType} counter(s) to ${target.name}`)
          } else {
            console.log(`[ABILITY] Unknown counter type: ${counterType}`)
          }
        }
      } else {
        const counterType = (ability as any).counterType || "p1p1"
        const amount = ability.amount || 1

        if (counterType in sourceCard.counters) {
          sourceCard.counters[counterType as keyof typeof sourceCard.counters] += amount
          console.log(`[AbilitySystem] Added ${amount} ${counterType} counter(s) to ${sourceCard.name}`)
        } else {
          console.log(`[ABILITY] Unknown counter type: ${counterType}`)
        }
      }
      break
  }
}

/**
 * Execute spell effects for instants and sorceries
 * Now uses generic parser and executor
 */
function executeSpellEffect(
  gameState: GameState,
  spell: CardInstance,
  xValue: number = 0,
  selectedModes?: number[],
  selectedTargets?: string[],
  selectedCard?: string
): void {
  const controllerId = spell.controllerId

  // Import parser and executor
  const { parseSpellEffect } = require("./spell-parser")
  const { executeSpellEffect: executeGenericSpellEffect } = require("./spell-executor")

  // Parse the spell's effects from oracle text
  const oracleText = spell.oracleText || ""
  const effects = parseSpellEffect(oracleText, spell.name)

  console.log(`[SPELL] ${spell.name}: Parsed ${effects.length} effect(s)`)

  // Create execution context
  const context = {
    gameState,
    spell,
    controllerId,
    selectedModes,
    selectedTargets,
    selectedCard,
  }

  // Execute each effect
  effects.forEach((effect) => {
    executeGenericSpellEffect(context, effect)
  })
}

// Action: End turn and move to next phase
export function advancePhase(gameState: GameState): void {
  const currentPhase = gameState.turnState.phase
  const nextPhase = getNextPhase(currentPhase)

  console.log(`[PHASE] Advancing from ${currentPhase} to ${nextPhase}`)
  
  // If we wrapped around to UNTAP, switch to the next player BEFORE setting the phase
  // This ensures the new active player is set when we log and execute UNTAP phase
  if (nextPhase === "UNTAP") {
    const playerIds = Object.keys(gameState.players)
    const currentActiveIndex = playerIds.indexOf(gameState.turnState.activePlayerId)
    const nextActiveIndex = (currentActiveIndex + 1) % playerIds.length

    gameState.turnState.activePlayerId = playerIds[nextActiveIndex]
    gameState.turnState.priorityPlayerId = playerIds[nextActiveIndex]
    gameState.turnState.turnNumber++

    // Reset turn-based flags
    const newActivePlayer = gameState.players[gameState.turnState.activePlayerId]
    newActivePlayer.flags.landsPlayedThisTurn = 0
  }

  // Set the phase AFTER potentially switching players
  gameState.turnState.phase = nextPhase

  // Log phase change with correct active player
  const activePlayer = gameState.players[gameState.turnState.activePlayerId]
  addGameLog(gameState, `advanced to ${nextPhase.replace(/_/g, " ")}`, "phase", activePlayer.id, {
    details: nextPhase === "UNTAP" ? `Turn ${gameState.turnState.turnNumber} begins` : undefined,
  })

  // Handle phase-specific actions
  if (nextPhase === "UNTAP") {
    // Untap all permanents controlled by active player (handle stun counters)
    const activePlayerId = gameState.turnState.activePlayerId
    const { handleStunCounters } = require("./runtime-state-manager")

    console.log(`[PHASE-DEBUG] UNTAP phase - battlefield has ${gameState.battlefield.length} cards:`, gameState.battlefield)
    
    // Clean up battlefield array - remove any cards that aren't actually on battlefield
    const validBattlefieldCards = gameState.battlefield.filter(cardId => {
      const card = gameState.entities[cardId]
      if (!card) {
        console.log(`[PHASE-DEBUG] Removing ${cardId} - card doesn't exist`)
        return false
      }
      if (card.zone !== "BATTLEFIELD") {
        console.log(`[PHASE-DEBUG] Removing ${card.name} (${cardId}) - zone is ${card.zone}, not BATTLEFIELD`)
        return false
      }
      return true
    })
    
    if (validBattlefieldCards.length !== gameState.battlefield.length) {
      console.log(`[PHASE-DEBUG] Cleaned battlefield: ${gameState.battlefield.length} -> ${validBattlefieldCards.length}`)
      gameState.battlefield = validBattlefieldCards
    }
    
    gameState.battlefield.forEach((cardId) => {
      const card = gameState.entities[cardId]
      console.log(`[PHASE-DEBUG] Processing ${card.name} (${cardId}) - zone: ${card.zone}, controller: ${card.controllerId}`)
      if (card.controllerId === activePlayerId) {
        // Check stun counters BEFORE untapping
        const canUntap = handleStunCounters(card)
        if (canUntap) {
          untapPermanent(gameState, cardId)
        }
        card.summoningSick = false
      }
    })

    // Empty mana pools (skip in dev mode)
    if (!gameState.devMode) {
      Object.values(gameState.players).forEach((player) => {
        player.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
      })
    }
  }

  if (nextPhase === "UPKEEP") {
    // Progress Sagas for active player
    const activePlayerId = gameState.turnState.activePlayerId
    const { progressSagaChapter } = require("./runtime-state-manager")
    const { loadAbilities } = require("./ability-loader")

    // Find all Sagas controlled by active player
    const sagas = gameState.battlefield
      .map(id => gameState.entities[id])
      .filter(card =>
        card.controllerId === activePlayerId &&
        card.runtimeAbilityState?.saga
      )

    // Progress each Saga (async handled outside or simplified)
    sagas.forEach(async (saga) => {
      const newChapter = progressSagaChapter(saga)

      if (newChapter === null) {
        // Saga is complete
        console.log(`[Saga] ${saga.name} - Complete`)

        // Load abilities to check if it's a creature
        const abilities = await loadAbilities(saga.dbReferenceId)
        if (!abilities?.abilities.saga?.isCreature) {
          // Sacrifice non-creature Sagas
          moveCardToZone(gameState, saga.instanceId, "GRAVEYARD")
        }
      } else {
        console.log(`[Saga] ${saga.name} - Chapter ${newChapter}`)

        // Load abilities and queue chapter trigger
        const abilities = await loadAbilities(saga.dbReferenceId)
        if (abilities) {
          const chapter = abilities.abilities.saga?.chapters.find(ch =>
            ch.chapterNumber.includes(newChapter)
          )

          if (chapter) {
            // Register chapter trigger (simplified - would normally go to stack)
            console.log(`[Saga] ${saga.name} - Chapter ${newChapter} effect queued`)
            // TODO: Implement chapter effect execution
          }
        }
      }
    })
  }

  if (nextPhase === "DRAW") {
    // Active player draws a card (skip on turn 1 for first player)
    if (gameState.turnState.turnNumber > 1 || gameState.turnState.activePlayerId !== Object.keys(gameState.players)[0]) {
      drawCard(gameState, gameState.turnState.activePlayerId)
    }
  }

  if (nextPhase === "MAIN_1" || nextPhase === "MAIN_2") {
    gameState.players[gameState.turnState.activePlayerId].flags.canCastSorcery = true
  } else {
    Object.values(gameState.players).forEach((player) => {
      player.flags.canCastSorcery = false
    })
  }

  if (nextPhase === "COMBAT_DAMAGE" && gameState.combat) {
    dealCombatDamage(gameState)
  }

  if (nextPhase === "COMBAT_END") {
    // Cleanup end-of-combat effects
    const { cleanupExpiredEffects } = require("./runtime-state-manager")

    Object.values(gameState.entities).forEach(card => {
      cleanupExpiredEffects(card, "end_of_combat")
    })
  }

  if (nextPhase === "CLEANUP") {
    // Cleanup end-of-turn effects (v1.1)
    const { cleanupExpiredEffects } = require("./runtime-state-manager")

    Object.values(gameState.entities).forEach(card => {
      cleanupExpiredEffects(card, "end_of_turn")
    })

    // Empty mana pools, remove temporary effects, etc. (skip mana clearing in dev mode)
    Object.values(gameState.players).forEach((player) => {
      if (!gameState.devMode) {
        player.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
      }

      // Check hand size (maximum 7 cards)
      const maxHandSize = 7
      if (player.hand.length > maxHandSize) {
        const cardsToDiscard = player.hand.length - maxHandSize
        console.log(`[CLEANUP] ${player.name} has ${player.hand.length} cards, must discard ${cardsToDiscard}`)

        // Check if this is a bot player (auto-discard) or human player (set flag for UI)
        const isBotPlayer = player.id.includes("bot")

        if (isBotPlayer) {
          // Auto-discard lowest CMC cards for bot
          const sortedHand = [...player.hand].sort((a, b) => {
            const cardA = gameState.entities[a]
            const cardB = gameState.entities[b]
            return cardA.cmc - cardB.cmc
          })

          for (let i = 0; i < cardsToDiscard; i++) {
            const cardToDiscard = sortedHand[i]
            discardCard(gameState, player.id, cardToDiscard)
          }
        } else {
          // Set flag for human player to choose discards via UI
          player.pendingDiscards = cardsToDiscard
          console.log(`[CLEANUP] Human player needs to discard ${cardsToDiscard} cards`)
        }
      }
    })
  }
}

// Helper: Advance to the next interactive phase
export function advanceToNextInteractivePhase(gameState: GameState): void {
  console.log(`[PHASE] advanceToNextInteractivePhase called, current phase: ${gameState.turnState.phase}`)
  let iterations = 0
  const maxIterations = 20 // Safety limit

  // Check if any player has pending discards - if so, don't auto-advance
  const hasPendingDiscards = Object.values(gameState.players).some((player) => player.pendingDiscards > 0)
  if (hasPendingDiscards) {
    console.log(`[PHASE] Cannot auto-advance - player has pending discards`)
    return
  }

  // Keep advancing until we hit an interactive phase
  while (!isInteractivePhase(gameState.turnState.phase) && iterations < maxIterations) {
    console.log(`[PHASE] Auto-advancing iteration ${iterations}`)
    advancePhase(gameState)
    iterations++

    // Check again after each advance
    const stillHasPendingDiscards = Object.values(gameState.players).some((player) => player.pendingDiscards > 0)
    if (stillHasPendingDiscards) {
      console.log(`[PHASE] Stopping auto-advance - player needs to discard`)
      return
    }
  }
  console.log(`[PHASE] Stopped at ${gameState.turnState.phase} after ${iterations} iterations`)
}
