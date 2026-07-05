ALTER TABLE public.publication_media
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_publication_media_asset_id
  ON public.publication_media(asset_id);