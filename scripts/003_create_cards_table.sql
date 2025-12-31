-- Create cards table to store comprehensive card data for training modules
CREATE TABLE IF NOT EXISTS public.cards (
  id TEXT PRIMARY KEY, -- Unique card ID from API (scryfall_id, card id, etc.)
  name TEXT NOT NULL,
  oracle_text TEXT, -- The actual rules text of the card
  flavor_text TEXT, -- Flavor text for lore/atmosphere
  type_line TEXT, -- Full type line (e.g., "Legendary Creature — Human Warrior")
  mana_cost TEXT, -- Mana cost (e.g., "{1}{W}{U}")
  cmc DECIMAL, -- Converted mana cost
  colors TEXT[], -- Array of colors (e.g., ['W', 'U'])
  color_identity TEXT[], -- Color identity for Commander
  keywords TEXT[], -- Array of keywords (e.g., ['Flying', 'Vigilance'])
  power TEXT, -- Power (for creatures)
  toughness TEXT, -- Toughness (for creatures)
  rarity TEXT, -- Card rarity (common, uncommon, rare, mythic)
  source TEXT NOT NULL, -- API source ('mtg', 'scryfall')
  image_url TEXT, -- Card image URL
  set_code TEXT, -- Set code (e.g., 'KTK', 'LCC')
  set_name TEXT, -- Set name
  rulings JSONB, -- Store rulings as JSON for reference
  legalities JSONB, -- Store format legalities as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update deck_cards to reference the cards table
-- First, let's add a proper foreign key relationship
ALTER TABLE public.deck_cards
ADD CONSTRAINT fk_deck_cards_card
FOREIGN KEY (card_id)
REFERENCES public.cards(id)
ON DELETE RESTRICT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_name ON public.cards(name);
CREATE INDEX IF NOT EXISTS idx_cards_source ON public.cards(source);
CREATE INDEX IF NOT EXISTS idx_cards_type_line ON public.cards(type_line);
CREATE INDEX IF NOT EXISTS idx_cards_colors ON public.cards USING GIN(colors);
CREATE INDEX IF NOT EXISTS idx_cards_color_identity ON public.cards USING GIN(color_identity);
CREATE INDEX IF NOT EXISTS idx_cards_keywords ON public.cards USING GIN(keywords);

-- Enable RLS on cards table
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- RLS Policy for cards - allow all authenticated users to read
CREATE POLICY "Anyone can view cards"
  ON public.cards FOR SELECT
  USING (true);

-- Only allow INSERT/UPDATE through application logic (service role)
-- This prevents users from polluting the card database
CREATE POLICY "Service role can insert cards"
  ON public.cards FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update cards"
  ON public.cards FOR UPDATE
  TO service_role
  USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cards table
CREATE TRIGGER update_cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for decks table
CREATE TRIGGER update_decks_updated_at
  BEFORE UPDATE ON public.decks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.cards IS 'Stores comprehensive MTG card data for deck building and training modules';
COMMENT ON COLUMN public.cards.oracle_text IS 'The official rules text of the card';
COMMENT ON COLUMN public.cards.flavor_text IS 'Flavor text for lore and atmosphere';
COMMENT ON COLUMN public.cards.color_identity IS 'Color identity used for Commander format deck building';
COMMENT ON COLUMN public.cards.rulings IS 'JSON array of card rulings and clarifications';
COMMENT ON COLUMN public.cards.legalities IS 'JSON object of format legalities';
