-- =============================================================
-- Migration 002: Add slug column to shops
-- =============================================================

-- Add nullable slug column first to allow backfill on existing rows
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slug from name for any existing rows
UPDATE public.shops
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug required and unique
ALTER TABLE public.shops
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_slug_unique UNIQUE (slug);

-- Index for fast lookups by slug
CREATE INDEX IF NOT EXISTS shops_slug_idx ON public.shops(slug);

-- Auto-generate slug from name on INSERT when slug is not provided
CREATE OR REPLACE FUNCTION public.shops_auto_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    NEW.slug := lower(regexp_replace(trim(NEW.name), '[^a-zA-Z0-9]+', '-', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_auto_slug ON public.shops;
CREATE TRIGGER shops_auto_slug
  BEFORE INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_auto_slug();
