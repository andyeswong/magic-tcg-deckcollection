-- Create card_abilities table to store structured ability data for cards
-- This table stores abilities in a standardized JSON format for game engine consumption

CREATE TABLE IF NOT EXISTS public.card_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,

  -- JSON standard version for future compatibility
  schema_version TEXT NOT NULL DEFAULT '1.0',

  -- Complete ability data as JSON (follows ability-json-standard.md)
  abilities JSONB NOT NULL,

  -- Denormalized fields for quick filtering/querying
  has_static_abilities BOOLEAN DEFAULT false,
  has_triggered_abilities BOOLEAN DEFAULT false,
  has_activated_abilities BOOLEAN DEFAULT false,
  has_replacement_effects BOOLEAN DEFAULT false,
  has_keywords BOOLEAN DEFAULT false,

  -- Metadata
  parsing_confidence DECIMAL CHECK (parsing_confidence >= 0 AND parsing_confidence <= 1),
  parsing_notes TEXT, -- Any notes about ambiguous parsing or special cases
  manually_verified BOOLEAN DEFAULT false,
  manually_edited BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one ability record per card
  UNIQUE(card_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_card_abilities_card_id ON public.card_abilities(card_id);
CREATE INDEX IF NOT EXISTS idx_card_abilities_has_static ON public.card_abilities(has_static_abilities) WHERE has_static_abilities = true;
CREATE INDEX IF NOT EXISTS idx_card_abilities_has_triggered ON public.card_abilities(has_triggered_abilities) WHERE has_triggered_abilities = true;
CREATE INDEX IF NOT EXISTS idx_card_abilities_has_activated ON public.card_abilities(has_activated_abilities) WHERE has_activated_abilities = true;
CREATE INDEX IF NOT EXISTS idx_card_abilities_has_replacement ON public.card_abilities(has_replacement_effects) WHERE has_replacement_effects = true;
CREATE INDEX IF NOT EXISTS idx_card_abilities_verified ON public.card_abilities(manually_verified) WHERE manually_verified = true;

-- GIN index for JSONB queries (allows searching within JSON structure)
CREATE INDEX IF NOT EXISTS idx_card_abilities_json ON public.card_abilities USING GIN(abilities);

-- Enable RLS on card_abilities table
ALTER TABLE public.card_abilities ENABLE ROW LEVEL SECURITY;

-- RLS Policy - allow all authenticated users to read
CREATE POLICY "Anyone can view card abilities"
  ON public.card_abilities FOR SELECT
  USING (true);

-- Only allow INSERT/UPDATE through application logic (service role)
CREATE POLICY "Service role can insert card abilities"
  ON public.card_abilities FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update card abilities"
  ON public.card_abilities FOR UPDATE
  TO service_role
  USING (true);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_card_abilities_updated_at
  BEFORE UPDATE ON public.card_abilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically update denormalized boolean fields
CREATE OR REPLACE FUNCTION update_ability_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Update boolean flags based on JSON content
  NEW.has_static_abilities := jsonb_array_length(NEW.abilities->'static') > 0;
  NEW.has_triggered_abilities := jsonb_array_length(NEW.abilities->'triggered') > 0;
  NEW.has_activated_abilities := jsonb_array_length(NEW.abilities->'activated') > 0;
  NEW.has_replacement_effects := jsonb_array_length(NEW.abilities->'replacement') > 0;
  NEW.has_keywords := jsonb_array_length(NEW.abilities->'keywords') > 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update flags
CREATE TRIGGER update_card_ability_flags
  BEFORE INSERT OR UPDATE ON public.card_abilities
  FOR EACH ROW
  EXECUTE FUNCTION update_ability_flags();

-- Add comments for documentation
COMMENT ON TABLE public.card_abilities IS 'Stores structured ability data for MTG cards in standardized JSON format';
COMMENT ON COLUMN public.card_abilities.abilities IS 'Complete ability data following the ability-json-standard.md specification';
COMMENT ON COLUMN public.card_abilities.schema_version IS 'Version of the JSON schema used (for future compatibility)';
COMMENT ON COLUMN public.card_abilities.parsing_confidence IS 'AI confidence score (0.0-1.0) for the parsed abilities';
COMMENT ON COLUMN public.card_abilities.parsing_notes IS 'Notes about parsing ambiguities or special handling required';
COMMENT ON COLUMN public.card_abilities.manually_verified IS 'True if a human has verified the abilities are correct';
COMMENT ON COLUMN public.card_abilities.manually_edited IS 'True if the abilities were manually edited after AI parsing';

-- Example query to find all cards with triggered abilities:
-- SELECT c.name, ca.abilities->'triggered'
-- FROM cards c
-- JOIN card_abilities ca ON c.id = ca.card_id
-- WHERE ca.has_triggered_abilities = true;

-- Example query to find cards with specific trigger events:
-- SELECT c.name
-- FROM cards c
-- JOIN card_abilities ca ON c.id = ca.card_id
-- WHERE ca.abilities @> '{"triggered": [{"trigger": {"event": "etb"}}]}';
