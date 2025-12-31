-- Drop the overly restrictive RLS policies for cards
DROP POLICY IF EXISTS "Service role can insert cards" ON public.cards;
DROP POLICY IF EXISTS "Service role can update cards" ON public.cards;

-- Create new RLS policies that allow authenticated users to contribute card data
-- This makes sense because cards are just data from external APIs that users interact with

-- Allow all authenticated users to insert cards
CREATE POLICY "Authenticated users can insert cards"
  ON public.cards FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update cards
-- This allows collaborative improvement of card data
CREATE POLICY "Authenticated users can update cards"
  ON public.cards FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Prevent regular users from deleting cards
-- Only service role can delete cards if needed
CREATE POLICY "Only service role can delete cards"
  ON public.cards FOR DELETE
  TO service_role
  USING (true);

-- Add helpful comment
COMMENT ON TABLE public.cards IS 'Stores comprehensive MTG card data. Authenticated users can add/update cards from API sources. Deletion restricted to service role.';
