import { create } from "zustand"
import type { GameState, DeckData, DeckCardData } from "./types"
import { initializeGame, startGame, drawInitialHand } from "./init"
import * as actions from "./actions"
import { resolveTriggerWithTarget, resolveProliferate, resolveSupport } from "./card-effects"
import { soundManager } from "@/lib/sound-manager"

interface GameStore {
  gameState: GameState | null
  humanPlayerId: string
  botPlayerId: string

  // Actions
  initGame: (
    deckData: DeckData,
    deckCards: DeckCardData[],
    humanPlayerId: string,
    humanPlayerName: string,
    options?: { seed?: string; devMode?: boolean }
  ) => void
  startGame: () => void
  drawCard: (playerId: string) => void
  discardCard: (playerId: string, cardInstanceId: string) => boolean
  playLand: (playerId: string, cardInstanceId: string) => boolean
  tapPermanent: (cardInstanceId: string) => boolean
  untapPermanent: (cardInstanceId: string) => boolean
  addManaFromLand: (playerId: string, cardInstanceId: string, chosenColor?: string) => boolean
  castSpell: (playerId: string, cardInstanceId: string, xValue?: number, targets?: string[], selectedModes?: number[]) => Promise<boolean>
  castCommander: (playerId: string) => boolean
  declareAttackers: (playerId: string, attackers: Array<{ attackerId: string; targetId: string }>) => boolean
  declareBlockers: (playerId: string, blocks: Array<{ blockerId: string; attackerId: string }>) => boolean
  activateAbility: (playerId: string, cardInstanceId: string, abilityIndex: number, targetCardId?: string) => Promise<boolean>
  passPriority: () => Promise<void>
  advancePhase: () => void
  advanceToNextInteractivePhase: () => void
  endTurn: () => void
  resetGame: () => void
  resolveTriggerWithTarget: (triggerId: string, targetCardId: string) => boolean
  resolveProliferate: (triggerId: string, selectedTargets: string[]) => boolean
  resolveSupport: (triggerId: string, selectedTargets: string[]) => boolean
  takeMulligan: (playerId: string) => void
  keepHand: () => void
  putCardsOnBottom: (playerId: string, cardIds: string[]) => void
  resolveScry: (triggerId: string, topCards: string[], bottomCards: string[]) => void

  // Spell targeting helpers
  spellRequiresTargets: (cardInstanceId: string) => boolean
  getValidTargetsForSpell: (cardInstanceId: string) => string[]
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  humanPlayerId: "",
  botPlayerId: "bot-player",

  initGame: (deckData, deckCards, humanPlayerId, humanPlayerName, options) => {
    console.log('[STORE] initGame called with options:', options)
    const botPlayerId = "bot-player"
    const gameState = initializeGame(
      deckData,
      deckCards,
      humanPlayerId,
      humanPlayerName,
      botPlayerId,
      "Bot",
      options
    )
    
    console.log('[STORE] gameState created with devMode:', gameState.devMode, 'seed:', gameState.seed)

    // Draw initial hands for mulligan phase
    Object.keys(gameState.players).forEach((playerId) => {
      drawInitialHand(gameState, playerId)
    })

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
    soundManager.playSound("draw")
    set({ gameState: { ...gameState } })
  },

  discardCard: (playerId, cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.discardCard(gameState, playerId, cardInstanceId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  playLand: (playerId, cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.playLand(gameState, playerId, cardInstanceId)
    if (success) {
      soundManager.playSound("play-land")
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
      soundManager.playSound("tap-land")
      set({ gameState: { ...gameState } })
    }
    return success
  },

  castSpell: async (playerId, cardInstanceId, xValue = 0, targets = [], selectedModes) => {
    const { gameState } = get()
    if (!gameState) return false

    const card = gameState.entities[cardInstanceId]
    const success = await actions.castSpell(gameState, playerId, cardInstanceId, xValue, targets, selectedModes)
    if (success) {
      // Play different sound for instants vs other spells
      if (card?.typeLine.toLowerCase().includes("instant")) {
        soundManager.playSound("instant")
      } else {
        soundManager.playSound("cast")
      }
      set({ gameState: { ...gameState } })
    }
    return success
  },

  castCommander: (playerId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.castCommander(gameState, playerId)
    if (success) {
      soundManager.playSound("cast")
      set({ gameState: { ...gameState } })
    }
    return success
  },

  declareAttackers: (playerId, attackers) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.declareAttackers(gameState, playerId, attackers)
    if (success) {
      if (attackers.length > 0) {
        soundManager.playSound("attack")
      }
      set({ gameState: { ...gameState } })
    }
    return success
  },

  declareBlockers: (playerId, blocks) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = actions.declareBlockers(gameState, playerId, blocks)
    if (success) {
      if (blocks.length > 0) {
        soundManager.playSound("blocked")
      }
      set({ gameState: { ...gameState } })
    }
    return success
  },

  activateAbility: async (playerId, cardInstanceId, abilityIndex, targetCardId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = await actions.activateAbility(gameState, playerId, cardInstanceId, abilityIndex, targetCardId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  passPriority: async () => {
    console.log('[STORE] passPriority called - START')
    const { gameState } = get()
    if (!gameState) {
      console.log('[STORE] passPriority - no gameState, returning')
      return
    }

    console.log('[STORE] passPriority - calling actions.passPriority')
    await actions.passPriority(gameState)
    console.log('[STORE] passPriority - actions.passPriority completed, updating state')
    set({ gameState: { ...gameState } })
    console.log('[STORE] passPriority - state updated, DONE')
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
    // One more to start next turn (goes to UNTAP)
    actions.advancePhase(gameState)

    // Auto-advance through non-interactive phases to MAIN_1
    actions.advanceToNextInteractivePhase(gameState)

    set({ gameState: { ...gameState } })
  },

  resetGame: () => {
    set({ gameState: null, humanPlayerId: "", botPlayerId: "bot-player" })
  },

  resolveTriggerWithTarget: (triggerId, targetCardId) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = resolveTriggerWithTarget(gameState, triggerId, targetCardId)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  resolveProliferate: (triggerId, selectedTargets) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = resolveProliferate(gameState, triggerId, selectedTargets)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  resolveSupport: (triggerId, selectedTargets) => {
    const { gameState } = get()
    if (!gameState) return false

    const success = resolveSupport(gameState, triggerId, selectedTargets)
    if (success) {
      set({ gameState: { ...gameState } })
    }
    return success
  },

  takeMulligan: (playerId) => {
    const { gameState } = get()
    if (!gameState) return

    const player = gameState.players[playerId]
    
    // Shuffle hand back into library
    player.hand.forEach(cardId => {
      gameState.entities[cardId].zone = "LIBRARY"
    })
    player.library.push(...player.hand)
    player.hand = []
    
    // Shuffle library
    for (let i = player.library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[player.library[i], player.library[j]] = [player.library[j], player.library[i]]
    }
    
    // Increment mulligan count
    player.mulliganCount++
    
    // Draw new hand (first mulligan is free)
    drawInitialHand(gameState, playerId)
    
    console.log(`[MULLIGAN] ${player.name} took mulligan #${player.mulliganCount}`)
    set({ gameState: { ...gameState } })
  },

  keepHand: () => {
    const { gameState } = get()
    if (!gameState || gameState.status !== "SETUP") return

    const humanPlayerId = get().humanPlayerId
    const humanPlayer = gameState.players[humanPlayerId]

    // If player has taken mulligans, they need to put cards on bottom
    if (humanPlayer.mulliganCount > 0) {
      // Don't start game yet - wait for scry dialog
      console.log(`[MULLIGAN] Player needs to put ${humanPlayer.mulliganCount} card(s) on bottom`)
      set({ gameState: { ...gameState } })
    } else {
      // No mulligans, start game immediately
      startGame(gameState)
      set({ gameState: { ...gameState } })
    }
  },

  putCardsOnBottom: (playerId, cardIds) => {
    const { gameState } = get()
    if (!gameState) return

    const player = gameState.players[playerId]
    
    // Remove selected cards from hand and put on bottom of library
    cardIds.forEach(cardId => {
      const index = player.hand.indexOf(cardId)
      if (index !== -1) {
        player.hand.splice(index, 1)
        player.library.unshift(cardId) // Put on bottom (start of array)
        gameState.entities[cardId].zone = "LIBRARY"
      }
    })
    
    console.log(`[MULLIGAN] Put ${cardIds.length} card(s) on bottom of library`)
    
    // Now start the game
    startGame(gameState)
    set({ gameState: { ...gameState } })
  },

  resolveScry: (triggerId, topCards, bottomCards) => {
    const { gameState } = get()
    if (!gameState) return

    const trigger = gameState.triggerQueue.find((t) => t.id === triggerId)
    if (!trigger || trigger.resolved || trigger.effect !== "scry") return

    const player = gameState.players[trigger.controllerId]
    
    // Put cards back on library in the order chosen
    // Bottom cards go first (at start of array = bottom of library)
    bottomCards.forEach(cardId => {
      const index = player.library.indexOf(cardId)
      if (index !== -1) {
        player.library.splice(index, 1)
        player.library.unshift(cardId) // Add to bottom
      }
    })
    
    // Top cards go last (at end of array = top of library)
    // Reverse order so first card in topCards array is on top
    topCards.reverse().forEach(cardId => {
      const index = player.library.indexOf(cardId)
      if (index !== -1) {
        player.library.splice(index, 1)
        player.library.push(cardId) // Add to top
      }
    })
    
    trigger.resolved = true
    gameState.triggerQueue = gameState.triggerQueue.filter((t) => !t.resolved)

    console.log(`[SCRY] Reordered library: ${topCards.length} to top, ${bottomCards.length} to bottom`)
    set({ gameState: { ...gameState } })
  },

  spellRequiresTargets: (cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return false

    const card = gameState.entities[cardInstanceId]
    if (!card) return false

    return actions.spellRequiresTargets(card)
  },

  getValidTargetsForSpell: (cardInstanceId) => {
    const { gameState } = get()
    if (!gameState) return []

    const card = gameState.entities[cardInstanceId]
    if (!card) return []

    return actions.getValidTargetsForSpell(gameState, card)
  },
}))
