import type { GameState, CardInstance } from "./types"
import * as actions from "./actions"
import { getCurrentStats, hasKeyword } from "./card-effects"

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
  async makeDecision(gameState: GameState): Promise<void> {
    // Only act if it's bot's turn
    if (gameState.turnState.activePlayerId !== this.botPlayerId) {
      return
    }

    const phase = gameState.turnState.phase

    // Main phases - play lands and spells
    if (phase === "MAIN_1" || phase === "MAIN_2") {
      await this.playMainPhase(gameState)
    }

    // Combat phase - declare attackers
    if (phase === "DECLARE_ATTACKERS") {
      this.declareAttacks(gameState)
    }
  }
  // Decision-making for opponent's turn (blocking)
  makeDefensiveDecision(gameState: GameState): void {
    const phase = gameState.turnState.phase

    // Declare blockers when opponent attacks
    if (phase === "DECLARE_BLOCKERS" && gameState.combat) {
      this.declareBlocks(gameState)
    }
  }
  private async playMainPhase(gameState: GameState): Promise<void> {
    const botPlayer = gameState.players[this.botPlayerId]

    // Step 1: Try to play a land
    this.tryPlayLand(gameState, botPlayer)

    // Step 2: Tap lands for mana
    this.tapLandsForMana(gameState)

    // Step 3: Activate useful abilities before casting spells
    await this.activateUsefulAbilities(gameState)

    // Step 4: Cast spells (highest CMC first)
    await this.castSpells(gameState, botPlayer)
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

  private async activateUsefulAbilities(gameState: GameState): Promise<void> {
    // Find all bot permanents with activated abilities
    const botPermanents = gameState.battlefield.filter((cardId) => {
      const card = gameState.entities[cardId]
      return card.controllerId === this.botPlayerId
    })

    for (const permanentId of botPermanents) {
      const card = gameState.entities[permanentId]
      
      // Check if card has runtime state with activated abilities from JSON
      if (!card.runtimeAbilityState?.activeActivatedAbilities || 
          card.runtimeAbilityState.activeActivatedAbilities.length === 0) {
        continue
      }
      
      const abilities = card.runtimeAbilityState.activeActivatedAbilities

      for (let i = 0; i < abilities.length; i++) {
        const ability = abilities[i]

        // Strategy: Activate based on effect action type
        let shouldActivate = false
        let targetCardId: string | undefined
        
        const effectAction = ability.effect?.action || "unknown"

        switch (effectAction) {
          case "add_mana":
            // Always activate mana abilities if we can
            shouldActivate = !ability.cost?.tap || !card.tapped
            break

          case "draw":
          case "draw_card":
            // Draw cards if we have mana to spare
            const botPlayer = gameState.players[this.botPlayerId]
            const totalMana =
              botPlayer.manaPool.W +
              botPlayer.manaPool.U +
              botPlayer.manaPool.B +
              botPlayer.manaPool.R +
              botPlayer.manaPool.G +
              botPlayer.manaPool.C
            shouldActivate = totalMana >= 3 // Only if we have spare mana
            break

          case "deal_damage":
            // Use damage abilities on opponent's biggest creature
            const targetType = ability.effect?.targets?.type
            if (targetType === "single" || targetType === "any") {
              const opponentId = Object.keys(gameState.players).find((id) => id !== this.botPlayerId)
              if (opponentId) {
                const opponentCreatures = gameState.battlefield.filter((id) => {
                  const c = gameState.entities[id]
                  return c.controllerId === opponentId && c.typeLine.toLowerCase().includes("creature")
                })

                if (opponentCreatures.length > 0) {
                  // Target the biggest creature we can kill
                  const damage = ability.effect?.damage?.amount || 0
                  const killable = opponentCreatures.filter((id) => {
                    const { toughness } = getCurrentStats(gameState.entities[id])
                    return damage >= toughness
                  })

                  if (killable.length > 0) {
                    // Target the highest power creature we can kill
                    killable.sort((a, b) => {
                      const { power: powerA } = getCurrentStats(gameState.entities[a])
                      const { power: powerB } = getCurrentStats(gameState.entities[b])
                      return powerB - powerA
                    })
                    targetCardId = killable[0]
                    shouldActivate = true
                  }
                }
              }
            }
            break

          case "add_counter":
          case "add_counters":
            // Add counters to our best creature
            const botCreatures = gameState.battlefield.filter((id) => {
              const c = gameState.entities[id]
              return c.controllerId === this.botPlayerId && c.typeLine.toLowerCase().includes("creature")
            })

            if (botCreatures.length > 0) {
              // Target creature with highest power
              botCreatures.sort((a, b) => {
                const { power: powerA } = getCurrentStats(gameState.entities[a])
                const { power: powerB } = getCurrentStats(gameState.entities[b])
                return powerB - powerA
              })
              targetCardId = botCreatures[0]
              shouldActivate = true
            }
            break
        }

        if (shouldActivate) {
          const success = await actions.activateAbility(
            gameState,
            this.botPlayerId,
            permanentId,
            i,
            targetCardId,
          )
          if (success) {
            console.log(`[BOT] Activated ${effectAction} ability on ${card.name}`)
          }
        }
      }
    }
  }

  private async castSpells(gameState: GameState, botPlayer: any): Promise<void> {
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
    for (const { cardId, card } of castableCards) {
      // For X spells, calculate how much mana we can spend
      let xValue = 0
      if (card.manaCost.includes("{X}")) {
        // Calculate available mana
        const totalMana =
          botPlayer.manaPool.W +
          botPlayer.manaPool.U +
          botPlayer.manaPool.B +
          botPlayer.manaPool.R +
          botPlayer.manaPool.G +
          botPlayer.manaPool.C
        // Spend half of available mana on X (simple strategy)
        xValue = Math.floor(totalMana / 2)
      }

      // Check if spell requires targets
      let targets: string[] = []
      if (actions.spellRequiresTargets(card)) {
        const validTargets = actions.getValidTargetsForSpell(gameState, card)

        // Bot strategy: select targets from valid targets
        // For now, just select up to the maximum needed
        const { parseSpellEffect } = require("./spell-parser")
        const effects = parseSpellEffect(card.oracleText || "", card.name)

        for (const effect of effects) {
          if (effect.type === "add_counters" && effect.counters?.targetCount) {
            const maxTargets = effect.counters.targetCount
            targets = validTargets.slice(0, Math.min(maxTargets, validTargets.length))
            console.log(`[BOT] Selected ${targets.length} target(s) for ${card.name}`)
          }
        }
      }

      const success = await actions.castSpell(gameState, this.botPlayerId, cardId, xValue, targets)
      if (success) {
        // Bot automatically passes priority after casting
        // This allows the spell to resolve (or opponent to respond)
        if (gameState.turnState.waitingForPriority && gameState.turnState.priorityPlayerId === this.botPlayerId) {
          console.log(`[BOT] Auto-passing priority after casting ${card.name}`)
          await actions.passPriority(gameState)
        }
      } else {
        break
      }
    }
  }

  private declareAttacks(gameState: GameState): void {
    const opponentId = Object.keys(gameState.players).find((id) => id !== this.botPlayerId)
    if (!opponentId) return

    // Find all creatures that can attack
    const attackers = gameState.battlefield
      .filter((cardId) => {
        const card = gameState.entities[cardId]
        const { power } = getCurrentStats(card)
        
        return (
          card.controllerId === this.botPlayerId &&
          card.typeLine.toLowerCase().includes("creature") &&
          !card.tapped &&
          !card.summoningSick &&
          power > 0
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

  private declareBlocks(gameState: GameState): void {
    if (!gameState.combat) return

    // Find all creatures that can block
    const availableBlockers = gameState.battlefield
      .filter((cardId) => {
        const card = gameState.entities[cardId]
        return (
          card.controllerId === this.botPlayerId &&
          card.typeLine.toLowerCase().includes("creature") &&
          !card.tapped
        )
      })

    if (availableBlockers.length === 0) return

    // Simple blocking strategy: Block biggest attackers first
    const attackersSorted = [...gameState.combat.attackers]
      .map((attack) => ({
        ...attack,
        power: getCurrentStats(gameState.entities[attack.attackerId]).power,
      }))
      .sort((a, b) => b.power - a.power)

    const blocks: Array<{ blockerId: string; attackerId: string }> = []
    const usedBlockers = new Set<string>()

    for (const attack of attackersSorted) {
      // Find a blocker that can block this attacker
      const blocker = availableBlockers.find((blockerId) => {
        if (usedBlockers.has(blockerId)) return false
        const blockerCard = gameState.entities[blockerId]
        const attackerCard = gameState.entities[attack.attackerId]
        
        // Check flying rules
        const attackerHasFlying = attackerCard.keywords.includes("flying") || 
          (attackerCard.oracleText?.toLowerCase().includes("flying") ?? false)
        const blockerHasFlying = blockerCard.keywords.includes("flying") || 
          (blockerCard.oracleText?.toLowerCase().includes("flying") ?? false)
        const blockerHasReach = blockerCard.keywords.includes("reach") || 
          (blockerCard.oracleText?.toLowerCase().includes("reach") ?? false)
        
        if (attackerHasFlying && !blockerHasFlying && !blockerHasReach) {
          return false
        }
        
        return true
      })

      if (blocker) {
        blocks.push({ blockerId: blocker, attackerId: attack.attackerId })
        usedBlockers.add(blocker)
      }
    }

    if (blocks.length > 0) {
      actions.declareBlockers(gameState, this.botPlayerId, blocks)
      console.log(`[BOT] Declared ${blocks.length} blocker(s)`)
    }
  }

  // Handle priority when bot has it
  handlePriority(gameState: GameState): void {
    const botPlayer = gameState.players[this.botPlayerId]

    // Check if bot has any instants in hand
    const instants = botPlayer.hand.filter((cardId) => {
      const card = gameState.entities[cardId]
      return card.typeLine.toLowerCase().includes("instant")
    })

    // Check if bot can afford to cast any instant
    const castableInstants = instants.filter((cardId) => {
      const card = gameState.entities[cardId]
      return actions.canAffordManaCost(gameState, this.botPlayerId, card.manaCost)
    })

    // For now, bot doesn't cast instants in response (simple AI)
    // Just pass priority
    console.log(`[BOT] Bot has ${castableInstants.length} castable instant(s), passing priority`)
    actions.passPriority(gameState)
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
export async function executeBotTurn(gameState: GameState, botPlayerId: string): Promise<void> {
  const bot = new SimpleBot(botPlayerId)
  const phase = gameState.turnState.phase

  // Check if bot has priority and needs to respond
  if (gameState.turnState.waitingForPriority && gameState.turnState.priorityPlayerId === botPlayerId) {
    console.log("[BOT] Bot has priority, handling response")
    bot.handlePriority(gameState)
    return
  }

  // If it's bot's turn, execute normal turn actions
  if (gameState.turnState.activePlayerId === botPlayerId) {
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
      await bot.makeDecision(gameState)

      // If we just declared attackers and there are attackers, stop before DECLARE_BLOCKERS
      // to let the human player declare blocks
      if (gameState.turnState.phase === "DECLARE_ATTACKERS" && gameState.combat && gameState.combat.attackers.length > 0) {
        actions.advancePhase(gameState) // Advance to DECLARE_BLOCKERS
        console.log("[BOT] Stopping at DECLARE_BLOCKERS to let opponent declare blocks")
        break // Stop here - let human player block
      }

      actions.advancePhase(gameState)
      currentPhaseIndex++
    }

    // After bot's turn ends (CLEANUP phase), we need to advance to UNTAP which will switch players
    // Then auto-advance through non-interactive phases (UNTAP -> UPKEEP -> DRAW -> MAIN_1)
    console.log(`[BOT] Bot turn ended in phase: ${gameState.turnState.phase}, active player: ${gameState.turnState.activePlayerId}`)
    if (gameState.turnState.phase === "CLEANUP") {
      console.log(`[BOT] Advancing from CLEANUP to UNTAP to switch players`)
      // Advance from CLEANUP to UNTAP (this will switch to next player)
      actions.advancePhase(gameState)
      console.log(`[BOT] Advanced to ${gameState.turnState.phase}, new active player: ${gameState.turnState.activePlayerId}, bot: ${botPlayerId}`)
      
      // Now auto-advance the new player through non-interactive phases
      if (gameState.turnState.activePlayerId !== botPlayerId) {
        console.log(`[BOT] Auto-advancing human player through non-interactive phases`)
        actions.advanceToNextInteractivePhase(gameState)
        console.log(`[BOT] Finished auto-advance, phase: ${gameState.turnState.phase}, active: ${gameState.turnState.activePlayerId}`)
      } else {
        console.log(`[BOT] Still bot's turn after CLEANUP->UNTAP, this shouldn't happen!`)
      }
    }
  } else {
    // It's opponent's turn - bot may need to block
    bot.makeDefensiveDecision(gameState)
  }
}
