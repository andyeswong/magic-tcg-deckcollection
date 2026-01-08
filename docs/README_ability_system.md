# MTG Ability System - Implementation Guide

This document explains the new structured ability system for your MTG game engine.

## What Was Created

### 1. JSON Standard (`ability-json-standard.md`)

A comprehensive specification for representing MTG card abilities as structured JSON data.

**Key Features:**
- 5 ability types: Static, Triggered, Activated, Replacement, Keywords
- Standardized structure for all common MTG mechanics
- Support for complex effects (proliferate, support, tokens, etc.)
- Extensible for future mechanics

**Use Cases:**
- Game engine can read abilities directly from JSON
- No more regex parsing for most cards
- Easier to add new cards
- More reliable than text parsing

---

### 2. Database Table (`007_create_card_abilities_table.sql`)

A new PostgreSQL table to store structured ability data.

**Table: `card_abilities`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `card_id` | TEXT | Foreign key to `cards` table |
| `schema_version` | TEXT | JSON schema version (future-proofing) |
| `abilities` | JSONB | Full ability JSON object |
| `has_static_abilities` | BOOLEAN | Quick filter flag |
| `has_triggered_abilities` | BOOLEAN | Quick filter flag |
| `has_activated_abilities` | BOOLEAN | Quick filter flag |
| `has_replacement_effects` | BOOLEAN | Quick filter flag |
| `has_keywords` | BOOLEAN | Quick filter flag |
| `parsing_confidence` | DECIMAL | AI confidence (0.0 - 1.0) |
| `parsing_notes` | TEXT | Notes about parsing |
| `manually_verified` | BOOLEAN | Human verified flag |
| `manually_edited` | BOOLEAN | Human edited flag |

**Features:**
- GIN index on JSONB for fast queries
- Automatic flag updates via triggers
- RLS policies for security
- One record per card (unique constraint)

**To Install:**
```bash
# Connect to your Supabase database and run:
psql [connection_string] -f scripts/007_create_card_abilities_table.sql
```

---

### 3. AI Parser System Prompt (`systemprompt_textchecker.md`)

A comprehensive system prompt for an LLM to parse card oracle text into JSON.

**What It Does:**
- Teaches an LLM how to classify abilities
- Provides 11 detailed examples
- Explains edge cases and special rules
- Ensures consistent JSON output

**How To Use:**

#### Option A: Manual Testing (via ChatGPT/Claude)

1. Copy the entire `systemprompt_textchecker.md` content
2. Paste into ChatGPT/Claude as the system message
3. Send card oracle text as user message
4. Receive JSON output

#### Option B: Build an Automation Tool

Create a script that:
```typescript
// Pseudo-code example
async function parseCardAbilities(cardOracleText: string, cardName: string) {
  const systemPrompt = await fs.readFile('docs/systemprompt_textchecker.md', 'utf-8')

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Card Name: ${cardName}\nOracle Text:\n${cardOracleText}` }
    ],
    response_format: { type: "json_object" }
  })

  return JSON.parse(response.choices[0].message.content)
}
```

#### Option C: Batch Processing Script

Process your entire card database:
```typescript
// Get all cards from database
const cards = await supabase.from('cards').select('*')

for (const card of cards) {
  const abilityJson = await parseCardAbilities(card.oracle_text, card.name)

  // Insert into card_abilities table
  await supabase.from('card_abilities').upsert({
    card_id: card.id,
    abilities: abilityJson.abilities,
    parsing_confidence: abilityJson.parsing_confidence,
    parsing_notes: abilityJson.parsing_notes
  })
}
```

---

## Integration With Your Game Engine

### Current State (Parser-Based)

```typescript
// lib/game/card-effects.ts
export function parseETBCounters(oracleText: string, cardName: string) {
  // Regex parsing...
  const text = oracleText.toLowerCase()
  if (text.includes("enters with")) {
    // Complex regex logic
  }
}
```

### New State (JSON-Based)

```typescript
// lib/game/ability-loader.ts
export async function loadCardAbilities(cardId: string): Promise<CardAbilities> {
  const { data } = await supabase
    .from('card_abilities')
    .select('abilities')
    .eq('card_id', cardId)
    .single()

  return data.abilities
}

// Usage in game engine
const abilities = await loadCardAbilities(card.dbReferenceId)

// Check for ETB replacement effects
if (abilities.replacement) {
  for (const effect of abilities.replacement) {
    if (effect.replaces === 'etb') {
      // Apply ETB counters directly from JSON
      applyETBCountersFromJson(card, effect)
    }
  }
}

// Register triggered abilities
if (abilities.triggered) {
  for (const trigger of abilities.triggered) {
    registerTriggerFromJson(gameState, card, trigger)
  }
}
```

### Benefits Over Current System

| Aspect | Current (Parser) | New (JSON) |
|--------|-----------------|------------|
| **Reliability** | Regex can fail on unusual wording | Structured data is consistent |
| **Performance** | Parse on every game load | Pre-parsed, just read JSON |
| **Maintainability** | Hard to debug regex | Clear JSON structure |
| **Coverage** | Only handles parsed patterns | Can handle any card (with AI) |
| **Extensibility** | Need to update regex for new mechanics | Just add new JSON fields |

---

## Workflow for Adding New Cards

### Old Workflow (Parser Only)
1. Add card to database
2. Hope parser can extract abilities
3. If not, add hardcoded override
4. Test in game

### New Workflow (AI + JSON)
1. Add card to database (with oracle_text)
2. Run AI parser on oracle text
3. Review JSON output (check confidence score)
4. If confidence < 0.8, manually verify/edit
5. Save to `card_abilities` table
6. Game engine automatically uses it

---

## Next Steps for You

### 1. Run the SQL Migration

```bash
# From your project root
cd scripts
# Run against your Supabase database
psql [your-connection-string] -f 007_create_card_abilities_table.sql
```

### 2. Build the AI Parser Tool

You mentioned you'll pause to create the LLM tool. Here's a suggested approach:

**Simple CLI Tool:**
```bash
# Parse a single card
node scripts/parse-card.js "Walking Ballista" "walking-ballista-id"

# Batch parse all cards
node scripts/parse-all-cards.js
```

**Tool Requirements:**
- Read from `cards` table
- Send oracle_text to LLM with system prompt
- Parse JSON response
- Insert into `card_abilities` table
- Handle errors gracefully
- Report low confidence scores

**Recommended LLM:**
- GPT-4 or GPT-4-turbo (best accuracy)
- Claude Sonnet 4 (good balance)
- GPT-3.5-turbo (faster, cheaper, less accurate)

### 3. Integrate With Game Engine

Once you have ability JSON in the database:

1. Create `lib/game/ability-loader.ts` to fetch JSON
2. Refactor `card-effects.ts` to use JSON instead of parsing
3. Keep hardcoded overrides for truly unique cards
4. Gradually migrate existing parser logic to JSON-based approach

### 4. Build a Manual Verification UI (Optional)

Create an admin page to:
- View parsed abilities
- See confidence scores
- Manually edit JSON
- Mark as verified
- Compare parsed JSON vs oracle text side-by-side

---

## Example Integration Code

```typescript
// lib/game/ability-executor.ts

import type { GameState, CardInstance } from "./types"
import type { TriggeredAbility, ReplacementEffect } from "./ability-types"

/**
 * Apply replacement effects from JSON when card enters battlefield
 */
export function applyReplacementEffects(
  gameState: GameState,
  card: CardInstance,
  abilities: CardAbilities,
  xValue: number = 0
) {
  for (const effect of abilities.replacement) {
    if (effect.replaces === "etb") {
      applyETBReplacement(card, effect, xValue)
    } else if (effect.replaces === "counter_placement") {
      // Register as global replacement effect
      registerCounterModifier(gameState, card, effect)
    }
  }
}

/**
 * Register triggered abilities from JSON
 */
export function registerTriggersFromJson(
  gameState: GameState,
  card: CardInstance,
  abilities: CardAbilities
) {
  for (const trigger of abilities.triggered) {
    // Store on card for later trigger checking
    if (!card.triggeredAbilities) {
      card.triggeredAbilities = []
    }
    card.triggeredAbilities.push(trigger)
  }
}

/**
 * Execute triggered ability effect from JSON
 */
export function executeTriggerFromJson(
  gameState: GameState,
  card: CardInstance,
  trigger: TriggeredAbility,
  targets?: string[]
) {
  switch (trigger.effect.action) {
    case "draw_cards":
      drawCards(gameState, card.controllerId, trigger.effect.cards?.amount || 1)
      break

    case "add_counters":
      if (targets) {
        targets.forEach(targetId => {
          addCounters(
            gameState,
            targetId,
            trigger.effect.counters?.type || "p1p1",
            trigger.effect.counters?.amount || 1
          )
        })
      }
      break

    case "proliferate":
      executeProliferate(gameState, targets || [])
      break

    // ... handle other action types
  }
}
```

---

## FAQ

### Q: Do I still need the parser?

**A:** Short term: Yes. Long term: Mostly no.

You'll want to keep basic parsing as a fallback for:
- Cards without JSON data yet
- Development/testing
- Backup validation

But 90%+ of cards should use JSON once you've populated the database.

### Q: What about spell effects (instants/sorceries)?

**A:** The current JSON standard focuses on **permanent abilities**. Spell effects would need a separate schema or extension. For now, you could:
1. Keep parsing spell effects as you do currently
2. Extend the JSON standard to include spell effects
3. Create a separate `spell_effects` table

### Q: How do I handle new mechanics from future sets?

**A:** Add new effect types to the JSON standard:
1. Update `ability-json-standard.md` with new types
2. Update `systemprompt_textchecker.md` with examples
3. Re-parse affected cards
4. Update game engine to handle new types

The JSON structure is designed to be extensible.

### Q: Can I manually edit the JSON?

**A:** Yes! That's what `manually_edited` flag is for. Edit the JSON in database, set the flag, and game engine will use it.

---

## Files Created

```
docs/
├── ability-json-standard.md       # JSON specification
├── systemprompt_textchecker.md   # AI parser system prompt
└── README_ability_system.md      # This file

scripts/
└── 007_create_card_abilities_table.sql  # Database migration
```

---

## Summary

You now have:
1. ✅ A comprehensive JSON standard for card abilities
2. ✅ A database table to store structured ability data
3. ✅ A system prompt to train an LLM to generate the JSON

**Next:** Build your LLM tool to populate the `card_abilities` table with parsed data.

Once you have the JSON data, you can refactor your game engine to read from JSON instead of parsing oracle text on every game load. This will make your engine faster, more reliable, and easier to extend.
