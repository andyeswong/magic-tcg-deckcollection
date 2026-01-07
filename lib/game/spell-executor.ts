/**
 * Generic spell executor
 * Executes spell effects parsed from oracle text
 */

import type { GameState, CardInstance } from "./types"
import type { SpellEffect } from "./spell-parser"
import { getCurrentStats } from "./card-effects"
import { addGameLog } from "./logger"

export interface SpellExecutionContext {
  gameState: GameState
  spell: CardInstance
  controllerId: string
  selectedModes?: number[] // For modal spells
  selectedTargets?: string[] // For targeted spells
  selectedCard?: string // For library search
}

/**
 * Execute a spell effect
 */
export function executeSpellEffect(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId } = context

  switch (effect.type) {
    case "search_library":
      executeLibrarySearch(context, effect)
      break

    case "destroy_creatures":
      executeDestroy(context, effect)
      break

    case "exile_permanents":
      executeExile(context, effect)
      break

    case "add_counters":
      executeAddCounters(context, effect)
      break

    case "sacrifice":
      executeSacrifice(context, effect)
      break

    case "return_from_graveyard":
      executeReturnFromGraveyard(context, effect)
      break

    case "modal":
      executeModalSpell(context, effect)
      break

    default:
      console.log(`[SPELL] ${spell.name}: Effect type "${effect.type}" not implemented`)
      addGameLog(gameState, `cast spell (effect not fully implemented)`, "action", controllerId, {
        cardName: spell.name,
        details: `Effect type: ${effect.type}`,
      })
  }
}

function executeLibrarySearch(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId, selectedCard } = context
  const player = gameState.players[controllerId]

  if (!selectedCard) {
    console.log(`[SPELL] ${spell.name}: No card selected from library search`)
    return
  }

  // Remove from library
  player.library = player.library.filter(id => id !== selectedCard)

  const card = gameState.entities[selectedCard]
  const destination = effect.search!.destination

  if (destination === "battlefield") {
    gameState.battlefield.push(selectedCard)
    card.zone = "BATTLEFIELD"

    if (effect.search!.tapped) {
      card.tapped = true
    }

    console.log(`[SPELL] ${spell.name}: Put ${card.name} onto battlefield${effect.search!.tapped ? " tapped" : ""}`)
    addGameLog(gameState, `searched library`, "effect", controllerId, {
      cardName: spell.name,
      targetName: card.name,
      details: `Put onto battlefield${effect.search!.tapped ? " tapped" : ""}`,
    })
  } else if (destination === "hand") {
    player.hand.push(selectedCard)
    card.zone = "HAND"

    console.log(`[SPELL] ${spell.name}: Put ${card.name} into hand`)
    addGameLog(gameState, `searched library`, "effect", controllerId, {
      cardName: spell.name,
      targetName: card.name,
      details: "Put into hand",
    })
  }
}

function executeDestroy(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId, selectedTargets } = context

  if (effect.destroy!.all) {
    // Destroy all matching permanents
    const targets = gameState.battlefield.filter(cardId => {
      const card = gameState.entities[cardId]

      // Check type
      const targetType = effect.destroy!.target
      if (targetType && !card.typeLine.toLowerCase().includes(targetType)) {
        return false
      }

      // Check restriction
      const restriction = effect.destroy!.restriction
      if (restriction === "with no counters") {
        const hasCounters =
          card.counters.p1p1 > 0 ||
          card.counters.loyalty > 0 ||
          card.counters.charge > 0 ||
          card.counters.poison > 0 ||
          card.counters.shield > 0 ||
          card.counters.vow > 0
        return !hasCounters
      } else if (restriction?.includes("with power")) {
        if (!card.typeLine.toLowerCase().includes("creature")) return false

        const match = restriction.match(/with power (\d+) or (greater|less)/)
        if (match) {
          const { power } = getCurrentStats(card)
          const threshold = parseInt(match[1])
          if (match[2] === "greater") {
            return power >= threshold
          } else {
            return power <= threshold
          }
        }
      }

      return true
    })

    let destroyedCount = 0
    targets.forEach(cardId => {
      const card = gameState.entities[cardId]
      const owner = gameState.players[card.controllerId]

      gameState.battlefield = gameState.battlefield.filter(id => id !== cardId)
      owner.graveyard.push(cardId)
      card.zone = "GRAVEYARD"
      destroyedCount++
    })

    console.log(`[SPELL] ${spell.name}: Destroyed ${destroyedCount} permanents`)
    addGameLog(gameState, `destroyed permanents`, "effect", controllerId, {
      cardName: spell.name,
      details: `${destroyedCount} permanents destroyed`,
    })
  } else if (selectedTargets && selectedTargets.length > 0) {
    // Destroy specific targets
    selectedTargets.forEach(targetId => {
      const card = gameState.entities[targetId]
      const owner = gameState.players[card.controllerId]

      gameState.battlefield = gameState.battlefield.filter(id => id !== targetId)
      owner.graveyard.push(targetId)
      card.zone = "GRAVEYARD"

      console.log(`[SPELL] ${spell.name}: Destroyed ${card.name}`)
      addGameLog(gameState, `destroyed permanent`, "effect", controllerId, {
        cardName: spell.name,
        targetName: card.name,
      })
    })
  }
}

function executeExile(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId } = context

  if (effect.exile!.all) {
    const targetTypes = effect.exile!.target || []
    let exiledCount = 0

    targetTypes.forEach(targetType => {
      if (targetType === "creatures" || targetType === "artifacts" || targetType === "enchantments") {
        const permanents = gameState.battlefield.filter(cardId => {
          const card = gameState.entities[cardId]
          return card.typeLine.toLowerCase().includes(targetType.slice(0, -1)) // Remove 's'
        })

        permanents.forEach(cardId => {
          const card = gameState.entities[cardId]
          gameState.battlefield = gameState.battlefield.filter(id => id !== cardId)

          if (card.isToken) {
            delete gameState.entities[cardId]
          } else {
            gameState.exile.push(cardId)
            card.zone = "EXILE"
          }
          exiledCount++
        })
      } else if (targetType === "graveyards") {
        // Exile all graveyards
        Object.values(gameState.players).forEach(player => {
          const graveyardCount = player.graveyard.length
          player.graveyard.forEach(cardId => {
            const card = gameState.entities[cardId]
            gameState.exile.push(cardId)
            card.zone = "EXILE"
          })
          player.graveyard = []
          exiledCount += graveyardCount
        })
      }
    })

    console.log(`[SPELL] ${spell.name}: Exiled ${exiledCount} cards`)
    addGameLog(gameState, `exiled cards`, "effect", controllerId, {
      cardName: spell.name,
      details: `${exiledCount} cards exiled`,
    })
  }
}

function executeAddCounters(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId, selectedTargets } = context

  if (!effect.counters) return

  const counterType = effect.counters.type
  const counterCount = effect.counters.count

  if (selectedTargets && selectedTargets.length > 0) {
    // Add counters to specific targets
    selectedTargets.forEach(targetId => {
      const card = gameState.entities[targetId]

      switch (counterType) {
        case "+1/+1":
          card.counters.p1p1 += counterCount
          break
        case "shield":
          card.counters.shield += counterCount
          break
        case "vow":
          card.counters.vow += counterCount
          break
        case "loyalty":
          card.counters.loyalty += counterCount
          break
      }

      console.log(`[SPELL] ${spell.name}: Added ${counterCount} ${counterType} counter(s) to ${card.name}`)
      addGameLog(gameState, `added counters`, "effect", controllerId, {
        cardName: spell.name,
        targetName: card.name,
        details: `${counterCount} ${counterType} counter(s)`,
      })
    })
  } else if (effect.counters.targetPlayer === "each") {
    // Add counters to each creature target player controls
    const targetPlayerId = controllerId // Simplified: just the caster's creatures

    const creatures = gameState.battlefield.filter(cardId => {
      const card = gameState.entities[cardId]
      return card.controllerId === targetPlayerId && card.typeLine.toLowerCase().includes("creature")
    })

    creatures.forEach(cardId => {
      const card = gameState.entities[cardId]

      switch (counterType) {
        case "+1/+1":
          card.counters.p1p1 += counterCount
          break
        case "shield":
          card.counters.shield += counterCount
          break
      }
    })

    console.log(`[SPELL] ${spell.name}: Added ${counterCount} ${counterType} counter(s) to ${creatures.length} creatures`)
    addGameLog(gameState, `added counters`, "effect", controllerId, {
      cardName: spell.name,
      details: `${counterCount} ${counterType} counter(s) to ${creatures.length} creatures`,
    })
  }
}

function executeSacrifice(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId } = context

  if (!effect.sacrifice) return

  if (effect.sacrifice.controller === "each player") {
    // Each player sacrifices
    Object.keys(gameState.players).forEach(playerId => {
      const player = gameState.players[playerId]

      if (effect.sacrifice!.count === -1) {
        // Sacrifice all except one (Promise of Loyalty pattern)
        const playerCreatures = gameState.battlefield.filter(cardId => {
          const card = gameState.entities[cardId]
          return card.controllerId === playerId && card.typeLine.toLowerCase().includes("creature")
        })

        if (playerCreatures.length > 1) {
          // Keep the first one, sacrifice the rest
          const toSacrifice = playerCreatures.slice(1)

          toSacrifice.forEach(cardId => {
            const card = gameState.entities[cardId]
            gameState.battlefield = gameState.battlefield.filter(id => id !== cardId)
            player.graveyard.push(cardId)
            card.zone = "GRAVEYARD"
          })

          console.log(`[SPELL] ${spell.name}: ${player.name} sacrificed ${toSacrifice.length} creatures`)
        }

        // Put vow counter on the remaining creature
        if (playerCreatures.length > 0) {
          const kept = gameState.entities[playerCreatures[0]]
          kept.counters.vow++
        }
      }
    })
  }
}

function executeReturnFromGraveyard(context: SpellExecutionContext, effect: SpellEffect): void {
  const { gameState, spell, controllerId, selectedTargets } = context

  if (!selectedTargets || selectedTargets.length === 0) return

  const player = gameState.players[controllerId]

  selectedTargets.forEach(targetId => {
    const card = gameState.entities[targetId]

    // Remove from graveyard
    player.graveyard = player.graveyard.filter(id => id !== targetId)

    if (effect.returnFromGraveyard!.destination === "battlefield") {
      gameState.battlefield.push(targetId)
      card.zone = "BATTLEFIELD"

      console.log(`[SPELL] ${spell.name}: Returned ${card.name} to battlefield`)
    } else {
      player.hand.push(targetId)
      card.zone = "HAND"

      console.log(`[SPELL] ${spell.name}: Returned ${card.name} to hand`)
    }

    addGameLog(gameState, `returned from graveyard`, "effect", controllerId, {
      cardName: spell.name,
      targetName: card.name,
      details: `To ${effect.returnFromGraveyard!.destination}`,
    })
  })
}

function executeModalSpell(context: SpellExecutionContext, effect: SpellEffect): void {
  const { spell, selectedModes } = context

  if (!effect.modal || !selectedModes || selectedModes.length === 0) {
    console.log(`[SPELL] ${spell.name}: Modal spell executed with no modes selected`)
    return
  }

  console.log(`[SPELL] ${spell.name}: Executing ${selectedModes.length} selected mode(s):`, selectedModes)

  // Execute each selected mode
  selectedModes.forEach(modeIndex => {
    const mode = effect.modal!.modes[modeIndex]
    if (mode && mode.effect) {
      console.log(`[SPELL] ${spell.name}: Executing mode ${modeIndex}: ${mode.description}`)
      executeSpellEffect(context, mode.effect)
    }
  })
}
