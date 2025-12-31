-- Enable Realtime for deck_cards table to allow live updates in the UI
-- This allows the deck builder to update card counts and previews in real-time

ALTER PUBLICATION supabase_realtime ADD TABLE deck_cards;

-- Also enable for decks table in case we want live deck updates
ALTER PUBLICATION supabase_realtime ADD TABLE decks;

-- Enable for cards table for potential future features
ALTER PUBLICATION supabase_realtime ADD TABLE cards;

-- Add comment
COMMENT ON TABLE deck_cards IS 'Cards in user decks. Realtime enabled for live UI updates during deck building.';
