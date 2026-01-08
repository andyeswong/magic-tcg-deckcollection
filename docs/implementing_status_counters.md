# Implementing Status/Keyword Counters in Game Engine

## The Dual-Nature Problem

Modern MTG has **two ways** to grant keywords like Indestructible, Flying, etc.:

1. **Inherent abilities** - Printed on the card or granted by static effects
2. **Keyword counters** - Counters that grant keywords (introduced in Ikoria)

Your game engine must check **BOTH** sources when evaluating abilities.

---

## Counter Types That Grant Keywords

From your v1.1 standard, these counters grant abilities:

```typescript
// Status counters that grant keywords
const STATUS_COUNTERS: Record<CounterType, string | null> = {
  "flying": "flying",
  "first_strike": "first_strike",
  "indestructible": "indestructible",
  "double_strike": "double_strike",     // Not in v1.1 yet, add if needed
  "hexproof": "hexproof",               // Not in v1.1 yet, add if needed
  "lifelink": "lifelink",               // Not in v1.1 yet, add if needed
  "menace": "menace",                   // Not in v1.1 yet, add if needed
  "trample": "trample",                 // Not in v1.1 yet, add if needed
  "vigilance": "vigilance",             // Not in v1.1 yet, add if needed

  // Non-keyword counters (don't grant abilities)
  "p1p1": null,
  "-1-1": null,
  "loyalty": null,
  "charge": null,
  "poison": null,
  "stun": null,      // Actually affects ability to untap, not a keyword
  "shield": null,    // Prevents damage once, not a keyword
  "vow": null,       // Restriction, not a keyword
  "lore": null,      // Saga mechanic, not a keyword
}
```

---

## Implementation Pattern

### ❌ WRONG - Only checking inherent abilities:

```typescript
function hasAbility(card: CardInstance, ability: string): boolean {
  // WRONG: Misses keyword counters!
  return card.keywords.includes(ability)
}

// This will fail for creatures with indestructible counters
if (hasAbility(creature, "indestructible")) {
  // Won't catch counter-based indestructible
}
```

### ✅ CORRECT - Check both sources:

```typescript
function hasAbility(card: CardInstance, ability: string): boolean {
  // Check inherent abilities
  if (card.keywords.includes(ability)) {
    return true
  }

  // Check keyword counters
  const counterType = KEYWORD_TO_COUNTER[ability]
  if (counterType && card.counters[counterType] > 0) {
    return true
  }

  return false
}

// Map keywords to their counter equivalents
const KEYWORD_TO_COUNTER: Record<string, CounterType | null> = {
  "flying": "flying",
  "first_strike": "first_strike",
  "indestructible": "indestructible",
  "double_strike": "double_strike",
  // ... etc
}
```

---

## Real-World Examples from Your Collection

### Example 1: Protection Magic

**Card:** Protection Magic
**Effect:** "Put an indestructible counter on target creature you control."

**JSON:**
```json
{
  "effect": {
    "action": "add_counters",
    "targets": {
      "type": "single",
      "restriction": "creature",
      "filters": ["you control"]
    },
    "counters": {
      "type": "indestructible",
      "amount": 1
    }
  }
}
```

**Game Engine Check:**
```typescript
// When checking if creature can be destroyed
function canBeDestroyed(creature: CardInstance): boolean {
  // MUST check both!
  const hasIndestructible =
    creature.keywords.includes("indestructible") ||  // Inherent
    creature.counters.indestructible > 0              // Counter

  return !hasIndestructible
}
```

### Example 2: Collective Effort (Multiple Counter Types)

**Effect:** "Put a +1/+1 counter on each creature target player controls."

If this spell also had a mode to "Put a shield counter on each creature", you'd need:

```typescript
function preventNextDamage(creature: CardInstance): boolean {
  // Shield counters prevent the next damage
  if (creature.counters.shield > 0) {
    creature.counters.shield -= 1
    return true // Damage prevented
  }
  return false
}
```

### Example 3: Stun Counters (Special Case)

**Effect:** Stun counters don't grant keywords - they modify untap behavior.

```typescript
// During UNTAP phase
function untapPermanents(gameState: GameState) {
  for (const cardId of gameState.battlefield) {
    const card = gameState.entities[cardId]

    // Check stun counters BEFORE untapping
    if (card.counters.stun > 0) {
      card.counters.stun -= 1  // Remove one stun counter
      // Card stays tapped (don't untap)
      continue
    }

    // Normal untap
    card.tapped = false
  }
}
```

---

## Comprehensive Implementation

### File: `lib/game/ability-checker.ts`

```typescript
import type { CardInstance, CounterType } from "./types"

/**
 * Map of keyword abilities to their counter equivalents
 */
const KEYWORD_TO_COUNTER: Partial<Record<string, CounterType>> = {
  "flying": "flying",
  "first_strike": "first_strike",
  "indestructible": "indestructible",
  // Add more as needed
}

/**
 * Check if a card has a specific keyword ability
 * Checks BOTH inherent abilities AND keyword counters
 */
export function hasKeyword(card: CardInstance, keyword: string): boolean {
  // Check inherent keywords
  if (card.keywords.includes(keyword)) {
    return true
  }

  // Check oracle text for keyword
  const text = card.oracleText?.toLowerCase() || ""
  if (text.includes(keyword.toLowerCase())) {
    return true
  }

  // Check keyword counters
  const counterType = KEYWORD_TO_COUNTER[keyword.toLowerCase()]
  if (counterType && card.counters[counterType] > 0) {
    return true
  }

  return false
}

/**
 * Get all keywords a card has (including from counters)
 */
export function getAllKeywords(card: CardInstance): string[] {
  const keywords = new Set<string>()

  // Add inherent keywords
  card.keywords.forEach(kw => keywords.add(kw))

  // Add keywords from counters
  Object.entries(KEYWORD_TO_COUNTER).forEach(([keyword, counterType]) => {
    if (counterType && card.counters[counterType] > 0) {
      keywords.add(keyword)
    }
  })

  return Array.from(keywords)
}

/**
 * Check if creature can be destroyed
 */
export function canBeDestroyed(card: CardInstance): boolean {
  // Check both sources of indestructible
  return !hasKeyword(card, "indestructible")
}

/**
 * Check if creature can block another creature
 */
export function canBlock(blocker: CardInstance, attacker: CardInstance): boolean {
  // Flying restriction
  if (hasKeyword(attacker, "flying")) {
    return hasKeyword(blocker, "flying") || hasKeyword(blocker, "reach")
  }

  return true
}

/**
 * Check combat damage prevention (shield counters)
 */
export function checkShieldCounters(card: CardInstance, damage: number): number {
  if (damage > 0 && card.counters.shield > 0) {
    card.counters.shield -= 1
    console.log(`[SHIELD] ${card.name} prevented damage with shield counter`)
    return 0  // All damage prevented
  }
  return damage
}

/**
 * Handle stun counters during untap
 */
export function handleStunCounters(card: CardInstance): boolean {
  if (card.counters.stun > 0) {
    card.counters.stun -= 1
    console.log(`[STUN] ${card.name} removed stun counter, stays tapped`)
    return false  // Don't untap
  }
  return true  // Can untap normally
}
```

---

## Common Pitfalls to Avoid

### ❌ Pitfall 1: Forgetting Counter-Based Keywords

```typescript
// WRONG
if (creature.keywords.includes("flying")) {
  // Misses flying counters!
}

// RIGHT
if (hasKeyword(creature, "flying")) {
  // Checks both!
}
```

### ❌ Pitfall 2: Treating Shield Like Indestructible

```typescript
// WRONG - Shield is not a keyword!
if (hasKeyword(creature, "shield")) {
  // Shield counters don't grant a keyword ability
}

// RIGHT - Shield prevents next damage
const actualDamage = checkShieldCounters(creature, damageAmount)
```

### ❌ Pitfall 3: Not Removing Stun Counters

```typescript
// WRONG - Stun counters must be removed during untap
function untap(card: CardInstance) {
  if (card.counters.stun === 0) {
    card.tapped = false
  }
  // Forgot to remove stun counter!
}

// RIGHT
function untap(card: CardInstance) {
  if (handleStunCounters(card)) {
    card.tapped = false
  }
}
```

---

## Testing Checklist

Test these scenarios:

- [ ] Creature with inherent Flying blocks attacker with Flying
- [ ] Creature with Flying counter blocks attacker with Flying
- [ ] Creature with Indestructible counter survives destroy effect
- [ ] Creature with Shield counter prevents next damage, counter removed
- [ ] Creature with Stun counter doesn't untap, counter removed
- [ ] Vow counter prevents attacking (need to implement attack restriction check)
- [ ] Multiple keyword counters stack (Flying + First Strike counters)

---

## Summary

**Key Principle:** Always check BOTH sources when evaluating abilities:

```typescript
// The golden rule
hasAbility(card, ability) =
  card.keywords.includes(ability) ||
  card.counters[abilityCounter] > 0
```

**Special Cases:**
- **Shield counters** - Prevent damage once, then removed
- **Stun counters** - Prevent untap once, then removed
- **Vow counters** - Prevent attacking (custom logic needed)

Your v1.1 JSON standard correctly supports all of this - now your game engine implementation needs to honor the dual nature of keyword abilities!
