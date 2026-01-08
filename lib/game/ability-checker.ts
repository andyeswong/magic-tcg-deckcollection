/**
 * Ability Checker
 *
 * Functions to check if a card has abilities from ALL sources:
 * 1. Inherent abilities (printed on card)
 * 2. Keyword counters (flying counter, indestructible counter, etc.)
 * 3. Granted abilities (from other permanents)
 * 4. Duration effects ("until end of turn")
 *
 * CRITICAL: Always check ALL sources, not just inherent abilities!
 */

import type { CardInstance } from './types'
import type { CounterType } from './runtime-ability-state'

/**
 * Map keywords to their counter equivalents
 */
const KEYWORD_TO_COUNTER: Record<string, CounterType | null> = {
  "flying": "flying",
  "first_strike": "first_strike",
  "indestructible": "indestructible",
  // Add more as needed
}

/**
 * Check if a card has a specific keyword ability
 *
 * Checks ALL sources:
 * - Inherent keywords (card.keywords)
 * - Oracle text
 * - Keyword counters
 * - Granted abilities
 * - Duration effects
 *
 * @param card - Card to check
 * @param keyword - Keyword to check for (e.g., "flying", "haste")
 * @returns True if card has the keyword from any source
 */
export function hasKeyword(card: CardInstance, keyword: string): boolean {
  const keywordLower = keyword.toLowerCase()

  // Check cache first (for performance)
  if (card.runtimeAbilityState?.abilityCache) {
    const cache = card.runtimeAbilityState.abilityCache
    const age = Date.now() - cache.cachedAt

    // Cache is valid for 100ms
    if (age < 100) {
      switch (keywordLower) {
        case "flying":
          return cache.hasFlying
        case "indestructible":
          return cache.hasIndestructible
        case "haste":
          return cache.hasHaste
        case "vigilance":
          return cache.hasVigilance
        case "first_strike":
        case "first strike":
          return cache.hasFirstStrike
      }
    }
  }

  // 1. Check inherent keywords
  if (card.keywords.some(kw => kw.toLowerCase() === keywordLower)) {
    return true
  }

  // 2. Check oracle text (for keywords not in keywords array)
  if (card.oracleText?.toLowerCase().includes(keywordLower)) {
    return true
  }

  // 3. Check keyword counters
  const counterType = KEYWORD_TO_COUNTER[keywordLower]
  if (counterType && card.counters[counterType] > 0) {
    return true
  }

  // 4. Check granted abilities
  if (card.runtimeAbilityState?.grantedAbilities.some(
    granted => granted.keywords?.some(kw => kw.toLowerCase() === keywordLower)
  )) {
    return true
  }

  // 5. Check duration effects
  if (card.runtimeAbilityState?.durationEffects.some(
    effect => effect.effect.keywords?.some(kw => kw.toLowerCase() === keywordLower)
  )) {
    return true
  }

  return false
}

/**
 * Get all keywords a card currently has (from all sources)
 *
 * @param card - Card to check
 * @returns Array of all active keywords
 */
export function getAllKeywords(card: CardInstance): string[] {
  const keywords = new Set<string>()

  // 1. Add inherent keywords
  card.keywords.forEach(kw => keywords.add(kw))

  // 2. Add keywords from counters
  Object.entries(KEYWORD_TO_COUNTER).forEach(([keyword, counterType]) => {
    if (counterType && card.counters[counterType] > 0) {
      keywords.add(keyword)
    }
  })

  // 3. Add granted keywords
  card.runtimeAbilityState?.grantedAbilities.forEach(granted => {
    granted.keywords?.forEach(kw => keywords.add(kw))
  })

  // 4. Add keywords from duration effects
  card.runtimeAbilityState?.durationEffects.forEach(effect => {
    effect.effect.keywords?.forEach(kw => keywords.add(kw))
  })

  return Array.from(keywords)
}

/**
 * Calculate current power (including all modifiers)
 *
 * @param card - Card to calculate power for
 * @returns Current power value
 */
export function calculatePower(card: CardInstance): number {
  let power = parseInt(card.power || "0")

  // Add +1/+1 counters
  power += card.counters.p1p1

  // Subtract -1/-1 counters
  power -= card.counters["-1-1"]

  // Add temporary modifiers
  card.temporaryModifiers.forEach(mod => {
    power += mod.power || 0
  })

  // Add runtime duration effect bonuses
  card.runtimeAbilityState?.durationEffects.forEach(effect => {
    power += effect.effect.powerBonus || 0
  })

  // Add granted bonuses
  card.runtimeAbilityState?.grantedAbilities.forEach(granted => {
    power += granted.power || 0
  })

  // Add continuous effects (sorted by layer/timestamp)
  const sortedEffects = (card.runtimeAbilityState?.continuousEffects || [])
    .sort((a, b) => a.layer - b.layer || a.timestamp - b.timestamp)

  sortedEffects.forEach(effect => {
    if (effect.effect.type === "power_toughness") {
      power += effect.effect.value?.power || 0
    }
  })

  return Math.max(0, power)  // Power can't go below 0
}

/**
 * Calculate current toughness (including all modifiers)
 *
 * @param card - Card to calculate toughness for
 * @returns Current toughness value
 */
export function calculateToughness(card: CardInstance): number {
  let toughness = parseInt(card.toughness || "0")

  // Add +1/+1 counters
  toughness += card.counters.p1p1

  // Subtract -1/-1 counters
  toughness -= card.counters["-1-1"]

  // Add temporary modifiers
  card.temporaryModifiers.forEach(mod => {
    toughness += mod.toughness || 0
  })

  // Add runtime duration effect bonuses
  card.runtimeAbilityState?.durationEffects.forEach(effect => {
    toughness += effect.effect.toughnessBonus || 0
  })

  // Add granted bonuses
  card.runtimeAbilityState?.grantedAbilities.forEach(granted => {
    toughness += granted.toughness || 0
  })

  // Add continuous effects (sorted by layer/timestamp)
  const sortedEffects = (card.runtimeAbilityState?.continuousEffects || [])
    .sort((a, b) => a.layer - b.layer || a.timestamp - b.timestamp)

  sortedEffects.forEach(effect => {
    if (effect.effect.type === "power_toughness") {
      toughness += effect.effect.value?.toughness || 0
    }
  })

  return Math.max(1, toughness)  // Toughness must be at least 1 for creatures
}

/**
 * Check if a creature can be destroyed
 *
 * @param card - Card to check
 * @returns True if card can be destroyed
 */
export function canBeDestroyed(card: CardInstance): boolean {
  return !hasKeyword(card, "indestructible")
}

/**
 * Check if a creature can block another creature
 *
 * @param blocker - Creature attempting to block
 * @param attacker - Creature being blocked
 * @returns True if blocker can block attacker
 */
export function canBlock(blocker: CardInstance, attacker: CardInstance): boolean {
  // Flying restriction
  if (hasKeyword(attacker, "flying")) {
    return hasKeyword(blocker, "flying") || hasKeyword(blocker, "reach")
  }

  // Menace restriction (requires 2 blockers)
  // This is a simplified check - full menace logic is more complex
  if (hasKeyword(attacker, "menace")) {
    // Would need to check if there are multiple blockers
    // For now, just allow the block
    return true
  }

  return true
}

/**
 * Check if a creature can attack
 *
 * @param card - Creature attempting to attack
 * @returns True if card can attack
 */
export function canAttack(card: CardInstance): boolean {
  // Can't attack if tapped
  if (card.tapped) {
    return false
  }

  // Can't attack if it has summoning sickness (unless it has haste)
  if (card.summoningSick && !hasKeyword(card, "haste")) {
    return false
  }

  // Can't attack if it has defender
  if (hasKeyword(card, "defender")) {
    return false
  }

  // Check vow counters (prevent attacking)
  if (card.counters.vow > 0) {
    // Vow counters prevent attacking specific players
    // Would need more logic to check which player
    // For now, just prevent attacking
    return false
  }

  return true
}

/**
 * Update ability cache for performance
 *
 * @param card - Card to update cache for
 */
export function updateAbilityCache(card: CardInstance): void {
  if (!card.runtimeAbilityState) {
    return
  }

  card.runtimeAbilityState.abilityCache = {
    hasFlying: hasKeyword(card, "flying"),
    hasIndestructible: hasKeyword(card, "indestructible"),
    hasHaste: hasKeyword(card, "haste"),
    hasVigilance: hasKeyword(card, "vigilance"),
    hasFirstStrike: hasKeyword(card, "first_strike"),
    currentPower: calculatePower(card),
    currentToughness: calculateToughness(card),
    cachedAt: Date.now()
  }
}

/**
 * Invalidate ability cache
 *
 * Call this whenever a card's abilities or modifiers change.
 *
 * @param card - Card to invalidate cache for
 */
export function invalidateAbilityCache(card: CardInstance): void {
  if (card.runtimeAbilityState) {
    card.runtimeAbilityState.abilityCache = undefined
  }
}
