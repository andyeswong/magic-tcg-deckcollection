import type { GameState, CardInstance } from "./types"
import * as actions from "./actions"

/**
 * Simple Bot AI for testing the game engine
 *
 * Strategy:
 * 1. Main Phase: Play a land if available
 * 2. Main Phase: Cast the highest CMC spell affordable
 * 3. Combat: Attack with all available creatures
 * 4. Always pass priority immediately
 */

export class SimpleBot {
  private botPlayerId: string

  constructor(botPlayerId: string) {
    this.botPlayerId = botPlayerId
  }

  // Main decision-making function
  makeDecision(gameState: GameState): void {
    // Only act if it's bot's turn
    if (gameState.turnState.activePlayerId !== this.botPlayerId) {
      return
    }

    const phase = gameState.turnState.phase

    // Main phases - play lands and spells
    if (phase === "MAIN_1" || phase === "MAIN_2") {
      this.playMainPhase(gameState)
    }

    // Combat phase - declare attackers
    if (phase === "DECLARE_ATTACKERS") {
      this.declareAttacks(gameState)
    }
  }

  private playMainPhase(gameState: GameState): void {
    const botPlayer = gameState.players[this.botPlayerId]

    // Step 1: Try to play a land
    this.tryPlayLand(gameState, botPlayer)

    // Step 2: Tap lands for mana
    this.tapLandsForMana(gameState)

    // Step 3: Cast spells (highest CMC first)
    this.castSpells(gameState, botPlayer)
  }

  private tryPlayLand(gameState: GameState, botPlayer: any): void {
    // Check if can play land
    if (botPlayer.flags.landsPlayedThisTurn >= botPlayer.flags.maxLandsPerTurn) {
      return
    }

    // Find a land in hand
    const landInHand = botPlayer.hand.find((cardId: string) => {
      const card = gameState.entities[cardId]
      return card.typeLine.toLowerCase().includes("land")
    })

    if (landInHand) {
      actions.playLand(gameState, this.botPlayerId, landInHand)
    }
  }

  private tapLandsForMana(gameState: GameState): void {
    // Tap all untapped lands for mana
    const botLands = gameState.battlefield.filter((cardId) => {
      const card = gameState.entities[cardId]
      return (
        card.controllerId === this.botPlayerId &&
        card.typeLine.toLowerCase().includes("land") &&
        !card.tapped
      )
    })

    botLands.forEach((landId) => {
      actions.addManaFromLand(gameState, this.botPlayerId, landId)
    })
  }

  private castSpells(gameState: GameState, botPlayer: any): void {
    // Get all castable cards from hand
    const castableCards: Array<{ cardId: string; card: CardInstance }> = botPlayer.hand
      .map((cardId: string) => ({
        cardId,
        card: gameState.entities[cardId],
      }))
      .filter(({ card }: { card: CardInstance }) => {
        // Skip lands
        if (card.typeLine.toLowerCase().includes("land")) return false

        // Check if can afford
        return actions.canAffordManaCost(gameState, this.botPlayerId, card.manaCost)
      })

    // Sort by CMC (highest first)
    castableCards.sort((a, b) => b.card.cmc - a.card.cmc)

    // Cast spells until we run out of mana
    for (const { cardId } of castableCards) {
      const success = actions.castSpell(gameState, this.botPlayerId, cardId)
      if (!success) break
    }
  }

  private declareAttacks(gameState: GameState): void {
    const opponentId = Object.keys(gameState.players).find((id) => id !== this.botPlayerId)
    if (!opponentId) return

    // Find all creatures that can attack
    const attackers = gameState.battlefield
      .filter((cardId) => {
        const card = gameState.entities[cardId]
        return (
          card.controllerId === this.botPlayerId &&
          card.typeLine.toLowerCase().includes("creature") &&
          !card.tapped &&
          !card.summoningSick &&
          parseInt(card.power || "0") > 0
        )
      })
      .map((attackerId) => ({
        attackerId,
        targetId: opponentId,
      }))

    if (attackers.length > 0) {
      actions.declareAttackers(gameState, this.botPlayerId, attackers)
    }
  }

  // Auto-pass priority and advance phases
  autoPlay(gameState: GameState): void {
    // If it's not bot's turn, do nothing
    if (gameState.turnState.activePlayerId !== this.botPlayerId) {
      return
    }

    const phase = gameState.turnState.phase

    // Make decisions for current phase
    this.makeDecision(gameState)

    // Auto-advance through phases
    // In a real game, this would happen when bot "passes priority"
    // For simplicity, bot always passes immediately after acting
  }
}

// Helper function to run bot turn automatically
export function executeBotTurn(gameState: GameState, botPlayerId: string): void {
  const bot = new SimpleBot(botPlayerId)

  // Execute actions for each relevant phase
  const phasesToAct: Array<typeof gameState.turnState.phase> = [
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

  let currentPhaseIndex = 0
  while (currentPhaseIndex < phasesToAct.length && gameState.turnState.activePlayerId === botPlayerId) {
    bot.makeDecision(gameState)
    actions.advancePhase(gameState)
    currentPhaseIndex++
  }
}
