-- Add source column to deck_cards table to track card API source
ALTER TABLE deck_cards
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'mtg';

-- Add source column to decks table for commander source
ALTER TABLE decks
ADD COLUMN IF NOT EXISTS commander_source TEXT DEFAULT 'mtg';
