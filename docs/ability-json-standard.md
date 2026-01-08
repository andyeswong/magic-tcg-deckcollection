# MTG Card Ability JSON Standard

This document defines the JSON standard for representing Magic: The Gathering card abilities in a machine-readable format.

## Schema Version: 1.0

## Root Structure

```json
{
  "version": "1.0",
  "cardId": "string",
  "cardName": "string",
  "abilities": {
    "static": [],
    "triggered": [],
    "activated": [],
    "replacement": [],
    "keywords": []
  }
}
```

---

## 1. Static Abilities

Continuous effects that are always active while the card is on the battlefield.

```typescript
interface StaticAbility {
  type: "static"
  effect:
    | "anthem"           // Gives bonus to other creatures
    | "cost_reduction"   // Reduces casting costs
    | "keyword_grant"    // Grants keywords to other permanents
    | "rule_modification" // Changes game rules
    | "protection"       // Protection from X

  // For anthem effects
  targets?: {
    restriction: "all" | "other" | "you_control" | "opponents_control"
    cardTypes: string[]  // ["creature", "artifact", etc.]
    additionalFilters?: string[]  // ["nontoken", "with flying", etc.]
  }

  bonus?: {
    power?: number
    toughness?: number
    keywords?: string[]  // ["flying", "vigilance", etc.]
  }

  // For cost reduction
  costReduction?: {
    amount: number | "X"
    affectsSpells: string[]  // ["creature", "instant", "sorcery"]
    condition?: string
  }

  // For rule modifications
  ruleChange?: {
    description: string
    affectsPlayer: "you" | "opponents" | "all"
  }
}
```

**Example - Hardened Scales:**
```json
{
  "type": "static",
  "effect": "rule_modification",
  "ruleChange": {
    "description": "If one or more +1/+1 counters would be placed on a creature you control, that many plus one +1/+1 counters are placed on it instead.",
    "affectsPlayer": "you"
  }
}
```

---

## 2. Triggered Abilities

Abilities that trigger when specific events occur and use the stack.

```typescript
interface TriggeredAbility {
  type: "triggered"

  // Trigger condition
  trigger: {
    event:
      | "etb"              // Enters the battlefield
      | "attack"           // When attacks
      | "attack_alone"     // When attacks alone
      | "block"            // When blocks
      | "damage_dealt"     // When deals damage
      | "combat_damage"    // When deals combat damage
      | "dies"             // When dies
      | "leaves_battlefield" // When leaves battlefield
      | "cast"             // When you cast a spell
      | "counter_added"    // When counters are put on this
      | "upkeep"           // At beginning of upkeep
      | "end_step"         // At end of turn
      | "draw"             // When you draw a card
      | "discard"          // When you discard
      | "sacrifice"        // When you sacrifice

    source?: "this" | "any" | "other"
    controller?: "you" | "any_player" | "opponent"

    // Additional trigger conditions
    conditions?: {
      cardTypes?: string[]  // Only trigger for specific card types
      damageTarget?: "player" | "creature" | "any" | "opponent"
      isFirst?: boolean     // First time this turn
      counterType?: "p1p1" | "loyalty" | "charge" | "poison"
    }
  }

  // Effect that happens
  effect: {
    action:
      | "add_counters"
      | "draw_cards"
      | "deal_damage"
      | "create_tokens"
      | "destroy"
      | "exile"
      | "return_to_hand"
      | "scry"
      | "proliferate"
      | "support"
      | "gain_life"
      | "lose_life"
      | "sacrifice"
      | "tap_untap"
      | "mill"
      | "search_library"
      | "custom"

    // Targeting
    targets?: {
      type: "none" | "single" | "multiple" | "all" | "each" | "up_to_X"
      count?: number | "X"
      restriction?: string  // "creature", "permanent", "opponent", etc.
      filters?: string[]    // ["you control", "with flying", "other", etc.]
      optional?: boolean
    }

    // Action-specific parameters
    counters?: {
      type: "p1p1" | "loyalty" | "charge" | "poison" | "shield" | "vow" | "-1/-1"
      amount: number | "X"
      perTarget?: boolean  // If true, each target gets this many
    }

    cards?: {
      amount: number | "X"
    }

    damage?: {
      amount: number | "X"
      multiplier?: string  // "power of this creature", "number of creatures you control"
    }

    tokens?: {
      count: number | "X"
      power: number
      toughness: number
      types: string[]      // ["Creature"]
      subtypes: string[]   // ["Saproling"]
      colors: string[]     // ["G"]
      keywords?: string[]
    }

    scry?: {
      amount: number | "X"
    }

    // For custom effects that need special handling
    customEffect?: string
  }

  // Optional restrictions
  optional?: boolean
  mayRestriction?: string  // "may draw a card", "may put a counter"
}
```

**Example - Fathom Mage (counter_added trigger):**
```json
{
  "type": "triggered",
  "trigger": {
    "event": "counter_added",
    "source": "this",
    "conditions": {
      "counterType": "p1p1"
    }
  },
  "effect": {
    "action": "draw_cards",
    "targets": {
      "type": "none"
    },
    "cards": {
      "amount": 1
    }
  }
}
```

**Example - Support ability:**
```json
{
  "type": "triggered",
  "trigger": {
    "event": "etb",
    "source": "this"
  },
  "effect": {
    "action": "support",
    "targets": {
      "type": "up_to_X",
      "count": 3,
      "restriction": "creature",
      "filters": ["other"]
    },
    "counters": {
      "type": "p1p1",
      "amount": 1,
      "perTarget": true
    }
  }
}
```

---

## 3. Activated Abilities

Abilities that can be activated by paying a cost.

```typescript
interface ActivatedAbility {
  type: "activated"

  // Activation cost
  cost: {
    mana?: string        // "{2}{G}", "{X}", "{T}"
    tap?: boolean        // Tap this permanent
    untap?: boolean      // Untap this permanent

    sacrifice?: {
      count: number | "this"
      cardType?: string  // "creature", "artifact", etc.
      filters?: string[] // ["you control", "other", etc.]
    }

    discard?: {
      count: number
      random?: boolean
    }

    removeCounters?: {
      type: "p1p1" | "loyalty" | "charge"
      amount: number | "all"
      from?: "this" | "any"
    }

    payLife?: {
      amount: number
    }

    exile?: {
      from: "hand" | "graveyard" | "battlefield"
      count: number
      cardType?: string
    }
  }

  // Effect (uses same structure as triggered ability effects)
  effect: {
    // Same as TriggeredAbility.effect
  }

  // Timing restrictions
  timing: "instant" | "sorcery"

  // Loyalty ability (planeswalkers)
  loyaltyCost?: number  // Positive = add, negative = remove
}
```

**Example - Walking Ballista's damage ability:**
```json
{
  "type": "activated",
  "cost": {
    removeCounters: {
      "type": "p1p1",
      "amount": 1,
      "from": "this"
    }
  },
  "effect": {
    "action": "deal_damage",
    "targets": {
      "type": "single",
      "count": 1,
      "restriction": "any"
    },
    "damage": {
      "amount": 1
    }
  },
  "timing": "instant"
}
```

**Example - Mana ability:**
```json
{
  "type": "activated",
  "cost": {
    "tap": true
  },
  "effect": {
    "action": "add_mana",
    "mana": {
      "colors": ["G", "W"],
      "amount": 1,
      "choice": true
    }
  },
  "timing": "instant"
}
```

---

## 4. Replacement Effects

Effects that modify events as they happen (don't use the stack).

```typescript
interface ReplacementEffect {
  type: "replacement"

  replaces:
    | "etb"              // As this enters the battlefield
    | "counter_placement" // As counters would be placed
    | "damage"           // Damage would be dealt
    | "draw"             // Would draw a card
    | "dies"             // Would die/be destroyed
    | "discard"          // Would discard

  condition?: {
    source?: string      // "this" | "creatures you control"
    targetType?: string  // "creature", "permanent"
    filters?: string[]   // ["you control", "nontoken", etc.]
  }

  modification: {
    type:
      | "enters_with_counters"  // Enters with X counters
      | "multiply_counters"     // Counters multiplied
      | "add_to_counters"       // Add X to counters being placed
      | "enters_tapped"         // Enters tapped
      | "prevent_damage"        // Prevent damage
      | "redirect_damage"       // Redirect damage
      | "exile_instead"         // Exile instead of graveyard
      | "custom"

    counters?: {
      type: "p1p1" | "loyalty" | "charge"
      amount: number | "X"
      operation?: "add" | "multiply" | "set"
    }

    customEffect?: string
  }
}
```

**Example - Tromell, Seymour's Butler:**
```json
{
  "type": "replacement",
  "replaces": "etb",
  "condition": {
    "source": "creatures you control",
    "filters": ["other", "nontoken"]
  },
  "modification": {
    "type": "add_to_counters",
    "counters": {
      "type": "p1p1",
      "amount": 1,
      "operation": "add"
    }
  }
}
```

**Example - Enters with counters (Walking Ballista):**
```json
{
  "type": "replacement",
  "replaces": "etb",
  "condition": {
    "source": "this"
  },
  "modification": {
    "type": "enters_with_counters",
    "counters": {
      "type": "p1p1",
      "amount": "X"
    }
  }
}
```

---

## 5. Keywords

Simple keyword abilities without complex effects.

```typescript
interface KeywordAbility {
  type: "keyword"
  keyword:
    | "flying"
    | "first_strike"
    | "double_strike"
    | "deathtouch"
    | "lifelink"
    | "vigilance"
    | "trample"
    | "haste"
    | "reach"
    | "menace"
    | "hexproof"
    | "indestructible"
    | "defender"
    | "flash"
    | string  // For other keywords

  conditional?: {
    condition: string  // "as long as you control an artifact"
  }
}
```

**Example:**
```json
{
  "type": "keyword",
  "keyword": "flying"
}
```

---

## Complete Card Examples

### Example 1: Hardened Scales
```json
{
  "version": "1.0",
  "cardId": "hardened-scales-id",
  "cardName": "Hardened Scales",
  "abilities": {
    "static": [],
    "triggered": [],
    "activated": [],
    "replacement": [
      {
        "type": "replacement",
        "replaces": "counter_placement",
        "condition": {
          "source": "creatures you control",
          "filters": []
        },
        "modification": {
          "type": "add_to_counters",
          "counters": {
            "type": "p1p1",
            "amount": 1,
            "operation": "add"
          }
        }
      }
    ],
    "keywords": []
  }
}
```

### Example 2: Fathom Mage
```json
{
  "version": "1.0",
  "cardId": "fathom-mage-id",
  "cardName": "Fathom Mage",
  "abilities": {
    "static": [],
    "triggered": [
      {
        "type": "triggered",
        "trigger": {
          "event": "counter_added",
          "source": "this",
          "conditions": {
            "counterType": "p1p1"
          }
        },
        "effect": {
          "action": "draw_cards",
          "targets": {
            "type": "none"
          },
          "cards": {
            "amount": 1
          }
        }
      }
    ],
    "activated": [],
    "replacement": [
      {
        "type": "replacement",
        "replaces": "etb",
        "condition": {
          "source": "this"
        },
        "modification": {
          "type": "enters_with_counters",
          "counters": {
            "type": "p1p1",
            "amount": 1
          }
        }
      }
    ],
    "keywords": []
  }
}
```

### Example 3: Walking Ballista
```json
{
  "version": "1.0",
  "cardId": "walking-ballista-id",
  "cardName": "Walking Ballista",
  "abilities": {
    "static": [],
    "triggered": [],
    "activated": [
      {
        "type": "activated",
        "cost": {
          "mana": "{4}"
        },
        "effect": {
          "action": "add_counters",
          "targets": {
            "type": "none"
          },
          "counters": {
            "type": "p1p1",
            "amount": 1
          }
        },
        "timing": "instant"
      },
      {
        "type": "activated",
        "cost": {
          "removeCounters": {
            "type": "p1p1",
            "amount": 1,
            "from": "this"
          }
        },
        "effect": {
          "action": "deal_damage",
          "targets": {
            "type": "single",
            "count": 1,
            "restriction": "any"
          },
          "damage": {
            "amount": 1
          }
        },
        "timing": "instant"
      }
    ],
    "replacement": [
      {
        "type": "replacement",
        "replaces": "etb",
        "condition": {
          "source": "this"
        },
        "modification": {
          "type": "enters_with_counters",
          "counters": {
            "type": "p1p1",
            "amount": "X"
          }
        }
      }
    ],
    "keywords": []
  }
}
```

---

## Notes

- Use `"X"` as a string for variable amounts that reference X in the mana cost
- All arrays can be empty `[]` if that category doesn't apply
- The `customEffect` field should be used sparingly for truly unique effects
- Card IDs should match the primary key in your `cards` table
