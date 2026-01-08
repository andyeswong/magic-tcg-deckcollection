-- Upgrade card_abilities table to support v1.1 schema
-- This is a NON-BREAKING change - v1.0 data remains valid

-- Add migration tracking
ALTER TABLE public.card_abilities
ADD COLUMN IF NOT EXISTS schema_migrated_to TEXT;

-- Add index for schema version queries
CREATE INDEX IF NOT EXISTS idx_card_abilities_schema ON public.card_abilities(schema_version);

-- Update the schema_version check constraint to allow v1.1
-- (Drop old constraint if it exists, add new one)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_schema_version'
  ) THEN
    ALTER TABLE public.card_abilities DROP CONSTRAINT check_schema_version;
  END IF;
END $$;

-- Add updated constraint
ALTER TABLE public.card_abilities
ADD CONSTRAINT check_schema_version
CHECK (schema_version IN ('1.0', '1.1'));

-- Update function to detect v1.1 features in JSON
CREATE OR REPLACE FUNCTION detect_v1_1_features(abilities_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  has_v1_1_features BOOLEAN := FALSE;
BEGIN
  -- Check for v1.1 specific features

  -- Check for saga abilities
  IF abilities_json ? 'saga' AND abilities_json->'saga' IS NOT NULL THEN
    has_v1_1_features := TRUE;
  END IF;

  -- Check for dynamic values in any ability
  IF abilities_json::text LIKE '%"type":"dynamic"%' THEN
    has_v1_1_features := TRUE;
  END IF;

  -- Check for keyword actions (investigate, explore, discover, adapt)
  IF abilities_json::text LIKE '%"keywordAction"%' THEN
    has_v1_1_features := TRUE;
  END IF;

  -- Check for new counter types (stun, shield, vow, lore)
  IF abilities_json::text ~* '"type":"(stun|shield|vow|lore|indestructible)"' THEN
    has_v1_1_features := TRUE;
  END IF;

  -- Check for transformation effects
  IF abilities_json::text LIKE '%"transformation"%' THEN
    has_v1_1_features := TRUE;
  END IF;

  -- Check for sunburst
  IF abilities_json::text LIKE '%"sunburst"%' THEN
    has_v1_1_features := TRUE;
  END IF;

  RETURN has_v1_1_features;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-upgrade schema_version based on content
CREATE OR REPLACE FUNCTION auto_set_schema_version()
RETURNS TRIGGER AS $$
BEGIN
  -- If version is explicitly set, keep it
  IF NEW.schema_version = '1.1' THEN
    RETURN NEW;
  END IF;

  -- Auto-detect if v1.1 features are present
  IF detect_v1_1_features(NEW.abilities) THEN
    NEW.schema_version := '1.1';
  ELSIF NEW.schema_version IS NULL THEN
    NEW.schema_version := '1.0';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set schema version
DROP TRIGGER IF EXISTS auto_schema_version ON public.card_abilities;
CREATE TRIGGER auto_schema_version
  BEFORE INSERT OR UPDATE ON public.card_abilities
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_schema_version();

-- Add helpful queries as comments

COMMENT ON FUNCTION detect_v1_1_features IS 'Detects if a JSONB abilities object uses v1.1 features';
COMMENT ON FUNCTION auto_set_schema_version IS 'Automatically sets schema_version based on abilities content';

-- Example queries:

-- Find all v1.1 cards
-- SELECT card_id, schema_version FROM card_abilities WHERE schema_version = '1.1';

-- Find cards that should be migrated to v1.1
-- SELECT card_id FROM card_abilities
-- WHERE schema_version = '1.0' AND detect_v1_1_features(abilities) = TRUE;

-- Manually migrate a card to v1.1
-- UPDATE card_abilities
-- SET schema_version = '1.1', schema_migrated_to = '1.1'
-- WHERE card_id = 'some-card-id';

-- Statistics: Count by schema version
-- SELECT schema_version, COUNT(*) FROM card_abilities GROUP BY schema_version;
