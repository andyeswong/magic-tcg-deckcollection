import { create } from "zustand"
import type { GameState, DeckData, DeckCardData } from "./types"
import { initializeGame, startGame } from "./init"
import * as actions from "./actions"

interface GameStore {
  gameState: GameState | null
  humanPlayerId: string
  botPlayerId: string

  // Actions
  initGame: (deckData: DeckData, deckCards: DeckCardData[], humanPlayerId: string, humanPlayerName: string) => void
  startGame: () => void
  drawCard: (playerId: string) => void
  playLand: (playerId: string, cardInstanceId: string) => boolean
  tapPermanent: (cardInstanceId: string) => boolean
  untapPermanent: (cardInstanceId: string) => boolean
  addManaFromLand: (playerId: string, cardInstanceId: string, chosenColor?: string) => boolean
  castSpell: (playerId: string, cardInstanceId: string) => boolean
  castCommander: (playerId: string) => boolean
  declareAttackers: (playerId: string, attackers: Array<{ attackerId: string; targetId: string }>) => boolean
  advancePhase: () => void
  advanceToNextInteractivePhase: () => void
  endTurn: () => void
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  humanPlayerId: "",
  botPlayerId: "bot-player",

  initGame: (deckData, deckCards, humanPlayerId, humanPlayerName) => {
    const botPlayerId = "bot-player"
    const gameState = initializeGame(deckData, deckCards, humanPlayerId, humanPlayerName, botPlayerId, "Bot")

    set({
      gameState,
      humanPlayerId,
      botPlayerId,
    })
  },

  startGame: () => {
    const { gameState } = get()
    if (!gameState) return

    startGame(gameState)
    set({ gameState: { ...gameState } })
  },

  drawCard: (playerId) => {
    const { gameState } = get()
    if (!gameState) return

    actions.drawCard(gameState, playerId)
    set({ gameState: { ...gameState } })
  },

  playLand: (playerId, cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.playLand(gameState, playerId, cardInstanceId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  tapPermanent: (cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.tapPermanent(gameState, cardInstanceId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  untapPermanent: (cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.untapPermanent(gameState, cardInstanceId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  addManaFromLand: (playerId, cardInstanceId, chosenColor) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.addManaFromLand(gameState, playerId, cardInstanceId, chosenColor)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  castSpell: (playerId, cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.castSpell(gameState, playerId, cardInstanceId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  castCommander: (playerId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.castCommander(gameState, playerId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  declareAttackers: (playerId, attackers) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.declareAttackers(gameState, playerId, attackers)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  advancePhase: () => {
    const { gameState } = get()
    if (!gameState) return

    actions.advancePhase(gameState)

    // Auto-advance through non-interactive phases
    actions.advanceToNextInteractivePhase(gameState)

    set({ gameState: { ...gameState } })
  },

  advanceToNextInteractivePhase: () => {
    const { gameState } = get()
    if (!gameState) return

    actions.advanceToNextInteractivePhase(gameState)
    set({ gameState: { ...gameState } })
  },

  endTurn: () => {
    const { gameState } = get()
    if (!gameState) return

    // Advance to CLEANUP, which will trigger turn end
    while (gameState.turnState.phase !== "CLEANUP") {
      actions.advancePhase(gameState)
    }
    // One more to start next turn
    actions.advancePhase(gameState)

    set({ gameState: { ...gameState } })
  },

  resetGame: () => {
    set({ gameState: null, humanPlayerId: "", botPlayerId: "bot-player" })
  },
}))
