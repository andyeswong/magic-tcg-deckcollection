/**
 * Runtime Ability State
 *
 * Tracks dynamic ability state during gameplay.
 * This bridges the gap between static ability JSON (from database)
 * and runtime game state (in CardInstance).
 */

import type { Counters } from './types'

export type CounterType = keyof Counters

/**
 * Saga chapter progression state
 */
export interface SagaState {
  currentChapter: number
  chaptersTriggered: number[]
  maxChapters: number
}

/**
 * Abilities granted to this card by other permanents
 */
export interface GrantedAbility {
  sourceCardId: string  // Card granting the ability
  type: "keyword" | "static" | "power_toughness"
  keywords?: string[]   // ["flying", "haste"]
  power?: number        // +2/+0
  toughness?: number    // +0/+2
  expiresAt: "end_of_turn" | "while_on_battlefield" | "permanent"
  timestamp: number     // For layer ordering
}

/**
 * Duration-based effects (until end of turn, etc.)
 */
export interface DurationEffect {
  id: string
  sourceCardId: string
  effect: {
    type: "power_toughness" | "keyword" | "type_change" | "tap_untap" | "custom"
    powerBonus?: number
    toughnessBonus?: number
    keywords?: string[]
    becomesTypes?: string[]
    customEffect?: string
  }
  expiresAt: "end_of_turn" | "end_of_combat" | "next_upkeep" | "while_tapped"
  timestamp: number  // For layer ordering
}

/**
 * Active triggered ability registration
 */
export interface ActiveTriggeredAbility {
  abilityIndex: number  // Index in static abilities.triggered[]
  isActive: boolean
  triggersSinceETB: number
}

/**
 * Active replacement effect tracking
 */
export interface ActiveReplacement {
  abilityIndex: number  // Index in static abilities.replacement[]
  timesApplied: number
  maxApplications?: number  // For "once per turn" effects
}

/**
 * Continuous effect from another permanent
 */
export interface ContinuousEffect {
  sourceCardId: string
  layer: number  // MTG layer system (1-7)
  effect: {
    type: "power_toughness" | "keyword" | "ability_grant" | "type_change"
    value: any
  }
  timestamp: number
}

/**
 * Cached ability checks for performance
 */
export interface AbilityCache {
  hasFlying: boolean
  hasIndestructible: boolean
  hasHaste: boolean
  hasVigilance: boolean
  hasFirstStrike: boolean
  currentPower: number
  currentToughness: number
  cachedAt: number  // Timestamp, invalidate if too old
}

/**
 * Runtime ability state for a card instance
 *
 * This extends CardInstance with runtime ability tracking.
 * Initialized when card enters battlefield, cleaned up when it leaves.
 */
export interface RuntimeAbilityState {
  // Link to static ability JSON in database
  staticAbilitiesId?: string  // References card_abilities.id

  // Saga state (if this is a Saga)
  saga?: SagaState

  // Active triggered abilities registered with game engine
  activeTriggeredAbilities: ActiveTriggeredAbility[]

  // Active activated abilities from JSON (available when card is on battlefield)
  activeActivatedAbilities?: ActivatedAbility[]

  // Granted abilities from other permanents
  grantedAbilities: GrantedAbility[]

  // Duration-based effects ("until end of turn")
  durationEffects: DurationEffect[]

  // Active replacement effects
  activeReplacements: ActiveReplacement[]

  // Continuous effects currently affecting this card
  continuousEffects: ContinuousEffect[]

  // Cached ability checks (performance optimization)
  abilityCache?: AbilityCache
}

/**
 * Static ability JSON from database (v1.1 format)
 */
export interface CardAbilityData {
  version: string
  cardId: string
  cardName: string
  abilities: {
    static: StaticAbility[]
    triggered: TriggeredAbility[]
    activated: ActivatedAbility[]
    replacement: ReplacementEffect[]
    keywords: KeywordAbility[]
    saga: SagaAbility | null
  }
  parsing_confidence: number
  parsing_notes: string
}

// Ability type definitions (simplified - full definitions in ability-json-standard-v1.1.md)

export interface StaticAbility {
  type: "static"
  effect: string
  [key: string]: any
}

export interface TriggeredAbility {
  type: "triggered"
  trigger: {
    event: string
    [key: string]: any
  }
  effect: {
    action: string
    [key: string]: any
  }
  [key: string]: any
}

export interface ActivatedAbility {
  type: "activated"
  cost: any
  effect: {
    action: string
    [key: string]: any
  }
  timing: "instant" | "sorcery"
  [key: string]: any
}

export interface ReplacementEffect {
  type: "replacement"
  replaces: string
  modification: any
  [key: string]: any
}

export interface KeywordAbility {
  type: "keyword"
  keyword: string
  [key: string]: any
}

export interface SagaAbility {
  type: "saga"
  maxChapters: number
  chapters: {
    chapterNumber: number[]
    effect: any
  }[]
  isCreature?: boolean
  creatureTypes?: string[]
}
