/**
 * Ability Loader
 *
 * Fetches card abilities from the database and caches them in memory.
 */

import { createClient } from '@supabase/supabase-js'
import type { CardAbilityData } from './runtime-ability-state'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

// In-memory cache to avoid repeated database queries
const abilityCache = new Map<string, CardAbilityData | null>()

/**
 * Load abilities for a card from database
 *
 * @param cardId - Database card ID (dbReferenceId)
 * @returns Parsed ability data or null if not found
 */
export async function loadAbilities(cardId: string): Promise<CardAbilityData | null> {
  // Check cache first
  if (abilityCache.has(cardId)) {
    const cached = abilityCache.get(cardId) || null
    if (cached) {
      console.log(`[AbilitySystem] Using cached abilities for card ${cardId}`)
    }
    return cached
  }

  try {
    const { data, error } = await supabase
      .from('card_abilities')
      .select('*')
      .eq('card_id', cardId)
      .single()

    if (error) {
      console.log(`[AbilitySystem] No JSON abilities found for card ${cardId} - will use fallback parsing`)
      abilityCache.set(cardId, null)
      return null
    }

    if (!data) {
      console.log(`[AbilitySystem] No JSON abilities found for card ${cardId} - will use fallback parsing`)
      abilityCache.set(cardId, null)
      return null
    }

    // Parse abilities JSON
    const abilities = typeof data.abilities === 'string'
      ? JSON.parse(data.abilities)
      : data.abilities

    const abilityData: CardAbilityData = {
      version: data.schema_version,
      cardId: data.card_id,
      cardName: '', // Will be filled from CardInstance
      abilities: abilities,
      parsing_confidence: parseFloat(data.parsing_confidence || '0'),
      parsing_notes: data.parsing_notes || ''
    }

    // Cache the result
    abilityCache.set(cardId, abilityData)

    console.log(`[AbilitySystem] Loaded JSON abilities for card ${cardId}`, {
      hasStatic: abilityData.abilities.static?.length > 0,
      hasTriggered: abilityData.abilities.triggered?.length > 0,
      hasActivated: abilityData.abilities.activated?.length > 0,
      hasReplacement: abilityData.abilities.replacement?.length > 0,
      hasSaga: !!abilityData.abilities.saga,
      confidence: abilityData.parsing_confidence
    })

    return abilityData

  } catch (error) {
    console.error(`[AbilityLoader] Error loading abilities for card ${cardId}:`, error)
    abilityCache.set(cardId, null)
    return null
  }
}

/**
 * Preload abilities for multiple cards (batch optimization)
 *
 * @param cardIds - Array of card IDs to load
 */
export async function preloadAbilities(cardIds: string[]): Promise<void> {
  // Filter out already cached cards
  const uncachedIds = cardIds.filter(id => !abilityCache.has(id))

  if (uncachedIds.length === 0) {
    return
  }

  try {
    console.log(`[AbilitySystem] Preloading ${uncachedIds.length} card abilities from database`)

    const { data, error } = await supabase
      .from('card_abilities')
      .select('*')
      .in('card_id', uncachedIds)

    if (error) {
      console.error('[AbilitySystem] Error preloading abilities:', error)
      return
    }

    if (!data) {
      return
    }

    console.log(`[AbilitySystem] Successfully preloaded ${data.length} card abilities`)

    // Cache all loaded abilities
    for (const row of data) {
      const abilities = typeof row.abilities === 'string'
        ? JSON.parse(row.abilities)
        : row.abilities

      const abilityData: CardAbilityData = {
        version: row.schema_version,
        cardId: row.card_id,
        cardName: '',
        abilities: abilities,
        parsing_confidence: parseFloat(row.parsing_confidence || '0'),
        parsing_notes: row.parsing_notes || ''
      }

      abilityCache.set(row.card_id, abilityData)
    }

    // Mark uncached cards that weren't found as null
    const foundIds = data.map(row => row.card_id)
    const notFoundIds = uncachedIds.filter(id => !foundIds.includes(id))
    notFoundIds.forEach(id => abilityCache.set(id, null))

  } catch (error) {
    console.error('[AbilityLoader] Error preloading abilities:', error)
  }
}

/**
 * Clear ability cache (useful for development/testing)
 */
export function clearAbilityCache(): void {
  abilityCache.clear()
}

/**
 * Get cache size (for debugging)
 */
export function getAbilityCacheSize(): number {
  return abilityCache.size
}
