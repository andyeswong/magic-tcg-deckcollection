# Card Abilities Population Script

This script automatically populates the `card_abilities` table by parsing card oracle text using AI.

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment variables:**
   Ensure your `.env.local` has:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Database migrations:**
   Make sure you've run the database migrations:
   ```bash
   psql [your-connection-string] -f scripts/007_create_card_abilities_table.sql
   psql [your-connection-string] -f scripts/008_upgrade_abilities_to_v1.1.sql
   ```

## Usage

### Test with 5 cards
```bash
npm run populate-abilities:test
```

This will process only 5 cards to verify the script works correctly.

### Process all cards (default: 1 card at a time)
```bash
npm run populate-abilities
```

This processes all cards that don't have abilities yet, one at a time (1 second between each).

### Process specific card
```bash
npm run populate-abilities:single 02e7c1c9-f5df-505f-9979-edff48e47f4d
```

Replace the ID with your target card's ID.

### Custom batch size and limit
```bash
npm run populate-abilities -- --batch-size=10 --limit=100
```

Options:
- `--batch-size=N` - Process N cards at a time (default: 1)
- `--limit=N` - Process only N cards total (default: all)
- `--card-id=xxx` - Process only a specific card

## How It Works

1. **Fetch cards:** Queries the `cards` table for cards that:
   - Have oracle text (not null/empty)
   - Don't already have entries in `card_abilities`

2. **Send to AI:** For each card:
   - Formats card data as JSON
   - Sends to Dify AI endpoint
   - Receives parsed ability JSON

3. **Extract JSON:** Parses the markdown response to extract JSON:
   ```json
   {
     "version": "1.1",
     "cardId": "...",
     "cardName": "...",
     "abilities": { ... },
     "parsing_confidence": 0.95,
     "parsing_notes": "..."
   }
   ```

4. **Insert to database:** Upserts into `card_abilities` table with:
   - Ability JSON
   - Parsed boolean flags (has_static_abilities, etc.)
   - Confidence score
   - Notes

5. **Rate limiting:**
   - 1 second delay between each card
   - 2 second delay between batches

## Output Example

```
================================================================================
Card Abilities Population Script
================================================================================
Batch size: 1
Limit: 5
Specific card: None
================================================================================

[INFO] Found 5 cards to process

================================================================================
Batch 1/5
================================================================================

[BATCH] Processing 5 cards...

[CARD] Processing: Hardened Scales (02e7c1c9-f5df-505f-9979-edff48e47f4d)
[PARSED] Hardened Scales - Confidence: 1.0
  Static: 0
  Triggered: 0
  Activated: 0
  Replacement: 1
  Keywords: 0
  Saga: No
[SUCCESS] Inserted ability for Hardened Scales

[CARD] Processing: Tireless Tracker (...)
...

[BATCH COMPLETE] Success: 5, Failures: 0
```

## Troubleshooting

### "No cards to process"
All cards already have abilities. To re-parse:
1. Delete entries from `card_abilities` table
2. Run script again

### AI API errors (status 429)
**Rate limit exceeded.** Solution:
- Reduce batch size: `--batch-size=1`
- Add more delay in script (edit `populate-card-abilities.ts`)

### AI API errors (status 500)
**Server error.** Solution:
- Check Dify API status
- Retry specific failed cards using `--card-id`

### JSON parse errors
**AI returned invalid JSON.** Solution:
- Check the `answer` field in API response
- Card may have complex abilities that confuse the parser
- Manually verify the card in database

### Database errors
**Constraint violations or missing columns.** Solution:
- Ensure migrations have been run
- Check `card_abilities` table schema

## Monitoring Progress

### Check how many cards are parsed
```sql
SELECT COUNT(*) FROM card_abilities;
```

### Check parsing quality
```sql
SELECT
  schema_version,
  AVG(parsing_confidence) as avg_confidence,
  COUNT(*) as count
FROM card_abilities
GROUP BY schema_version;
```

### Find low-confidence parses
```sql
SELECT
  c.name,
  ca.parsing_confidence,
  ca.parsing_notes
FROM card_abilities ca
JOIN cards c ON c.id = ca.card_id
WHERE ca.parsing_confidence < 0.8
ORDER BY ca.parsing_confidence ASC;
```

### Find cards with specific ability types
```sql
-- Cards with Sagas
SELECT c.name
FROM card_abilities ca
JOIN cards c ON c.id = ca.card_id
WHERE ca.abilities->'saga' IS NOT NULL;

-- Cards with triggered abilities
SELECT c.name
FROM card_abilities ca
JOIN cards c ON c.id = ca.card_id
WHERE ca.has_triggered_abilities = true;
```

## Cost Estimation

Based on your API response metadata:
- ~7,327 tokens per card (7,074 prompt + 253 completion)
- Cost: ~0.014907 RMB per card (~$0.002 USD)

For 100 cards:
- Total cost: ~1.49 RMB (~$0.20 USD)
- Time: ~120 seconds (with 1s delay between cards)

For 1000 cards:
- Total cost: ~14.9 RMB (~$2 USD)
- Time: ~20 minutes

## Next Steps After Parsing

1. **Verify parsing quality:**
   - Check low-confidence cards
   - Manually review complex cards (Sagas, dynamic X values)

2. **Update game engine:**
   - Implement ability loader (`lib/game/ability-loader.ts`)
   - Load abilities when cards enter battlefield
   - Execute triggered abilities

3. **Test in game:**
   - Play with parsed cards
   - Verify abilities work as expected
   - Report issues

## Script Configuration

To modify the AI endpoint or API key, edit `scripts/populate-card-abilities.ts`:

```typescript
const DIFY_API_URL = 'https://dify.andres-wong.com/v1/chat-messages'
const DIFY_API_KEY = 'app-Lk4tKWfemXusS4rpbEG1pWAh'
```

To modify rate limiting, change the delays:

```typescript
// Between cards
await new Promise(resolve => setTimeout(resolve, 1000))  // 1 second

// Between batches
await new Promise(resolve => setTimeout(resolve, 2000))  // 2 seconds
```
