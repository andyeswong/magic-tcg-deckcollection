import type { GameState, CardInstance, Phase } from "./types"

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
  const interactivePhases: Phase[] = ["DRAW", "MAIN_1", "DECLARE_ATTACKERS", "MAIN_2"]

  const result = interactivePhases.includes(phase)
  console.log(`[PHASE] Is ${phase} interactive? ${result}`)
  return result
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
  gameState.entities[cardId].zone = "HAND"
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

  // Increment lands played
  player.flags.landsPlayedThisTurn++

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

  return totalAvailable >= totalRequired
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

// Action: Cast a spell (simplified)
export function castSpell(gameState: GameState, playerId: string, cardInstanceId: string): boolean {
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

  // Remove from hand
  player.hand = player.hand.filter((id) => id !== cardInstanceId)

  // If it's a permanent, put on battlefield
  if (
    card.typeLine.toLowerCase().includes("creature") ||
    card.typeLine.toLowerCase().includes("artifact") ||
    card.typeLine.toLowerCase().includes("enchantment") ||
    card.typeLine.toLowerCase().includes("planeswalker")
  ) {
    gameState.battlefield.push(cardInstanceId)
    card.zone = "BATTLEFIELD"

    // Creatures have summoning sickness
    if (card.typeLine.toLowerCase().includes("creature")) {
      card.summoningSick = true
    }
  } else {
    // Instant/Sorcery - resolve immediately (simplified, should use stack)
    player.graveyard.push(cardInstanceId)
    card.zone = "GRAVEYARD"
  }

  return true
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
  })

  // Set combat state
  gameState.combat = {
    attackers: attackers.map((a) => ({
      attackerId: a.attackerId,
      targetId: a.targetId,
      blocked: false,
      blockers: [],
    })),
  }

  return true
}

// Action: Combat damage (simplified - no blockers)
export function dealCombatDamage(gameState: GameState): void {
  if (!gameState.combat) return

  gameState.combat.attackers.forEach((attack) => {
    const attacker = gameState.entities[attack.attackerId]
    const power = parseInt(attacker.power || "0")

    if (power > 0 && !attack.blocked) {
      // Deal damage to player
      const targetPlayer = gameState.players[attack.targetId]
      if (targetPlayer) {
        targetPlayer.life -= power

        // Track commander damage
        if (attacker.zone === "COMMAND" || attacker.typeLine.toLowerCase().includes("legendary creature")) {
          targetPlayer.commanderDamageTaken[attack.attackerId] =
            (targetPlayer.commanderDamageTaken[attack.attackerId] || 0) + power
        }

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

  // Clear combat
  gameState.combat = undefined
}

// Action: End turn and move to next phase
export function advancePhase(gameState: GameState): void {
  const currentPhase = gameState.turnState.phase
  const nextPhase = getNextPhase(currentPhase)

  console.log(`[PHASE] Advancing from ${currentPhase} to ${nextPhase}`)
  gameState.turnState.phase = nextPhase

  // If we wrapped around to UNTAP, it's a new turn
  if (nextPhase === "UNTAP") {
    const playerIds = Object.keys(gameState.players)
    const currentActiveIndex = playerIds.indexOf(gameState.turnState.activePlayerId)
    const nextActiveIndex = (currentActiveIndex + 1) % playerIds.length

    gameState.turnState.activePlayerId = playerIds[nextActiveIndex]
    gameState.turnState.priorityPlayerId = playerIds[nextActiveIndex]
    gameState.turnState.turnNumber++

    // Reset turn-based flags
    const activePlayer = gameState.players[gameState.turnState.activePlayerId]
    activePlayer.flags.landsPlayedThisTurn = 0
  }

  // Handle phase-specific actions
  if (nextPhase === "UNTAP") {
    // Untap all permanents controlled by active player
    const activePlayerId = gameState.turnState.activePlayerId
    gameState.battlefield.forEach((cardId) => {
      const card = gameState.entities[cardId]
      if (card.controllerId === activePlayerId) {
        untapPermanent(gameState, cardId)
        card.summoningSick = false
      }
    })

    // Empty mana pools
    Object.values(gameState.players).forEach((player) => {
      player.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
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

  if (nextPhase === "CLEANUP") {
    // Empty mana pools, remove temporary effects, etc.
    Object.values(gameState.players).forEach((player) => {
      player.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
    })
  }
}

// Helper: Advance to the next interactive phase
export function advanceToNextInteractivePhase(gameState: GameState): void {
  console.log(`[PHASE] advanceToNextInteractivePhase called, current phase: ${gameState.turnState.phase}`)
  let iterations = 0
  const maxIterations = 20 // Safety limit

  // Keep advancing until we hit an interactive phase
  while (!isInteractivePhase(gameState.turnState.phase) && iterations < maxIterations) {
    console.log(`[PHASE] Auto-advancing iteration ${iterations}`)
    advancePhase(gameState)
    iterations++
  }
  console.log(`[PHASE] Stopped at ${gameState.turnState.phase} after ${iterations} iterations`)
}
