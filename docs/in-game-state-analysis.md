# In-Game State JSON Standard - Analysis & Proposal

## The Problem: Static Definitions vs Dynamic Runtime State

Your current system has a **critical gap**:

### What You Have:

1. **Static Ability JSON (v1.1)** - Stored in database (`card_abilities` table)
   - Defines what a card CAN do
   - Complete ability definitions
   - Trigger conditions and effects
   - Never changes during gameplay

2. **Runtime Card State** - In `CardInstance` type
   - Current zone, tapped state
   - Only 6 counter types (missing 5 from v1.1!)
   - Basic `temporaryModifiers` (string-based)
   - No ability tracking

### What's Missing:

**The bridge between static definitions and runtime execution.**

Your game engine needs to:
- ✅ Load static ability JSON from database (NOT IMPLEMENTED YET)
- ❌ Track which abilities are currently active
- ❌ Track abilities granted by other cards
- ❌ Track duration-based effects ("until end of turn")
- ❌ Track Saga chapter progression
- ❌ Track pending/delayed triggers
- ❌ Track continuous effects from static abilities

---

## Current State Gaps - Detailed Analysis

### Gap 1: Missing Counter Types in Runtime

**v1.1 Standard defines 12 counter types:**
```typescript
type CounterType =
  | "p1p1" | "-1-1" | "loyalty" | "charge" | "poison"  // ✅ In CardInstance
  | "stun" | "shield" | "vow" | "lore" | "indestructible" | "flying" | "first_strike"  // ❌ MISSING
```

**Current CardInstance.counters:**
```typescript
interface Counters {
  p1p1: number      // ✅
  loyalty: number   // ✅
  charge: number    // ✅
  poison: number    // ✅
  shield: number    // ✅
  vow: number       // ✅
  // MISSING: stun, lore, indestructible, flying, first_strike
}
```

**Impact:** Cards like Summon: Valefor (stun counters), Protection Magic (indestructible counters), and all Sagas (lore counters) **cannot function**.

---

### Gap 2: No Ability State Tracking

**Problem:** Your game engine has no way to track:

- Which triggered abilities are registered and active
- Which static abilities are currently affecting the game
- Which abilities were granted by other permanents
- Whether a conditional ability is currently active (metalcraft, threshold)

**Example - Alibou, Ancient Witness:**

Static JSON defines:
```json
{
  "static": [{
    "effect": "keyword_grant",
    "targets": { "cardTypes": ["artifact", "creature"] },
    "bonus": { "keywords": ["haste"] }
  }]
}
```

**Runtime question:** Which artifacts currently have haste from Alibou?

**Current system:** No tracking. Must re-evaluate all static effects every time.

**Better system:** Track granted abilities on affected cards.

---

### Gap 3: No Saga Chapter Tracking

**Problem:** Sagas need to track current chapter and trigger chapter abilities.

**Current CardInstance:** No `currentChapter` field, no `lore` counter.

**Example - Summon: Ixion:**
- Needs `counters.lore` to track chapter progression
- Needs to know "Chapter I already triggered, Chapter II/III combined trigger next"

---

### Gap 4: No Duration Effect Tracking

**Problem:** Effects like "until end of turn" have no structured tracking.

**Examples:**
- Cyberdrive Awakener: "Artifacts you control become 4/4 creatures until end of turn"
- Giant Growth: "Target creature gets +3/+3 until end of turn"
- Collective Effort: "Tap up to two target creatures"

**Current system:** Uses string-based `temporaryModifiers[]`

**Issues:**
- No type safety
- No structured cleanup
- Hard to query ("does this have +3/+3 until end of turn?")
- Hard to display in UI

---

### Gap 5: No Granted Ability Tracking

**Problem:** When a static ability grants keywords to other creatures, those keywords aren't tracked.

**Example - Alibou grants haste:**

```typescript
// Current: No tracking
const hasHaste = card.keywords.includes("haste")  // ❌ Misses granted haste

// Better: Track granted abilities
const hasHaste =
  card.keywords.includes("haste") ||  // Inherent
  card.runtimeState.grantedKeywords.includes("haste") ||  // From static effects
  card.counters.haste > 0  // From counters
```

---

### Gap 6: No Replacement Effect State

**Problem:** Replacement effects need to track state.

**Example - Hardened Scales:**
- "If one or more +1/+1 counters would be placed on a creature you control, that many plus one are placed instead"
- Needs to track: Is this replacement active? Has it been applied this turn?

**Example - Shield Counters:**
- Prevent next damage, then remove counter
- Needs to track: Has this shield prevented damage this combat?

---

### Gap 7: No Triggered Ability Queue State

**Problem:** The game has `triggerQueue: PendingTrigger[]` in global state, but no link back to the card's ability JSON.

**Current PendingTrigger:**
```typescript
interface PendingTrigger {
  id: string
  sourceCardId: string
  triggerType: string
  description: string
  controllerId: string
}
```

**Missing:**
- Link to ability JSON (`abilityId`)
- Ability's full effect definition
- Trigger conditions for validation

---

## Proposed Solution: Runtime Ability State

**Add a new field to `CardInstance`:**

```typescript
interface CardInstance {
  // ... existing fields ...

  // NEW: Runtime ability state
  runtimeAbilityState?: RuntimeAbilityState
}

interface RuntimeAbilityState {
  // Link to static ability JSON
  staticAbilitiesId?: string  // References card_abilities.id

  // Counters (EXPANDED to match v1.1)
  counters: {
    p1p1: number
    "-1-1": number
    loyalty: number
    charge: number
    poison: number
    stun: number          // NEW
    shield: number
    vow: number
    lore: number          // NEW - for Sagas
    indestructible: number  // NEW
    flying: number        // NEW
    first_strike: number  // NEW
  }

  // Saga state
  saga?: {
    currentChapter: number
    chaptersTriggered: number[]
  }

  // Active triggered abilities (registered with game engine)
  activeTriggeredAbilities: {
    abilityIndex: number  // Index in static abilities.triggered[]
    isActive: boolean
    triggersSinceETB: number
  }[]

  // Granted abilities from other permanents
  grantedAbilities: {
    sourceCardId: string  // Card granting the ability
    type: "keyword" | "static" | "activated"
    keywords?: string[]   // ["flying", "haste"]
    power?: number
    toughness?: number
    expiresAt?: "end_of_turn" | "while_on_battlefield" | "permanent"
  }[]

  // Duration-based effects (until end of turn, etc.)
  durationEffects: {
    id: string
    sourceCardId: string
    effect: {
      type: "power_toughness" | "keyword" | "type_change" | "tap_untap" | "custom"
      powerBonus?: number
      toughnessBonus?: number
      keywords?: string[]
      becomesTypes?: string[]
    }
    expiresAt: "end_of_turn" | "end_of_combat" | "next_upkeep" | "while_tapped"
    timestamp: number  // For layer ordering
  }[]

  // Active replacement effects
  activeReplacements: {
    abilityIndex: number  // Index in static abilities.replacement[]
    timesApplied: number
    maxApplications?: number  // For "once per turn" effects
  }[]

  // Continuous effects currently affecting this card
  continuousEffects: {
    sourceCardId: string
    layer: number  // MTG layer system (1-7)
    effect: {
      type: "power_toughness" | "keyword" | "ability_grant" | "type_change"
      value: any
    }
    timestamp: number
  }[]

  // Cached ability checks (for performance)
  abilityCache?: {
    hasFlying: boolean
    hasIndestructible: boolean
    hasHaste: boolean
    currentPower: number
    currentToughness: number
    cachedAt: number  // Invalidate cache when state changes
  }
}
```

---

## Benefits of This Approach

### 1. **Complete v1.1 Counter Support**
All 12 counter types from v1.1 are now tracked at runtime.

```typescript
// Protection Magic: "Put an indestructible counter on target creature"
card.runtimeAbilityState.counters.indestructible += 1

// Summon: Valefor: "Put two stun counters on target creature"
card.runtimeAbilityState.counters.stun += 2

// All Sagas: Add lore counter during upkeep
sagaCard.runtimeAbilityState.counters.lore += 1
sagaCard.runtimeAbilityState.saga.currentChapter = counters.lore
```

### 2. **Explicit Ability Tracking**

```typescript
// When Alibou ETBs, register its static ability
alibou.runtimeAbilityState.activeTriggeredAbilities = [
  { abilityIndex: 0, isActive: true, triggersSinceETB: 0 },  // Attack trigger
  { abilityIndex: 1, isActive: true, triggersSinceETB: 0 }   // Scry trigger
]

// When artifacts attack, find and execute the triggers
const triggers = alibou.runtimeAbilityState.activeTriggeredAbilities
  .filter(t => t.isActive)
  .map(t => staticAbilities.triggered[t.abilityIndex])
```

### 3. **Granted Ability Tracking**

```typescript
// When Alibou is on battlefield
otherArtifactCreatures.forEach(card => {
  card.runtimeAbilityState.grantedAbilities.push({
    sourceCardId: alibou.instanceId,
    type: "keyword",
    keywords: ["haste"],
    expiresAt: "while_on_battlefield"  // Expires when Alibou leaves
  })
})

// Check if card has haste (from ANY source)
function hasHaste(card: CardInstance): boolean {
  return card.keywords.includes("haste") ||  // Inherent
    card.runtimeAbilityState?.counters.haste > 0 ||  // Counter
    card.runtimeAbilityState?.grantedAbilities.some(
      g => g.keywords?.includes("haste")
    )  // Granted
}
```

### 4. **Duration Effect Management**

```typescript
// Cyberdrive Awakener: Artifacts become 4/4 creatures until end of turn
affectedArtifacts.forEach(artifact => {
  artifact.runtimeAbilityState.durationEffects.push({
    id: generateId(),
    sourceCardId: cyberdriveAwakener.instanceId,
    effect: {
      type: "type_change",
      becomesTypes: ["Artifact", "Creature"],
      powerBonus: 4,
      toughnessBonus: 4
    },
    expiresAt: "end_of_turn",
    timestamp: Date.now()
  })
})

// During cleanup phase, remove expired effects
function cleanupEndOfTurnEffects(gameState: GameState) {
  Object.values(gameState.entities).forEach(card => {
    if (card.runtimeAbilityState) {
      card.runtimeAbilityState.durationEffects =
        card.runtimeAbilityState.durationEffects.filter(
          effect => effect.expiresAt !== "end_of_turn"
        )
    }
  })
}
```

### 5. **Saga Chapter Management**

```typescript
// During upkeep phase
function handleSagaUpkeep(saga: CardInstance, gameState: GameState) {
  if (!saga.runtimeAbilityState?.saga) return

  // Add lore counter
  saga.runtimeAbilityState.counters.lore += 1
  const newChapter = saga.runtimeAbilityState.counters.lore

  // Load static ability JSON
  const abilityJson = loadAbilities(saga.dbReferenceId)

  // Find matching chapter effect
  const chapterEffect = abilityJson.saga.chapters.find(ch =>
    ch.chapterNumber.includes(newChapter)
  )

  if (chapterEffect) {
    // Execute chapter effect
    executeEffect(gameState, saga, chapterEffect.effect)
    saga.runtimeAbilityState.saga.chaptersTriggered.push(newChapter)
  }

  // Check if Saga is complete
  if (newChapter >= abilityJson.saga.maxChapters) {
    // Sacrifice Saga (unless it's a creature like Summon: Ixion)
    if (!abilityJson.saga.isCreature) {
      moveToZone(saga, "GRAVEYARD")
    }
  }
}
```

### 6. **Performance Caching**

```typescript
// Cache expensive ability checks
function updateAbilityCache(card: CardInstance) {
  card.runtimeAbilityState.abilityCache = {
    hasFlying: hasKeyword(card, "flying"),  // Checks all sources
    hasIndestructible: hasKeyword(card, "indestructible"),
    hasHaste: hasKeyword(card, "haste"),
    currentPower: calculatePower(card),  // Includes all modifiers
    currentToughness: calculateToughness(card),
    cachedAt: Date.now()
  }
}

// Use cached values for performance
function canBlock(blocker: CardInstance, attacker: CardInstance): boolean {
  const attackerFlying = blocker.runtimeAbilityState?.abilityCache?.hasFlying
  const blockerFlying = blocker.runtimeAbilityState?.abilityCache?.hasFlying

  // Invalidate cache if too old (> 100ms)
  if (Date.now() - blocker.runtimeAbilityState.abilityCache.cachedAt > 100) {
    updateAbilityCache(blocker)
  }

  // Flying check
  if (attackerFlying && !blockerFlying) {
    return false
  }

  return true
}
```

---

## Implementation Plan

### Phase 1: Update Types

1. **Update `Counters` interface in `lib/game/types.ts`:**

```typescript
export interface Counters {
  p1p1: number
  "-1-1": number
  loyalty: number
  charge: number
  poison: number
  stun: number          // NEW
  shield: number
  vow: number
  lore: number          // NEW
  indestructible: number  // NEW
  flying: number        // NEW
  first_strike: number  // NEW
}
```

2. **Add `RuntimeAbilityState` to `CardInstance`:**

```typescript
export interface CardInstance {
  // ... existing fields ...
  runtimeAbilityState?: RuntimeAbilityState
}
```

3. **Create `lib/game/runtime-ability-state.ts`:**

```typescript
export interface RuntimeAbilityState {
  staticAbilitiesId?: string
  counters: Counters
  saga?: SagaState
  activeTriggeredAbilities: ActiveTriggeredAbility[]
  grantedAbilities: GrantedAbility[]
  durationEffects: DurationEffect[]
  activeReplacements: ActiveReplacement[]
  continuousEffects: ContinuousEffect[]
  abilityCache?: AbilityCache
}

// Define all sub-interfaces
```

### Phase 2: Create Runtime State Manager

**File: `lib/game/ability-runtime-manager.ts`**

```typescript
/**
 * Initialize runtime ability state for a card
 */
export function initializeRuntimeState(
  card: CardInstance,
  staticAbilitiesId?: string
): RuntimeAbilityState {
  return {
    staticAbilitiesId,
    counters: {
      p1p1: 0, "-1-1": 0, loyalty: 0, charge: 0, poison: 0,
      stun: 0, shield: 0, vow: 0, lore: 0,
      indestructible: 0, flying: 0, first_strike: 0
    },
    activeTriggeredAbilities: [],
    grantedAbilities: [],
    durationEffects: [],
    activeReplacements: [],
    continuousEffects: [],
    abilityCache: undefined
  }
}

/**
 * Register triggered abilities from static JSON
 */
export async function registerTriggeredAbilities(
  card: CardInstance,
  gameState: GameState
) {
  const abilities = await loadAbilities(card.dbReferenceId)

  if (!abilities?.triggered) return

  card.runtimeAbilityState.activeTriggeredAbilities =
    abilities.triggered.map((_, index) => ({
      abilityIndex: index,
      isActive: true,
      triggersSinceETB: 0
    }))
}

/**
 * Grant abilities from static effect
 */
export function grantAbilities(
  source: CardInstance,
  targets: CardInstance[],
  keywords: string[],
  duration: "permanent" | "end_of_turn" | "while_on_battlefield"
) {
  targets.forEach(target => {
    target.runtimeAbilityState.grantedAbilities.push({
      sourceCardId: source.instanceId,
      type: "keyword",
      keywords,
      expiresAt: duration
    })

    // Invalidate cache
    target.runtimeAbilityState.abilityCache = undefined
  })
}

/**
 * Cleanup expired effects
 */
export function cleanupExpiredEffects(
  gameState: GameState,
  expiresAt: "end_of_turn" | "end_of_combat"
) {
  Object.values(gameState.entities).forEach(card => {
    if (!card.runtimeAbilityState) return

    // Remove expired duration effects
    card.runtimeAbilityState.durationEffects =
      card.runtimeAbilityState.durationEffects.filter(
        effect => effect.expiresAt !== expiresAt
      )

    // Remove expired granted abilities
    card.runtimeAbilityState.grantedAbilities =
      card.runtimeAbilityState.grantedAbilities.filter(
        ability => ability.expiresAt !== expiresAt
      )

    // Invalidate cache
    card.runtimeAbilityState.abilityCache = undefined
  })
}

/**
 * Update ability cache
 */
export function updateAbilityCache(card: CardInstance) {
  card.runtimeAbilityState.abilityCache = {
    hasFlying: hasKeyword(card, "flying"),
    hasIndestructible: hasKeyword(card, "indestructible"),
    hasHaste: hasKeyword(card, "haste"),
    currentPower: calculatePower(card),
    currentToughness: calculateToughness(card),
    cachedAt: Date.now()
  }
}
```

### Phase 3: Update Game Engine

**Update `lib/game/store.ts` actions:**

```typescript
// When card enters battlefield
playCard: (cardId: string) => {
  const card = get().gameState.entities[cardId]

  // Initialize runtime state
  card.runtimeAbilityState = initializeRuntimeState(card)

  // Register triggered abilities
  registerTriggeredAbilities(card, gameState)

  // Apply static abilities
  applyStaticAbilities(card, gameState)
}

// During cleanup phase
endTurn: () => {
  const gameState = get().gameState

  // Cleanup end-of-turn effects
  cleanupExpiredEffects(gameState, "end_of_turn")

  // Move to next turn
  advancePhase()
}
```

### Phase 4: Update Ability Checker

**Update `lib/game/ability-checker.ts`:**

```typescript
/**
 * Check if card has keyword (from ANY source)
 */
export function hasKeyword(card: CardInstance, keyword: string): boolean {
  // Check cache first
  if (card.runtimeAbilityState?.abilityCache) {
    const cache = card.runtimeAbilityState.abilityCache
    if (Date.now() - cache.cachedAt < 100) {  // 100ms cache
      switch (keyword) {
        case "flying": return cache.hasFlying
        case "indestructible": return cache.hasIndestructible
        case "haste": return cache.hasHaste
      }
    }
  }

  // 1. Check inherent keywords
  if (card.keywords.includes(keyword)) {
    return true
  }

  // 2. Check keyword counters
  const counterType = KEYWORD_TO_COUNTER[keyword.toLowerCase()]
  if (counterType && card.runtimeAbilityState?.counters[counterType] > 0) {
    return true
  }

  // 3. Check granted abilities
  if (card.runtimeAbilityState?.grantedAbilities.some(
    g => g.keywords?.includes(keyword)
  )) {
    return true
  }

  // 4. Check duration effects
  if (card.runtimeAbilityState?.durationEffects.some(
    e => e.effect.keywords?.includes(keyword)
  )) {
    return true
  }

  return false
}

/**
 * Calculate current power (including all modifiers)
 */
export function calculatePower(card: CardInstance): number {
  let power = parseInt(card.power || "0")

  // Add +1/+1 counters
  power += card.runtimeAbilityState?.counters.p1p1 || 0

  // Subtract -1/-1 counters
  power -= card.runtimeAbilityState?.counters["-1-1"] || 0

  // Add duration effect bonuses
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
      power += effect.effect.value.power || 0
    }
  })

  return Math.max(0, power)  // Power can't go below 0
}
```

---

## Migration Strategy

### Option A: Gradual Migration (Recommended)

1. **Add optional `runtimeAbilityState` field**
2. **Initialize for new cards only**
3. **Existing cards continue to work without it**
4. **Migrate features incrementally:**
   - Week 1: Add missing counter types
   - Week 2: Add Saga support
   - Week 3: Add granted ability tracking
   - Week 4: Add duration effects

### Option B: Full Migration

1. **Make `runtimeAbilityState` required**
2. **Initialize for all cards when game starts**
3. **Migrate all features at once**
4. **Higher risk, faster completion**

---

## Comparison: Before vs After

### Before (Current System)

**Card with flying counter enters:**
```typescript
// 1. Card enters battlefield
const card = createCardInstance(cardData)
card.counters.flying = 1  // ❌ ERROR: 'flying' doesn't exist on Counters

// 2. Check if can block flying creature
function canBlock(blocker, attacker) {
  // ❌ Can't check flying counter - not in type system
  return blocker.keywords.includes("flying")
}
```

**Saga enters:**
```typescript
const saga = createCardInstance(sagaData)
saga.counters.lore = 0  // ❌ ERROR: 'lore' doesn't exist

// ❌ No way to track chapter progression
```

**Alibou grants haste:**
```typescript
// ❌ No structured way to track granted abilities
// Must re-evaluate static effects every time
```

### After (With Runtime State)

**Card with flying counter enters:**
```typescript
// 1. Card enters battlefield
const card = createCardInstance(cardData)
card.runtimeAbilityState = initializeRuntimeState(card)
card.runtimeAbilityState.counters.flying = 1  // ✅ Works!

// 2. Check if can block flying creature
function canBlock(blocker, attacker) {
  return hasKeyword(blocker, "flying")  // ✅ Checks all sources
}
```

**Saga enters:**
```typescript
const saga = createCardInstance(sagaData)
saga.runtimeAbilityState = initializeRuntimeState(saga)
saga.runtimeAbilityState.saga = {
  currentChapter: 0,
  chaptersTriggered: []
}

// During upkeep
saga.runtimeAbilityState.counters.lore += 1
saga.runtimeAbilityState.saga.currentChapter =
  saga.runtimeAbilityState.counters.lore
```

**Alibou grants haste:**
```typescript
// When Alibou ETBs
const artifacts = getArtifactCreatures(gameState, alibou.controllerId)
grantAbilities(alibou, artifacts, ["haste"], "while_on_battlefield")

// Each artifact now has:
artifact.runtimeAbilityState.grantedAbilities = [{
  sourceCardId: alibou.instanceId,
  type: "keyword",
  keywords: ["haste"],
  expiresAt: "while_on_battlefield"
}]

// When checking if artifact has haste
hasKeyword(artifact, "haste")  // ✅ Returns true (from granted)
```

---

## Recommendation: YES, Implement Runtime Ability State

### Why:

1. **Required for v1.1 feature support** - Missing counter types block Sagas, keyword counters, etc.
2. **Improves game correctness** - Properly tracks granted abilities, duration effects
3. **Better developer experience** - Type-safe, structured state instead of strings
4. **Better player experience** - Can show what effects are active in UI
5. **Enables future features** - Layer system, dependency-based effect ordering
6. **Fixes current bugs** - Flying counters, stun counters, etc. don't work

### What NOT to do:

❌ **Don't duplicate the entire ability JSON** - Keep static definitions in database

❌ **Don't serialize runtime state** - Rebuild it when loading saved games

❌ **Don't make it too complex** - Start with counters + granted abilities, add more later

### What TO do:

✅ **Start with missing counter types** - Critical blocker for v1.1 cards

✅ **Add Saga state** - Needed for Summon series

✅ **Add granted ability tracking** - Needed for Alibou, Lux Artillery, etc.

✅ **Add duration effects** - Needed for "until end of turn" effects

✅ **Keep it optional initially** - Gradual migration, backward compatible

---

## Next Steps

1. **Update `Counters` interface** - Add 5 missing counter types
2. **Create `RuntimeAbilityState` types** - New file `lib/game/runtime-ability-state.ts`
3. **Create runtime manager** - Helper functions for state management
4. **Update ability checker** - Check all sources (inherent, counters, granted)
5. **Update game engine** - Initialize runtime state on ETB, cleanup on phases
6. **Test with v1.1 cards** - Sagas, keyword counters, granted abilities

---

## Summary

**Current State:**
- Static ability JSON (v1.1) exists but isn't loaded or used
- Runtime state is basic and missing 5 counter types
- No tracking of granted abilities, duration effects, or Saga progression

**Proposed State:**
- Keep static ability JSON in database (source of truth)
- Add `runtimeAbilityState` to `CardInstance` (runtime tracking)
- Bridge the gap between static definitions and dynamic gameplay

**Impact:**
- ✅ Enables 100% of v1.1 cards to function
- ✅ Fixes flying counter, stun counter, lore counter support
- ✅ Enables Sagas to work properly
- ✅ Enables granted ability tracking (Alibou, etc.)
- ✅ Enables duration effects ("until end of turn")
- ✅ Improves performance with caching
- ✅ Better UI feedback

**Recommendation: Implement this system.** It's not optional if you want v1.1 cards to work correctly.
