# Magic TCG Game Engine - Current State & Context

**Last Updated:** January 8, 2026
**Purpose:** Technical documentation for AI handoff and continuation

---

## Project Overview

A browser-based Magic: The Gathering Commander game engine built with Next.js, React, TypeScript, and Supabase. The engine implements core MTG rules, card abilities, and combat mechanics with a focus on the JSON-based ability system (v1.1).

### Tech Stack
- **Frontend:** Next.js 14, React, TypeScript, TailwindCSS
- **State Management:** Zustand
- **Database:** Supabase (PostgreSQL)
- **UI Components:** Shadcn/ui
- **Game Logic:** Pure TypeScript (lib/game/)

---

## Architecture Overview

### Key Directories
```
lib/game/
├── actions.ts              # Core game actions (play, cast, draw, combat)
├── ability-loader.ts       # Loads JSON abilities from database
├── runtime-state-manager.ts # Manages runtime ability state
├── runtime-ability-state.ts # Type definitions for abilities
├── card-effects.ts         # Text parsing fallback & effect execution
├── spell-parser.ts         # Spell effect parsing
├── spell-executor.ts       # Spell effect execution
├── bot.ts                  # AI opponent logic
├── store.ts                # Zustand game state store
├── init.ts                 # Game initialization
└── types.ts                # Core type definitions
```

### State Flow
1. **User Action** → UI Component
2. **Store Method** → lib/game/actions.ts
3. **Game State Mutation** → In-place updates
4. **Store Update** → `set({ gameState: { ...gameState } })`
5. **UI Re-render** → React components update

---

## JSON Ability System (v1.1)

### Overview
Cards can have abilities stored as structured JSON in the `card_abilities` table instead of relying solely on text parsing. This provides more accurate and consistent ability execution.

### Database Schema
```sql
table: card_abilities
- id (uuid)
- card_id (uuid, references cards.id)
- schema_version (text) -- "1.1"
- abilities (jsonb) -- Structured ability data
- has_static_abilities (boolean)
- has_triggered_abilities (boolean)
- has_activated_abilities (boolean)
- has_replacement_effects (boolean)
- has_keywords (boolean)
- parsing_confidence (numeric)
- parsing_notes (text)
```

### Ability Structure
```typescript
{
  "saga": SagaAbility | null,
  "static": StaticAbility[],
  "keywords": KeywordAbility[],
  "activated": ActivatedAbility[],
  "triggered": TriggeredAbility[],
  "replacement": ReplacementEffect[]
}
```

### Key Types

#### Activated Ability
```typescript
{
  "type": "activated",
  "cost": {
    "tap": boolean,
    "mana": { "amount": number, "colors": string[] },
    "additionalCosts": [...] // Not yet fully implemented
  },
  "effect": {
    "action": "add_mana" | "add_counters" | "search_library" | ...,
    "mana": { "amount": number, "colors": ["colorless" | "W" | "U" | "B" | "R" | "G"] },
    "counters": { "type": "p1p1" | "loyalty" | ..., "amount": number },
    "targets": { "type": "single" | "multiple", "restriction": string, "filters": [...] }
  },
  "timing": "instant" | "sorcery"
}
```

#### Replacement Effect
```typescript
{
  "type": "replacement",
  "replaces": "etb" | "damage" | ...,
  "condition": { "source": "this" | ... },
  "modification": {  // Note: NOT "effect"
    "type": "add_counters",
    "counters": { "type": "p1p1", "amount": 1 }
  }
}
```

#### Triggered Ability
```typescript
{
  "type": "triggered",
  "trigger": {
    "event": "etb" | "self_etb" | "draw" | "attack" | "dies" | ...,
    "condition": { ... }
  },
  "effect": {
    "action": "add_counters" | "draw_card" | "create_token" | ...,
    "targets": { ... }
  }
}
```

---

## Recent Changes & Fixes

### Session Summary (January 8, 2026)

#### 1. **JSON Ability System Integration** ✅
**Problem:** Game engine was updated to use JSON abilities but implementation was incomplete.

**Changes:**
- `lib/game/actions.ts`: Added JSON ability loading in 3 key locations:
  - `playLand()` (lines 157-218)
  - `castCommanderFromCommandZone()` (lines 436-508)
  - `resolveStackItem()` (lines 627-735)
- All cards now attempt to load JSON abilities first, fall back to text parsing
- Added logging: `[AbilitySystem] <Card> using JSON abilities from database`

#### 2. **Mana Logs Removed** ✅
**Changes:**
- Removed all `[MANA]` console logs from `helpers.ts` and `actions.ts`
- Cleaner log output focused on ability system

#### 3. **Replacement Effect Bug Fixed** ✅
**Problem:** Code tried to access `replacement.effect.action` but JSON uses `replacement.modification`.

**Solution:**
- Updated all 3 ETB locations to check both `replacement.effect` OR `replacement.modification`
- Added null safety with `effectData?.action`
- Validates counter type exists before applying

**Code Pattern:**
```typescript
const effectData = replacement.effect || replacement.modification
if (effectData?.action === "add_counters" && effectData.counters) {
  // Apply counters
}
```

#### 4. **Async Store Updates** ✅
**Problem:** Async ability loading modified game state but didn't trigger UI re-renders.

**Solution:**
- Added store updates inside async callbacks in all 3 locations
- Pattern:
```typescript
if (typeof window !== 'undefined') {
  const { useGameStore } = require('./store')
  useGameStore.setState({ gameState: { ...gameState } })
}
```

#### 5. **Activated Abilities Use JSON** ✅
**Problem:** `activateAbility()` only used text parsing.

**Changes:**
- Made `activateAbility()` async (line 1129)
- Loads JSON abilities from database first
- Converts JSON activated abilities to game format (lines 1157-1195)
- Falls back to text parsing if no JSON abilities
- Updated store wrapper to async (line 198)
- Updated UI to handle async activation (line 982)
- Updated bot AI to async (lines 99, 50, 23, 409)

#### 6. **Mana Amount Fixed** ✅
**Problem:** Temple of the False God only added 1 colorless mana instead of 2.

**Solution:**
- Updated `executeAbilityEffect()` case "add_mana" (lines 1323-1343)
- Now respects `ability.amount` field
- Normalizes "colorless" string to "C"
- Multiplies mana added by amount

#### 7. **Arcane Signet Mana Choice Modal** ✅
**Problem:** Arcane Signet should show modal to choose commander color but didn't.

**Changes:**
- `components/game-board.tsx`:
  - Added `manaChoiceAbilityIndex` state (line 71)
  - Detect mana abilities with "any color" (lines 952-978)
  - Show modal with commander colors (lines 1146-1172)
  - Handle mana addition from activated abilities (lines 280-303)

#### 8. **Additional Costs Detection** ✅
**Problem:** Scholar of New Horizons has complex additional costs not yet supported.

**Solution:**
- Detect `additionalCosts` in JSON conversion (lines 1167-1171)
- Block activation with clear message (lines 1209-1213)
- Added `hasAdditionalCosts` field to `ActivatedAbility` interface

#### 9. **ETB Trigger Bug Fixed** ✅
**Problem:** Cards with JSON abilities but empty triggered array still registered text-parsed triggers.

**Solution:**
- Check array length: `if (abilityData.abilities.triggered && abilityData.abilities.triggered.length > 0)`
- Only register if actual ETB triggers exist (lines 699-712)
- Prevents false triggers from replacement effects being parsed as ETB

#### 10. **Draw Triggers Implemented** ✅
**Problem:** Chasm Skulker should get +1/+1 counter when drawing but didn't.

**Changes:**
- Added draw trigger parsing in `card-effects.ts` (lines 441-454)
- Execute draw triggers in `drawCard()` function (lines 109-135)
- Detects "whenever you draw" text
- Adds counters to triggering permanents
- Updates store to reflect counter changes

---

## Important Patterns & Conventions

### 1. **Async Ability Loading**
Always wrap async ability loading in try-catch and update store:
```typescript
loadAbilities(card.dbReferenceId).then(async abilityData => {
  // ... process abilities ...

  // Update store
  if (typeof window !== 'undefined') {
    const { useGameStore } = require('./store')
    useGameStore.setState({ gameState: { ...gameState } })
  }
}).catch(err => {
  console.error(`[AbilitySystem] Failed:`, err)
  // Fallback to text parsing
  // Also update store here
})
```

### 2. **Replacement vs Effect**
JSON replacement effects use `modification`, not `effect`:
```typescript
// CORRECT
const effectData = replacement.effect || replacement.modification

// WRONG
const effectData = replacement.effect
```

### 3. **Counter Type Validation**
Always validate counter type exists:
```typescript
if (counterType in card.counters) {
  card.counters[counterType as keyof typeof card.counters] += amount
}
```

### 4. **Colorless Mana Normalization**
JSON uses "colorless", code uses "C":
```typescript
const normalizedColor = color === "colorless" ? "C" : color
```

### 5. **Logging Convention**
- `[AbilitySystem]` - JSON ability system operations
- `[TRIGGER]` - Triggered ability execution
- `[ABILITY]` - Activated ability execution
- `[STACK]` - Stack operations
- `[COMBAT]` - Combat-related actions
- `[LOG]` - User-visible game log entries

---

## Known Issues & Limitations

### Not Yet Implemented
1. **Additional Costs for Activated Abilities**
   - Cards like Scholar of New Horizons require removing counters from other permanents
   - Currently blocked with message: "requires additional costs (not yet implemented)"

2. **Complex Triggered Abilities**
   - JSON triggered abilities are detected but not fully executed
   - Still relies on text parsing for most triggers

3. **Static Abilities**
   - JSON static abilities not implemented
   - Text parsing handles some (vigilance, flying, etc.)

4. **Modal Spells**
   - Some modal spell handling exists but incomplete

5. **X-Cost Spells**
   - Partial support, not fully tested

### Current Limitations
- **Text Parsing Fallback:** Many cards still use text parsing even with JSON abilities
- **Counter Types:** Only p1p1, loyalty, poison, charge are fully supported
- **Token Creation:** Basic implementation, complex tokens may not work
- **Zone Change Triggers:** Limited support

---

## Critical Files Reference

### Core Game Logic
- `lib/game/actions.ts` - **Most important file**
  - All game actions (draw, play, cast, combat)
  - Ability system integration points
  - ~1400 lines

### Ability System
- `lib/game/ability-loader.ts` - Database loading + caching
- `lib/game/runtime-state-manager.ts` - Initialize runtime state
- `lib/game/runtime-ability-state.ts` - Type definitions
- `lib/game/card-effects.ts` - Text parsing fallback

### UI
- `components/game-board.tsx` - Main game UI (~1200 lines)
- `components/game-card.tsx` - Card display component
- `lib/game/store.ts` - Zustand store

### Data
- Database table: `card_abilities`
- Schema version: "1.1"
- Docs: `docs/ability-json-standard-v1.1.md`

---

## Testing Checklist

When making changes, test:
1. ✅ Cards enter battlefield with JSON abilities
2. ✅ Replacement effects apply (ETB counters)
3. ✅ Activated abilities work (tap effects)
4. ✅ Mana abilities add correct amount
5. ✅ Mana choice modals appear for "any color" abilities
6. ✅ Draw triggers execute (Chasm Skulker)
7. ✅ Text parsing fallback works for cards without JSON
8. ✅ Store updates trigger UI re-renders
9. ✅ Async operations don't block game flow
10. ✅ Error handling falls back gracefully

---

## Common Debugging Commands

### Check if card has JSON abilities
```typescript
const { loadAbilities } = require("./lib/game/ability-loader")
const data = await loadAbilities("card-id-here")
console.log(data?.abilities)
```

### Force store update
```typescript
const { useGameStore } = require('./lib/game/store')
useGameStore.setState({ gameState: { ...gameState } })
```

### Check triggered abilities
```typescript
const { parseTriggeredAbilities } = require("./lib/game/card-effects")
const triggers = parseTriggeredAbilities(oracleText, cardName)
console.log(triggers)
```

---

## Next Steps / TODO

### High Priority
1. **Implement Additional Costs**
   - UI for selecting permanents to pay costs
   - Counter removal before ability activation
   - Scholar of New Horizons full support

2. **Full Triggered Ability Execution**
   - Use JSON triggered abilities instead of text parsing
   - Implement all trigger types (attack, damage, cast, dies, etc.)

3. **Static Ability System**
   - Load static abilities from JSON
   - Apply continuous effects (power/toughness, keywords, etc.)

### Medium Priority
4. **Dies Trigger - Token Creation**
   - Chasm Skulker dies trigger (create X squid tokens)
   - Implement token creation from JSON abilities

5. **Search Library Effects**
   - Full implementation of library search
   - Conditional destination (Scholar of New Horizons)

6. **Combat Triggers**
   - Attack triggers
   - Damage triggers
   - Blocking triggers

### Low Priority
7. **Performance Optimization**
   - Reduce unnecessary store updates
   - Optimize ability parsing
   - Cache parsed abilities

8. **Error Recovery**
   - Better error messages
   - Graceful degradation
   - Undo functionality

---

## Key Decisions & Context

### Why Async Ability Loading?
- Abilities are stored in Supabase database
- Must be loaded asynchronously
- Game flow continues while loading
- Store updates when abilities are ready

### Why Text Parsing Fallback?
- Not all cards have JSON abilities yet
- Provides backward compatibility
- Allows gradual migration to JSON system
- Critical for ~20,000 unique cards

### Why Both `effect` and `modification`?
- Schema evolved during development
- Replacement effects use `modification` per MTG rules
- Other ability types use `effect`
- Code handles both for compatibility

### Why Store Updates in Async Callbacks?
- Async operations modify game state outside normal flow
- Store doesn't know about changes
- Manual update triggers React re-render
- Pattern: modify state → update store

---

## Common Gotchas

1. **Forgetting to update store after async operations**
   - Symptom: UI doesn't update
   - Fix: Add store update in `.then()` and `.catch()`

2. **Using `replacement.effect` instead of `replacement.modification`**
   - Symptom: ETB replacements don't work
   - Fix: Use `replacement.effect || replacement.modification`

3. **Not validating counter types**
   - Symptom: Runtime errors when adding unknown counter types
   - Fix: Check `if (counterType in card.counters)`

4. **Forgetting to make functions async**
   - Symptom: Abilities don't load properly
   - Fix: Make function async, await ability loading

5. **Text parsing still running with JSON abilities**
   - Symptom: Double triggers, incorrect effects
   - Fix: Only run text parsing if `!abilityData`

---

## Contact & Resources

- **Documentation:** `docs/game-engine-v1.1-integration.md`
- **Ability Standard:** `docs/ability-json-standard-v1.1.md`
- **This Document:** `docs/game-engine-current-state.md`

---

## Change Log

### 2026-01-08
- Initial JSON ability system integration
- Removed mana logs
- Fixed replacement effect structure bug
- Added async store updates
- Implemented activated abilities from JSON
- Fixed mana amount calculation
- Added Arcane Signet mana choice modal
- Implemented draw triggers (Chasm Skulker)
- Fixed ETB trigger false positives
- Added additional costs detection

---

**End of Document**
