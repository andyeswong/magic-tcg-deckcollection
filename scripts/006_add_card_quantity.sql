-- Add quantity column to deck_cards table to track multiple copies of the same card
ALTER TABLE public.deck_cards
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 CHECK (quantity > 0);

-- Create a unique constraint to prevent duplicate card entries
-- Instead, we'll update the quantity when adding the same card
ALTER TABLE public.deck_cards
ADD CONSTRAINT unique_card_per_deck UNIQUE (deck_id, card_id);

-- Add index for better performance when counting total cards
CREATE INDEX IF NOT EXISTS idx_deck_cards_quantity ON public.deck_cards(deck_id, quantity);

-- Add comment
COMMENT ON COLUMN public.deck_cards.quantity IS 'Number of copies of this card in the deck (1-4 for most cards, unlimited for basic lands)';
