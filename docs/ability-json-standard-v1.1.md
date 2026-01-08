# MTG Card Ability JSON Standard v1.1

This document defines the JSON standard v1.1 for representing Magic: The Gathering card abilities in a machine-readable format.

**Changes from v1.0:**
- Added new counter types (stun, shield, vow, lore, indestructible)
- Added keyword actions (explore, discover, investigate, adapt, hideaway)
- Added dynamic value system for X-based effects
- Added transformation/type-changing effects
- Added conditional abilities (threshold, metalcraft, etc.)
- Added Saga support (lore counters, chapters)
- Added cost modification mechanics (affinity, improvise, convoke)
- Added copy effects and clone mechanics

## Schema Version: 1.1

## Root Structure

```json
{
  "version": "1.1",
  "cardId": "string",
  "cardName": "string",
  "abilities": {
    "static": [],
    "triggered": [],
    "activated": [],
    "replacement": [],
    "keywords": [],
    "saga": null
  }
}
```

---

## Type Definitions

### Counter Types (Expanded)

```typescript
type CounterType =
  | "p1p1"          // +1/+1 counters
  | "-1-1"          // -1/-1 counters
  | "loyalty"       // Planeswalker loyalty
  | "charge"        // Charge counters
  | "poison"        // Poison counters
  | "stun"          // Stun counters
  | "shield"        // Shield counters
  | "vow"           // Vow counters
  | "lore"          // Saga lore counters
  | "indestructible" // Indestructible counters
  | "flying"        // Flying counters (keyword counter)
  | "first_strike"  // First strike counters (keyword counter)
  | "keyword_counter" // Generic keyword counter
```

### Dynamic Values

```typescript
interface DynamicValue {
  type: "dynamic"

  // Base calculation
  calculation:
    | "mana_value"              // X in mana cost
    | "power"                   // This creature's power
    | "toughness"               // This creature's toughness
    | "counters_on_this"        // Number of counters on this
    | "tapped_artifacts"        // Number of tapped artifacts you control
    | "creatures_on_battlefield" // Total creatures on battlefield
    | "artifacts_you_control"   // Number of artifacts you control
    | "colors_spent"            // Number of colors of mana spent
    | "counters_removed"        // Number of counters removed
    | "permanents_destroyed"    // Number of permanents destroyed
    | "cards_in_hand"           // Number of cards in hand
    | "lands_you_control"       // Number of lands you control
    | "historic_count"          // Number of historic spells/permanents

  // Multiplier (optional)
  multiplier?: number           // Multiply the calculation by this

  // Additional constraints
  restriction?: string          // "you control", "on battlefield", etc.
  counterType?: CounterType     // If calculation is counters-based
}
```

**Example - Chain Reaction:**
```json
{
  "damage": {
    "amount": {
      "type": "dynamic",
      "calculation": "creatures_on_battlefield"
    }
  }
}
```

**Example - Sin, Unending Cataclysm:**
```json
{
  "counters": {
    "type": "p1p1",
    "amount": {
      "type": "dynamic",
      "calculation": "counters_removed",
      "multiplier": 2
    }
  }
}
```

---

## 1. Static Abilities (Enhanced)

Continuous effects that are always active while the card is on the battlefield.

```typescript
interface StaticAbility {
  type: "static"
  effect:
    | "anthem"              // Gives bonus to other creatures
    | "cost_reduction"      // Reduces casting costs
    | "keyword_grant"       // Grants keywords to other permanents
    | "rule_modification"   // Changes game rules
    | "protection"          // Protection from X
    | "transformation"      // Changes card types
    | "conditional_ability" // Ability that exists when condition is met

  // For anthem effects
  targets?: {
    restriction: "all" | "other" | "you_control" | "opponents_control"
    cardTypes: string[]  // ["creature", "artifact", etc.]
    additionalFilters?: string[]  // ["nontoken", "with flying", "historic", etc.]
  }

  bonus?: {
    power?: number | DynamicValue
    toughness?: number | DynamicValue
    keywords?: string[]  // ["flying", "vigilance", etc.]
    abilities?: string[] // ["haste", "indestructible"]
  }

  // For cost reduction (NEW)
  costReduction?: {
    amount: number | DynamicValue
    affectsSpells: string[]  // ["artifact", "instant", "sorcery", "historic"]
    condition?: string
    alternative?: "affinity" | "improvise" | "convoke" | "delve"
  }

  // For transformation effects (NEW)
  transformation?: {
    targetRestriction: string  // "noncreature artifacts you control"
    becomesTypes: string[]     // ["artifact", "creature"]
    basePower?: number
    baseToughness?: number
    duration: "permanent" | "end_of_turn" | "while_condition"
    condition?: string         // "until end of turn", "as long as you have 8+ counters"
  }

  // For conditional abilities (NEW)
  conditional?: {
    condition:
      | "metalcraft"          // You control 3+ artifacts
      | "threshold"           // 7+ cards in your graveyard
      | "hellbent"            // No cards in hand
      | "delirium"            // 4+ card types in graveyard
      | "ferocious"           // You control creature with power 4+
      | "formidable"          // Creatures you control have total power 8+
      | "counter_threshold"   // This has X+ counters
      | "custom"

    minimumValue?: number     // For threshold-based conditions
    counterType?: CounterType // For counter-based conditions
    customCondition?: string

    // What happens when active
    grantsAbility?: "haste" | "flying" | "becomes_creature" | "custom"
    customEffect?: string
  }

  // For rule modifications
  ruleChange?: {
    description: string
    affectsPlayer: "you" | "opponents" | "all"
  }
}
```

**Example - Cyberdrive Awakener transformation:**
```json
{
  "type": "static",
  "effect": "transformation",
  "transformation": {
    "targetRestriction": "noncreature artifacts you control",
    "becomesTypes": ["artifact", "creature"],
    "basePower": 4,
    "baseToughness": 4,
    "duration": "end_of_turn",
    "condition": "until end of turn"
  }
}
```

**Example - Dispatch with Metalcraft:**
```json
{
  "type": "activated",
  "conditional": {
    "condition": "metalcraft",
    "minimumValue": 3,
    "grantsAbility": "custom",
    "customEffect": "exile instead of tap"
  }
}
```

---

## 2. Triggered Abilities (Enhanced)

Abilities that trigger when specific events occur and use the stack.

```typescript
interface TriggeredAbility {
  type: "triggered"

  // Trigger condition
  trigger: {
    event:
      | "etb"                    // Enters the battlefield
      | "attack"                 // When attacks
      | "attack_alone"           // When attacks alone
      | "block"                  // When blocks
      | "damage_dealt"           // When deals damage
      | "combat_damage"          // When deals combat damage
      | "dies"                   // When dies
      | "leaves_battlefield"     // When leaves battlefield
      | "cast"                   // When you cast a spell
      | "counter_added"          // When counters are put on this
      | "upkeep"                 // At beginning of upkeep
      | "end_step"               // At end of turn
      | "draw"                   // When you draw a card
      | "discard"                // When you discard
      | "sacrifice"              // When you sacrifice
      | "landfall"               // (NEW) When land enters under your control
      | "lore_counter_added"     // (NEW) When lore counter added (Sagas)
      | "artifact_enters"        // (NEW) When artifact enters
      | "historic_cast"          // (NEW) When you cast historic spell
      | "beginning_of_combat"    // (NEW) At beginning of combat

    source?: "this" | "any" | "other"
    controller?: "you" | "any_player" | "opponent"

    // Additional trigger conditions
    conditions?: {
      cardTypes?: string[]      // Only trigger for specific card types
      damageTarget?: "player" | "creature" | "any" | "opponent"
      isFirst?: boolean         // First time this turn
      counterType?: CounterType
      historic?: boolean        // (NEW) Only historic spells/permanents
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
      | "keyword_action"    // (NEW) For explore, discover, investigate, etc.
      | "move_counter"      // (NEW) Move counter from one permanent to another
      | "phase_out"         // (NEW) Phase out permanents
      | "custom"

    // For keyword actions (NEW)
    keywordAction?: "explore" | "discover" | "investigate" | "adapt" | "amass" | "conjure"
    keywordValue?: number   // For "Discover 4", "Adapt 3", etc.

    // For move counter (NEW)
    moveCounter?: {
      from: "target" | "this" | "any"
      to: "target" | "this"
      counterType: CounterType
      amount: number | "all"
    }

    // Targeting
    targets?: {
      type: "none" | "single" | "multiple" | "all" | "each" | "up_to_X"
      count?: number | DynamicValue
      restriction?: string  // "creature", "permanent", "opponent", etc.
      filters?: string[]    // ["you control", "with flying", "other", etc.]
      optional?: boolean
    }

    // Action-specific parameters
    counters?: {
      type: CounterType
      amount: number | "X" | DynamicValue
      perTarget?: boolean  // If true, each target gets this many
    }

    cards?: {
      amount: number | "X" | DynamicValue
    }

    damage?: {
      amount: number | "X" | DynamicValue
      multiplier?: string  // "power of this creature", "number of creatures you control"
    }

    tokens?: {
      count: number | "X" | DynamicValue
      power: number
      toughness: number
      types: string[]      // ["Creature", "Artifact"]
      subtypes: string[]   // ["Saproling", "Thopter"]
      colors: string[]     // ["G"]
      keywords?: string[]
      abilities?: string[] // ["flying", "islandwalk"]
    }

    scry?: {
      amount: number | "X" | DynamicValue
    }

    // For custom effects that need special handling
    customEffect?: string
  }

  // Optional restrictions
  optional?: boolean
  mayRestriction?: string  // "may draw a card", "may put a counter"
}
```

**Example - Tireless Tracker (Landfall + Investigate):**
```json
{
  "type": "triggered",
  "trigger": {
    "event": "landfall",
    "source": "any"
  },
  "effect": {
    "action": "keyword_action",
    "keywordAction": "investigate",
    "targets": {
      "type": "none"
    }
  }
}
```

**Example - Incubation Druid (Adapt):**
```json
{
  "type": "activated",
  "cost": {
    "mana": "{3}{G}{G}"
  },
  "effect": {
    "action": "keyword_action",
    "keywordAction": "adapt",
    "keywordValue": 3
  },
  "timing": "instant"
}
```

**Example - Rikku, Resourceful Guardian (Move Counter):**
```json
{
  "type": "activated",
  "cost": {
    "mana": "{1}",
    "tap": true
  },
  "effect": {
    "action": "move_counter",
    "moveCounter": {
      "from": "target",
      "to": "target",
      "counterType": "p1p1",
      "amount": 1
    },
    "targets": {
      "type": "multiple",
      "count": 2,
      "restriction": "permanent"
    }
  },
  "timing": "sorcery"
}
```

---

## 3. Activated Abilities (Enhanced)

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
      filters?: string[]  // ["artifact card", "any card"]
    }

    removeCounters?: {
      type: CounterType
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

    // (NEW) Alternative costs
    alternative?: {
      type: "cycling" | "plainscycling" | "typecycling"
      cost: string      // "{2}", "{W}", etc.
      searchFor?: string  // For typecycling
    }
  }

  // Effect (uses same structure as TriggeredAbility.effect)
  effect: {
    // ... (same as TriggeredAbility)
  }

  // Timing restrictions
  timing: "instant" | "sorcery"

  // Loyalty ability (planeswalkers)
  loyaltyCost?: number  // Positive = add, negative = remove
}
```

**Example - Secluded Steppe (Cycling):**
```json
{
  "type": "activated",
  "cost": {
    "alternative": {
      "type": "cycling",
      "cost": "{W}"
    }
  },
  "effect": {
    "action": "draw_cards",
    "cards": {
      "amount": 1
    }
  },
  "timing": "instant"
}
```

---

## 4. Replacement Effects (Enhanced)

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
    | "becomes_tapped"   // (NEW) Would become tapped

  condition?: {
    source?: string      // "this" | "creatures you control"
    targetType?: string  // "creature", "permanent"
    filters?: string[]   // ["you control", "nontoken", "historic", etc.]
    counterType?: CounterType
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
      | "sunburst"              // (NEW) Enters with counter per color spent
      | "copy_permanent"        // (NEW) Enter as copy of something
      | "custom"

    counters?: {
      type: CounterType
      amount: number | "X" | DynamicValue
      operation?: "add" | "multiply" | "set"
    }

    // For Sunburst (NEW)
    sunburst?: {
      counterType: "p1p1" | "charge"
      perColor: boolean  // true = one counter per color
    }

    // For copy effects (NEW)
    copy?: {
      copyOf: "any_creature" | "target_creature" | "permanent"
      modifications?: {
        additionalCounters?: {
          type: CounterType
          amount: number | "X" | DynamicValue
        }
        excludeAbilities?: string[]
      }
    }

    customEffect?: string
  }
}
```

**Example - Solar Array / Lux Artillery (Sunburst):**
```json
{
  "type": "replacement",
  "replaces": "etb",
  "condition": {
    "source": "this"
  },
  "modification": {
    "type": "sunburst",
    "sunburst": {
      "counterType": "p1p1",
      "perColor": true
    }
  }
}
```

**Example - Altered Ego (Copy with counters):**
```json
{
  "type": "replacement",
  "replaces": "etb",
  "condition": {
    "source": "this"
  },
  "modification": {
    "type": "copy_permanent",
    "copy": {
      "copyOf": "any_creature",
      "modifications": {
        "additionalCounters": {
          "type": "p1p1",
          "amount": "X"
        }
      }
    }
  }
}
```

---

## 5. Keywords (Enhanced)

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
    | "affinity"        // (NEW) Affinity for artifacts/etc
    | "improvise"       // (NEW) Artifacts can help cast
    | "convoke"         // (NEW) Creatures can help cast
    | "evolve"          // (NEW) Get counter when bigger enters
    | string            // For other keywords

  // For affinity/cost reduction keywords
  affinityFor?: "artifacts" | "basic_lands" | "historic"

  conditional?: {
    condition: string  // "as long as you control an artifact"
  }
}
```

**Example - Etherium Sculptor (Affinity-like):**
```json
{
  "type": "static",
  "effect": "cost_reduction",
  "costReduction": {
    "amount": 1,
    "affectsSpells": ["artifact"],
    "alternative": "affinity"
  }
}
```

---

## 6. Saga Abilities (NEW)

Special structure for Saga enchantments.

```typescript
interface SagaAbility {
  type: "saga"

  // Number of chapters
  maxChapters: number  // Usually 3 or 4

  // Chapter effects
  chapters: {
    chapterNumber: number | number[]  // [1, 2, 3] for "I, II, III"
    effect: TriggeredAbility["effect"]  // Uses same effect structure
  }[]

  // For Saga creatures (like Summon series)
  isCreature?: boolean
  creatureTypes?: string[]  // ["Creature", "Unicorn"]
}
```

**Example - Summon: Ixion:**
```json
{
  "type": "saga",
  "maxChapters": 3,
  "isCreature": true,
  "creatureTypes": ["Enchantment", "Creature", "Saga", "Unicorn"],
  "chapters": [
    {
      "chapterNumber": [1],
      "effect": {
        "action": "exile",
        "targets": {
          "type": "single",
          "restriction": "creature",
          "filters": ["opponent controls"]
        }
      }
    },
    {
      "chapterNumber": [2, 3],
      "effect": {
        "action": "add_counters",
        "targets": {
          "type": "up_to_X",
          "count": 2,
          "restriction": "creature",
          "filters": ["you control"]
        },
        "counters": {
          "type": "p1p1",
          "amount": 1,
          "perTarget": true
        }
      }
    }
  ]
}
```

---

## 7. Special Mechanics (NEW)

For unique mechanics that don't fit elsewhere.

```typescript
interface SpecialMechanic {
  type: "special"

  mechanic:
    | "hideaway"        // Exile cards, play one later
    | "foretell"        // Exile from hand, cast later
    | "miracle"         // Reduced cost if drawn
    | "cascade"         // Exile until cheaper spell, cast it
    | "storm"           // Copy for each spell cast
    | "rebound"         // Cast from exile next turn

  value?: number        // For "Hideaway 5", "Cascade 4", etc.

  // Hideaway specific
  hideaway?: {
    numberToExile: number
    playCondition?: string  // "if you control creature with power 7+"
  }

  // Play without cost mechanics
  freePlay?: {
    condition: string
    timing: "instant" | "sorcery"
  }
}
```

**Example - Fight Rigging (Hideaway 5):**
```json
{
  "type": "special",
  "mechanic": "hideaway",
  "hideaway": {
    "numberToExile": 5,
    "playCondition": "you control a creature with power 7 or greater"
  }
}
```

---

## Complete Card Examples (v1.1)

### Example 1: Lux Artillery (Sunburst + Triggered End Step)

```json
{
  "version": "1.1",
  "cardId": "lux-artillery-id",
  "cardName": "Lux Artillery",
  "abilities": {
    "static": [
      {
        "type": "static",
        "effect": "rule_modification",
        "ruleChange": {
          "description": "Whenever you cast an artifact creature spell, it gains sunburst",
          "affectsPlayer": "you"
        }
      }
    ],
    "triggered": [
      {
        "type": "triggered",
        "trigger": {
          "event": "end_step",
          "source": "this",
          "controller": "you",
          "conditions": {
            "customCondition": "there are thirty or more counters among artifacts and creatures you control"
          }
        },
        "effect": {
          "action": "deal_damage",
          "targets": {
            "type": "all",
            "restriction": "opponent"
          },
          "damage": {
            "amount": 10
          }
        }
      }
    ],
    "activated": [],
    "replacement": [],
    "keywords": []
  }
}
```

### Example 2: Alibou, Ancient Witness (Dynamic X + Scry)

```json
{
  "version": "1.1",
  "cardId": "alibou-id",
  "cardName": "Alibou, Ancient Witness",
  "abilities": {
    "static": [
      {
        "type": "static",
        "effect": "keyword_grant",
        "targets": {
          "restriction": "other",
          "cardTypes": ["artifact", "creature"],
          "additionalFilters": ["you control"]
        },
        "bonus": {
          "keywords": ["haste"]
        }
      }
    ],
    "triggered": [
      {
        "type": "triggered",
        "trigger": {
          "event": "attack",
          "source": "other",
          "conditions": {
            "cardTypes": ["artifact", "creature"]
          }
        },
        "effect": {
          "action": "deal_damage",
          "targets": {
            "type": "single",
            "restriction": "any"
          },
          "damage": {
            "amount": {
              "type": "dynamic",
              "calculation": "tapped_artifacts",
              "restriction": "you control"
            }
          }
        }
      },
      {
        "type": "triggered",
        "trigger": {
          "event": "attack",
          "source": "other",
          "conditions": {
            "cardTypes": ["artifact", "creature"]
          }
        },
        "effect": {
          "action": "scry",
          "scry": {
            "amount": {
              "type": "dynamic",
              "calculation": "tapped_artifacts",
              "restriction": "you control"
            }
          }
        }
      }
    ],
    "activated": [],
    "replacement": [],
    "keywords": []
  }
}
```

### Example 3: Incubation Druid (Conditional Mana + Adapt)

```json
{
  "version": "1.1",
  "cardId": "incubation-druid-id",
  "cardName": "Incubation Druid",
  "abilities": {
    "static": [],
    "triggered": [],
    "activated": [
      {
        "type": "activated",
        "cost": {
          "tap": true
        },
        "effect": {
          "action": "add_mana",
          "mana": {
            "colors": ["any"],
            "amount": {
              "type": "dynamic",
              "calculation": "custom",
              "customEffect": "Add one mana of any type that a land you control could produce. If this has a +1/+1 counter, add three mana instead"
            },
            "choice": true
          }
        },
        "timing": "instant"
      },
      {
        "type": "activated",
        "cost": {
          "mana": "{3}{G}{G}"
        },
        "effect": {
          "action": "keyword_action",
          "keywordAction": "adapt",
          "keywordValue": 3
        },
        "timing": "instant"
      }
    ],
    "replacement": [],
    "keywords": []
  }
}
```

### Example 4: Tireless Tracker (Landfall + Investigate + Clue Sacrifice)

```json
{
  "version": "1.1",
  "cardId": "tireless-tracker-id",
  "cardName": "Tireless Tracker",
  "abilities": {
    "static": [],
    "triggered": [
      {
        "type": "triggered",
        "trigger": {
          "event": "landfall",
          "source": "any"
        },
        "effect": {
          "action": "keyword_action",
          "keywordAction": "investigate"
        }
      },
      {
        "type": "triggered",
        "trigger": {
          "event": "sacrifice",
          "source": "any",
          "conditions": {
            "cardTypes": ["clue"]
          }
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
        }
      }
    ],
    "activated": [],
    "replacement": [],
    "keywords": []
  }
}
```

### Example 5: Dispatch (Conditional Exile)

```json
{
  "version": "1.1",
  "cardId": "dispatch-id",
  "cardName": "Dispatch",
  "abilities": {
    "static": [],
    "triggered": [],
    "activated": [],
    "replacement": [],
    "keywords": [],
    "spellEffect": {
      "baseEffect": {
        "action": "tap_untap",
        "targets": {
          "type": "single",
          "restriction": "creature"
        }
      },
      "conditionalEffect": {
        "condition": "metalcraft",
        "minimumValue": 3,
        "effect": {
          "action": "exile",
          "targets": {
            "type": "single",
            "restriction": "creature"
          }
        }
      }
    }
  }
}
```

---

## Notes for v1.1

- Use `DynamicValue` for any X-based or calculated values
- Keyword actions (explore, discover, investigate, adapt) use `"action": "keyword_action"`
- Saga creatures have both `saga` abilities AND creature stats
- Counter types are now expanded to include all MTG counter types
- Cost modifications (affinity, improvise) can be specified in `costReduction.alternative`
- Copy effects use `"modification": {"type": "copy_permanent"}`
- Use `customEffect` as a fallback for truly unique cards that don't fit the schema

---

## Migration from v1.0 to v1.1

1. Update `version` field to `"1.1"`
2. Replace static `amount` values with `DynamicValue` where appropriate
3. Add `saga` section for Saga cards
4. Use new counter types (stun, shield, vow, lore)
5. Use `keywordAction` for investigate, explore, discover, adapt
6. Add transformation/conditional logic for type-changing effects
