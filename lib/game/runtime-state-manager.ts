/**
 * Runtime State Manager
 *
 * Helper functions to initialize and manage runtime ability state for cards.
 */

import type { CardInstance, Counters } from './types'
import type {
  RuntimeAbilityState,
  CardAbilityData,
  SagaState,
  GrantedAbility,
  DurationEffect
} from './runtime-ability-state'
import { loadAbilities } from './ability-loader'

/**
 * Initialize empty counters object with all v1.1 counter types
 */
export function createEmptyCounters(): Counters {
  return {
    p1p1: 0,
    "-1-1": 0,
    loyalty: 0,
    charge: 0,
    poison: 0,
    stun: 0,
    shield: 0,
    vow: 0,
    lore: 0,
    indestructible: 0,
    flying: 0,
    first_strike: 0
  }
}

/**
 * Initialize runtime ability state for a card
 *
 * @param card - Card instance to initialize state for
 * @param abilityData - Static ability data from database (optional, will load if not provided)
 * @returns Initialized runtime ability state
 */
export async function initializeRuntimeState(
  card: CardInstance,
  abilityData?: CardAbilityData
): Promise<RuntimeAbilityState> {
  // Load abilities if not provided
  if (!abilityData) {
    abilityData = await loadAbilities(card.dbReferenceId) || undefined
  }

  const runtimeState: RuntimeAbilityState = {
    activeTriggeredAbilities: [],
    grantedAbilities: [],
    durationEffects: [],
    activeReplacements: [],
    continuousEffects: [],
    abilityCache: undefined
  }

  // If no ability data, return minimal state
  if (!abilityData) {
    return runtimeState
  }

  // Initialize Saga state if this is a Saga
  if (abilityData.abilities.saga) {
    runtimeState.saga = {
      currentChapter: 0,
      chaptersTriggered: [],
      maxChapters: abilityData.abilities.saga.maxChapters
    }
  }

  // Register triggered abilities
  if (abilityData.abilities.triggered && abilityData.abilities.triggered.length > 0) {
    runtimeState.activeTriggeredAbilities = abilityData.abilities.triggered.map((_, index) => ({
      abilityIndex: index,
      isActive: true,
      triggersSinceETB: 0
    }))
  }

  // Register replacement effects
  if (abilityData.abilities.replacement && abilityData.abilities.replacement.length > 0) {
    runtimeState.activeReplacements = abilityData.abilities.replacement.map((_, index) => ({
      abilityIndex: index,
      timesApplied: 0
    }))
  }

  return runtimeState
}

/**
 * Grant abilities to a card from another source
 *
 * @param target - Card receiving the abilities
 * @param source - Card granting the abilities
 * @param keywords - Keywords to grant (e.g., ["flying", "haste"])
 * @param power - Power bonus
 * @param toughness - Toughness bonus
 * @param duration - How long the grant lasts
 */
export function grantAbilities(
  target: CardInstance,
  source: CardInstance,
  keywords?: string[],
  power?: number,
  toughness?: number,
  duration: "permanent" | "end_of_turn" | "while_on_battlefield" = "while_on_battlefield"
): void {
  if (!target.runtimeAbilityState) {
    return
  }

  const grantedAbility: GrantedAbility = {
    sourceCardId: source.instanceId,
    type: keywords ? "keyword" : "power_toughness",
    keywords,
    power,
    toughness,
    expiresAt: duration,
    timestamp: Date.now()
  }

  target.runtimeAbilityState.grantedAbilities.push(grantedAbility)

  // Invalidate cache
  target.runtimeAbilityState.abilityCache = undefined
}

/**
 * Add a duration effect to a card
 *
 * @param target - Card receiving the effect
 * @param source - Card creating the effect
 * @param effect - Effect details
 * @param expiresAt - When the effect expires
 */
export function addDurationEffect(
  target: CardInstance,
  source: CardInstance,
  effect: DurationEffect['effect'],
  expiresAt: DurationEffect['expiresAt']
): void {
  if (!target.runtimeAbilityState) {
    return
  }

  const durationEffect: DurationEffect = {
    id: `${source.instanceId}-${Date.now()}`,
    sourceCardId: source.instanceId,
    effect,
    expiresAt,
    timestamp: Date.now()
  }

  target.runtimeAbilityState.durationEffects.push(durationEffect)

  // Invalidate cache
  target.runtimeAbilityState.abilityCache = undefined
}

/**
 * Cleanup expired effects from a card
 *
 * @param card - Card to clean up
 * @param expiresAt - Which effects to remove
 */
export function cleanupExpiredEffects(
  card: CardInstance,
  expiresAt: "end_of_turn" | "end_of_combat"
): void {
  if (!card.runtimeAbilityState) {
    return
  }

  // Remove expired duration effects
  const before = card.runtimeAbilityState.durationEffects.length
  card.runtimeAbilityState.durationEffects =
    card.runtimeAbilityState.durationEffects.filter(
      effect => effect.expiresAt !== expiresAt
    )

  // Remove expired granted abilities
  card.runtimeAbilityState.grantedAbilities =
    card.runtimeAbilityState.grantedAbilities.filter(
      ability => ability.expiresAt !== expiresAt
    )

  const after = card.runtimeAbilityState.durationEffects.length
  if (before !== after) {
    // Invalidate cache if anything changed
    card.runtimeAbilityState.abilityCache = undefined
  }
}

/**
 * Cleanup all granted abilities from a specific source
 * (Called when a permanent leaves the battlefield)
 *
 * @param targets - Cards that may have been granted abilities
 * @param sourceId - Instance ID of the card that granted abilities
 */
export function cleanupGrantedAbilitiesFromSource(
  targets: CardInstance[],
  sourceId: string
): void {
  for (const target of targets) {
    if (!target.runtimeAbilityState) {
      continue
    }

    // Remove granted abilities from this source
    const before = target.runtimeAbilityState.grantedAbilities.length
    target.runtimeAbilityState.grantedAbilities =
      target.runtimeAbilityState.grantedAbilities.filter(
        ability => ability.sourceCardId !== sourceId
      )

    // Remove duration effects from this source
    target.runtimeAbilityState.durationEffects =
      target.runtimeAbilityState.durationEffects.filter(
        effect => effect.sourceCardId !== sourceId
      )

    // Remove continuous effects from this source
    target.runtimeAbilityState.continuousEffects =
      target.runtimeAbilityState.continuousEffects.filter(
        effect => effect.sourceCardId !== sourceId
      )

    const after = target.runtimeAbilityState.grantedAbilities.length
    if (before !== after) {
      // Invalidate cache if anything changed
      target.runtimeAbilityState.abilityCache = undefined
    }
  }
}

/**
 * Progress Saga to next chapter
 *
 * @param saga - Saga card instance
 * @returns New chapter number, or null if Saga is complete
 */
export function progressSagaChapter(saga: CardInstance): number | null {
  if (!saga.runtimeAbilityState?.saga) {
    return null
  }

  // Add lore counter
  saga.counters.lore += 1

  // Update current chapter
  const newChapter = saga.counters.lore
  saga.runtimeAbilityState.saga.currentChapter = newChapter
  saga.runtimeAbilityState.saga.chaptersTriggered.push(newChapter)

  // Check if Saga is complete
  if (newChapter >= saga.runtimeAbilityState.saga.maxChapters) {
    return null  // Saga should be sacrificed (unless it's a creature)
  }

  return newChapter
}

/**
 * Remove stun counters during untap
 *
 * @param card - Card to check for stun counters
 * @returns True if card can untap, false if stunned
 */
export function handleStunCounters(card: CardInstance): boolean {
  if (card.counters.stun > 0) {
    card.counters.stun -= 1
    console.log(`[Stun] ${card.name} removed stun counter, stays tapped`)
    return false  // Don't untap
  }
  return true  // Can untap normally
}

/**
 * Check and remove shield counters when preventing damage
 *
 * @param card - Card with potential shield counter
 * @param damage - Amount of damage to prevent
 * @returns Actual damage after shield (0 if prevented)
 */
export function checkShieldCounters(card: CardInstance, damage: number): number {
  if (damage > 0 && card.counters.shield > 0) {
    card.counters.shield -= 1
    console.log(`[Shield] ${card.name} prevented damage with shield counter`)
    return 0  // All damage prevented
  }
  return damage
}
