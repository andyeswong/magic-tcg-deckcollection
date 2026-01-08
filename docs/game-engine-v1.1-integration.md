# Game Engine v1.1 Integration Guide

This guide explains how to integrate the v1.1 ability system into your game engine.

## What Was Added

### 1. **Updated Types** (`lib/game/types.ts`)

**Counters interface** now includes all 12 v1.1 counter types:
```typescript
export interface Counters {
  p1p1: number
  "-1-1": number        // NEW
  loyalty: number
  charge: number
  poison: number
  stun: number          // NEW
  shield: number
  vow: number
  lore: number          // NEW (for Sagas)
  indestructible: number // NEW
  flying: number        // NEW
  first_strike: number  // NEW
}
```

**CardInstance** now has optional runtime ability state:
```typescript
export interface CardInstance {
  // ... existing fields ...
  runtimeAbilityState?: RuntimeAbilityState  // NEW
}
```

### 2. **New Files Created**

- **`lib/game/runtime-ability-state.ts`** - Type definitions for runtime state
- **`lib/game/ability-loader.ts`** - Load abilities from database
- **`lib/game/runtime-state-manager.ts`** - Initialize and manage runtime state
- **`lib/game/ability-checker.ts`** - Check abilities from all sources

---

## Integration Steps

### Step 1: Update Card Creation

When creating cards from database, initialize empty counters:

```typescript
import { createEmptyCounters } from '@/lib/game/runtime-state-manager'

function createCardInstance(dbCard: any): CardInstance {
  return {
    // ... existing fields ...
    counters: createEmptyCounters(),  // NEW - includes all v1.1 counters
    runtimeAbilityState: undefined    // Will be initialized when card enters battlefield
  }
}
```

### Step 2: Initialize Runtime State When Card Enters Battlefield

Update your `playCard` or equivalent function:

```typescript
import { initializeRuntimeState } from '@/lib/game/runtime-state-manager'
import { loadAbilities } from '@/lib/game/ability-loader'

async function playCardToBattlefield(card: CardInstance) {
  // Move card to battlefield
  card.zone = "BATTLEFIELD"

  // Initialize runtime ability state
  const abilityData = await loadAbilities(card.dbReferenceId)
  card.runtimeAbilityState = await initializeRuntimeState(card, abilityData)

  // Log registered abilities
  if (card.runtimeAbilityState.saga) {
    console.log(`[Saga] ${card.name} - ${card.runtimeAbilityState.saga.maxChapters} chapters`)
  }

  if (card.runtimeAbilityState.activeTriggeredAbilities.length > 0) {
    console.log(`[Triggers] ${card.name} - ${card.runtimeAbilityState.activeTriggeredAbilities.length} registered`)
  }

  // Continue with existing ETB logic...
}
```

### Step 3: Use Ability Checkers Instead of Direct Checks

**❌ OLD WAY (WRONG):**
```typescript
// Only checks inherent keywords - misses counters and granted abilities!
if (card.keywords.includes("flying")) {
  // ...
}
```

**✅ NEW WAY (CORRECT):**
```typescript
import { hasKeyword, canBlock, calculatePower } from '@/lib/game/ability-checker'

// Checks ALL sources: inherent, counters, granted, duration effects
if (hasKeyword(card, "flying")) {
  // ...
}

// Check if blocker can block attacker
if (canBlock(blocker, attacker)) {
  // ...
}

// Get current power (includes all modifiers)
const power = calculatePower(card)
```

### Step 4: Handle Stun Counters During Untap Phase

Update your untap phase logic:

```typescript
import { handleStunCounters } from '@/lib/game/runtime-state-manager'

function untapPhase(gameState: GameState) {
  const activePlayer = gameState.players[gameState.turnState.activePlayerId]

  // Untap all permanents
  gameState.battlefield.forEach(cardId => {
    const card = gameState.entities[cardId]

    if (card.controllerId !== activePlayer.id) {
      return  // Only untap active player's permanents
    }

    // Check stun counters BEFORE untapping
    if (handleStunCounters(card)) {
      card.tapped = false  // Can untap
    } else {
      // Card stays tapped (stun counter was removed)
    }
  })
}
```

### Step 5: Handle Shield Counters During Damage

Update your damage dealing logic:

```typescript
import { checkShieldCounters } from '@/lib/game/runtime-state-manager'

function dealDamage(source: CardInstance, target: CardInstance, amount: number) {
  // Check shield counters first
  const actualDamage = checkShieldCounters(target, amount)

  if (actualDamage === 0) {
    console.log(`[Shield] ${target.name} prevented ${amount} damage`)
    return
  }

  // Deal remaining damage
  // ... existing damage logic
}
```

### Step 6: Progress Sagas During Upkeep

Add Saga chapter progression to your upkeep phase:

```typescript
import { progressSagaChapter } from '@/lib/game/runtime-state-manager'
import { loadAbilities } from '@/lib/game/ability-loader'

async function upkeepPhase(gameState: GameState) {
  const activePlayer = gameState.players[gameState.turnState.activePlayerId]

  // Find all Sagas controlled by active player
  const sagas = gameState.battlefield
    .map(id => gameState.entities[id])
    .filter(card =>
      card.controllerId === activePlayer.id &&
      card.runtimeAbilityState?.saga
    )

  for (const saga of sagas) {
    const newChapter = progressSagaChapter(saga)

    if (newChapter === null) {
      // Saga is complete
      console.log(`[Saga] ${saga.name} - Complete`)

      // Load abilities to check if it's a creature
      const abilities = await loadAbilities(saga.dbReferenceId)
      if (!abilities?.abilities.saga?.isCreature) {
        // Sacrifice non-creature Sagas
        moveToZone(saga, "GRAVEYARD")
        continue
      }
    } else {
      console.log(`[Saga] ${saga.name} - Chapter ${newChapter}`)

      // Load abilities and execute chapter effect
      const abilities = await loadAbilities(saga.dbReferenceId)
      if (abilities) {
        const chapter = abilities.abilities.saga?.chapters.find(ch =>
          ch.chapterNumber.includes(newChapter)
        )

        if (chapter) {
          // Execute chapter effect
          await executeEffect(gameState, saga, chapter.effect)
        }
      }
    }
  }
}
```

### Step 7: Cleanup Effects at End of Turn

Add cleanup to your end of turn phase:

```typescript
import { cleanupExpiredEffects } from '@/lib/game/runtime-state-manager'

function cleanupPhase(gameState: GameState) {
  // Cleanup end-of-turn effects for all cards
  Object.values(gameState.entities).forEach(card => {
    cleanupExpiredEffects(card, "end_of_turn")
  })

  // Cleanup end-of-combat effects
  Object.values(gameState.entities).forEach(card => {
    cleanupExpiredEffects(card, "end_of_combat")
  })

  // Continue with existing cleanup logic...
}
```

### Step 8: Cleanup When Permanents Leave Battlefield

Update your zone change logic:

```typescript
import { cleanupGrantedAbilitiesFromSource } from '@/lib/game/runtime-state-manager'

function moveToZone(card: CardInstance, newZone: Zone, gameState: GameState) {
  const oldZone = card.zone

  // If leaving battlefield, cleanup granted abilities
  if (oldZone === "BATTLEFIELD" && newZone !== "BATTLEFIELD") {
    // Remove all effects this card granted to other cards
    const allCards = Object.values(gameState.entities)
    cleanupGrantedAbilitiesFromSource(allCards, card.instanceId)

    // Clear runtime state
    card.runtimeAbilityState = undefined
  }

  // Update zone
  card.zone = newZone

  // Continue with existing zone change logic...
}
```

### Step 9: Grant Abilities from Static Effects

Example: Alibou grants haste to artifact creatures

```typescript
import { grantAbilities } from '@/lib/game/runtime-state-manager'

function applyStaticAbilities(gameState: GameState) {
  // Find all permanents with static abilities
  gameState.battlefield.forEach(async cardId => {
    const card = gameState.entities[cardId]

    // Load abilities
    const abilities = await loadAbilities(card.dbReferenceId)
    if (!abilities) return

    // Process static abilities
    abilities.abilities.static.forEach(staticAbility => {
      if (staticAbility.effect === "keyword_grant") {
        // Example: Alibou grants haste to other artifacts
        const targets = gameState.battlefield
          .map(id => gameState.entities[id])
          .filter(target =>
            target.instanceId !== card.instanceId &&
            target.types.includes("Artifact") &&
            target.types.includes("Creature") &&
            target.controllerId === card.controllerId
          )

        targets.forEach(target => {
          grantAbilities(
            target,
            card,
            ["haste"],  // Keywords to grant
            undefined,  // No power bonus
            undefined,  // No toughness bonus
            "while_on_battlefield"  // Lasts while Alibou is on battlefield
          )
        })
      }
    })
  })
}
```

### Step 10: Preload Abilities for Better Performance

When starting a game, preload all abilities:

```typescript
import { preloadAbilities } from '@/lib/game/ability-loader'

async function startGame(deck: CardInstance[]) {
  // Get all unique card IDs
  const cardIds = [...new Set(deck.map(card => card.dbReferenceId))]

  // Preload all abilities at once
  await preloadAbilities(cardIds)

  // Continue with game setup...
}
```

---

## Common Patterns

### Pattern 1: Check if Card Has Flying

```typescript
import { hasKeyword } from '@/lib/game/ability-checker'

if (hasKeyword(card, "flying")) {
  // Card has flying from ANY source
}
```

### Pattern 2: Get Current Power/Toughness

```typescript
import { calculatePower, calculateToughness } from '@/lib/game/ability-checker'

const power = calculatePower(card)
const toughness = calculateToughness(card)

console.log(`${card.name} is ${power}/${toughness}`)
```

### Pattern 3: Add Temporary Effect Until End of Turn

```typescript
import { addDurationEffect } from '@/lib/game/runtime-state-manager'

// Giant Growth: +3/+3 until end of turn
addDurationEffect(
  target,
  source,
  {
    type: "power_toughness",
    powerBonus: 3,
    toughnessBonus: 3
  },
  "end_of_turn"
)
```

### Pattern 4: Check All Keywords on a Card

```typescript
import { getAllKeywords } from '@/lib/game/ability-checker'

const keywords = getAllKeywords(card)
console.log(`${card.name} has: ${keywords.join(", ")}`)
```

---

## Migration Checklist

- [ ] Update all card creation to use `createEmptyCounters()`
- [ ] Initialize `runtimeAbilityState` when cards enter battlefield
- [ ] Replace all `card.keywords.includes()` with `hasKeyword()`
- [ ] Replace direct power/toughness checks with `calculatePower/Toughness()`
- [ ] Add `handleStunCounters()` to untap phase
- [ ] Add `checkShieldCounters()` to damage dealing
- [ ] Add `progressSagaChapter()` to upkeep phase
- [ ] Add `cleanupExpiredEffects()` to cleanup phase
- [ ] Add `cleanupGrantedAbilitiesFromSource()` to zone changes
- [ ] Preload abilities at game start for performance

---

## Testing

### Test 1: Flying Counters
```typescript
// Card with flying counter enters
card.counters.flying = 1

// Should return true (checks counters)
assert(hasKeyword(card, "flying") === true)
```

### Test 2: Granted Haste
```typescript
// Alibou grants haste to artifact
grantAbilities(artifact, alibou, ["haste"], undefined, undefined, "while_on_battlefield")

// Should return true (checks granted abilities)
assert(hasKeyword(artifact, "haste") === true)

// When Alibou leaves battlefield
cleanupGrantedAbilitiesFromSource([artifact], alibou.instanceId)

// Should return false (granted ability removed)
assert(hasKeyword(artifact, "haste") === false)
```

### Test 3: Stun Counters
```typescript
// Card with stun counter
card.counters.stun = 2

// During untap
const canUntap = handleStunCounters(card)
assert(canUntap === false)  // Stays tapped
assert(card.counters.stun === 1)  // Counter removed
```

### Test 4: Saga Progression
```typescript
// Saga enters
saga.runtimeAbilityState = await initializeRuntimeState(saga)

// During upkeep
const chapter = progressSagaChapter(saga)
assert(chapter === 1)  // Chapter I
assert(saga.counters.lore === 1)
```

---

## Performance Considerations

1. **Ability caching** - `hasKeyword()` checks cache first (100ms TTL)
2. **Preload abilities** - Use `preloadAbilities()` at game start
3. **Invalidate cache** - Call `invalidateAbilityCache()` after state changes

---

## Debugging

Enable ability logging:
```typescript
// In ability-loader.ts
console.log('[AbilityLoader] Loaded abilities for', cardName)

// In runtime-state-manager.ts
console.log('[Saga] Chapter', chapter, 'triggered')
console.log('[Stun] Counter removed, stays tapped')
console.log('[Shield] Damage prevented')
```

---

## Next Steps

1. Integrate these changes into `lib/game/store.ts`
2. Update combat system to use `hasKeyword()` and `canBlock()`
3. Update phase management to handle Sagas and stun counters
4. Test with cards from your collection
5. Add UI to show granted abilities and duration effects

---

## Summary

**Before:**
- Only 6 counter types
- No runtime ability tracking
- Only checked inherent keywords
- No Saga support
- No granted ability tracking

**After:**
- 12 counter types (full v1.1 support)
- Complete runtime ability state
- Checks all ability sources (inherent, counters, granted, duration)
- Full Saga support
- Granted abilities tracked and cleaned up properly

Your game engine now fully supports the v1.1 ability system! 🎉
