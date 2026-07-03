
-- Un-archive: rename back into place
ALTER TABLE IF EXISTS public._archived_instagram_accounts RENAME TO instagram_accounts;
ALTER TABLE IF EXISTS public._archived_account_details RENAME TO account_details;
ALTER TABLE IF EXISTS public._archived_scheduled_posts RENAME TO scheduled_posts;

-- Link instagram_accounts to order_items (one-to-one when created via orders)
ALTER TABLE public.instagram_accounts
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS instagram_accounts_order_item_uidx
  ON public.instagram_accounts(order_item_id) WHERE order_item_id IS NOT NULL;
