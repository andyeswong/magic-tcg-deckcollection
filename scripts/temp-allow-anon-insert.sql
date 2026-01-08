-- Temporary policy to allow anon role to insert card abilities
-- WARNING: This is for development only. Remove this policy in production.

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Temporary: Allow anon to insert abilities" ON public.card_abilities;

-- Create temporary policy for anon inserts
CREATE POLICY "Temporary: Allow anon to insert abilities"
  ON public.card_abilities FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow updates
DROP POLICY IF EXISTS "Temporary: Allow anon to update abilities" ON public.card_abilities;

CREATE POLICY "Temporary: Allow anon to update abilities"
  ON public.card_abilities FOR UPDATE
  TO anon
  USING (true);

COMMENT ON POLICY "Temporary: Allow anon to insert abilities" ON public.card_abilities
  IS 'TEMPORARY: For development parsing script. Remove in production.';
