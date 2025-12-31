# Database Structure for MTG Deck Builder

## Tables Overview

### `cards` table (Card Repository)
- **Purpose**: Central repository of all MTG card data for training modules
- **Contains**: Complete card information (oracle text, flavor text, rulings, legalities, etc.)
- **Updated**: When cards are added to decks or selected as commanders
- **Relationship**: One card can be used in many decks (one-to-many)

### `deck_cards` table (Deck Contents)
- **Purpose**: Stores which cards belong to which decks (the 99 cards, not commander)
- **Contains**: References to cards via foreign key, plus deck relationship
- **Relationship**: References `cards.id` via foreign key constraint

### `decks` table (User Decks)
- **Purpose**: Stores deck metadata and commander information
- **Contains**: Deck name, commander info, owner (user_id)
- **Relationship**: One deck has many cards via `deck_cards`

## How They Work Together

```
┌─────────────┐
│    cards    │ ← Central repository of card data
└──────┬──────┘
       │
       │ (foreign key: fk_deck_cards_card)
       │
       ↓
┌─────────────┐       ┌─────────────┐
│ deck_cards  │ ─────→│    decks    │
└─────────────┘       └─────────────┘
  References cards      Owned by users
  per deck
```

## Data Flow

1. **User searches for a card** → API returns full card data
2. **User adds card to deck** →
   - Card data saved to `cards` table (upsert)
   - Reference added to `deck_cards` table with deck_id
3. **User selects commander** →
   - Card data saved to `cards` table (upsert)
   - Commander info saved in `decks` table

## Row Level Security (RLS)

### `cards` table
- **SELECT**: Everyone can read (public data)
- **INSERT/UPDATE**: Authenticated users can add/update
- **DELETE**: Only service role (prevents accidental data loss)

### `deck_cards` table
- **All operations**: Only deck owner (via user_id check on parent deck)

### `decks` table
- **All operations**: Only deck owner (via user_id match)

## Migration Order

Run migrations in order:
1. `001_create_tables.sql` - Creates decks and deck_cards
2. `002_add_source_column.sql` - Adds source tracking
3. `003_create_cards_table.sql` - Creates cards repository
4. `004_fix_cards_rls_policies.sql` - Fixes RLS permissions

## For Training Modules

Query examples for future AI training:

```sql
-- Get all unique cards used across all decks
SELECT DISTINCT c.*
FROM cards c
JOIN deck_cards dc ON c.id = dc.card_id;

-- Cards by keyword
SELECT * FROM cards
WHERE 'Flying' = ANY(keywords);

-- Cards by color identity (for Commander)
SELECT * FROM cards
WHERE color_identity @> ARRAY['G', 'U'];

-- Most popular cards
SELECT c.name, COUNT(dc.id) as deck_count
FROM cards c
LEFT JOIN deck_cards dc ON c.id = dc.card_id
GROUP BY c.id, c.name
ORDER BY deck_count DESC;

-- Cards with specific rules text (for training)
SELECT name, oracle_text, rulings
FROM cards
WHERE oracle_text ILIKE '%counter%'
  AND rulings IS NOT NULL;
```
