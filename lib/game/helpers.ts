import type { GameState, CardInstance, PlayerState } from "./types"
import { canAffordManaCost } from "./actions"

// Check if a card can be played/cast
export function isCardPlayable(
  card: CardInstance,
  gameState: GameState,
  playerId: string,
  currentPhase: string,
): boolean {
  const player = gameState.players[playerId]

  // Card must be in hand
  if (card.zone !== "HAND") {
    console.log(`[PLAYABLE] ${card.name} not in hand (zone: ${card.zone})`)
    return false
  }

  // Check if it's a land
  if (card.typeLine.toLowerCase().includes("land")) {
    const canPlay = player.flags.landsPlayedThisTurn < player.flags.maxLandsPerTurn
    console.log(`[PLAYABLE] ${card.name} is land, can play: ${canPlay}`)
    return canPlay
  }

  // For other cards, check if can afford mana cost
  const canAfford = canAffordManaCost(gameState, playerId, card.manaCost)
  if (!canAfford) {
    console.log(`[PLAYABLE] ${card.name} cannot afford mana cost`)
    return false
  }

  // Check if it's an instant
  const isInstant = card.typeLine.toLowerCase().includes("instant")

  if (isInstant) {
    // Instants can be cast any time the player has priority
    console.log(`[PLAYABLE] ${card.name} is an instant, can cast anytime with priority`)
    return true
  }

  // Sorcery-speed cards (sorcery, creature, artifact, enchantment, planeswalker)
  // can only be cast during main phases when the stack is empty
  const isSorcerySpeed =
    card.typeLine.toLowerCase().includes("sorcery") ||
    card.typeLine.toLowerCase().includes("creature") ||
    card.typeLine.toLowerCase().includes("enchantment") ||
    card.typeLine.toLowerCase().includes("artifact") ||
    card.typeLine.toLowerCase().includes("planeswalker")

  if (isSorcerySpeed) {
    const isMainPhase = currentPhase === "MAIN_1" || currentPhase === "MAIN_2"
    const stackIsEmpty = gameState.turnState.stack.length === 0
    const isActivePlayer = gameState.turnState.activePlayerId === playerId
    const canCast = isMainPhase && stackIsEmpty && isActivePlayer

    console.log(`[PLAYABLE] ${card.name} is sorcery-speed, main phase: ${isMainPhase}, stack empty: ${stackIsEmpty}, active: ${isActivePlayer}, can cast: ${canCast}`)
    return canCast
  }

  // Unknown card type - default to sorcery speed
  console.log(`[PLAYABLE] ${card.name} has unknown type, defaulting to sorcery-speed rules`)
  return false
}

// Check if a card is a land that can be played
export function isLandPlayable(card: CardInstance, player: PlayerState): boolean {
  if (card.zone !== "HAND") return false
  if (!card.typeLine.toLowerCase().includes("land")) return false

  return player.flags.landsPlayedThisTurn < player.flags.maxLandsPerTurn
}

// Check if commander can be cast
export function isCommanderCastable(gameState: GameState, playerId: string): boolean {
  const player = gameState.players[playerId]

  if (player.commandZone.length === 0) return false

  const commanderId = player.commandZone[0]
  const commander = gameState.entities[commanderId]

  // Calculate cost with tax
  const taxCost = player.commanderTax * 2
  const baseCost = commander.manaCost || ""

  // For simplicity, check if we have enough total mana
  const totalMana =
    player.manaPool.W +
    player.manaPool.U +
    player.manaPool.B +
    player.manaPool.R +
    player.manaPool.G +
    player.manaPool.C

  // Very simplified check - just see if total mana >= tax
  return totalMana >= taxCost
}
