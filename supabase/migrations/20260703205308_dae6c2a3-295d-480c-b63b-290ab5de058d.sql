
-- 1. Archive old operational tables (keep data, remove from app path)
ALTER TABLE IF EXISTS public.scheduled_posts RENAME TO _archived_scheduled_posts;
ALTER TABLE IF EXISTS public.account_details RENAME TO _archived_account_details;
ALTER TABLE IF EXISTS public.instagram_accounts RENAME TO _archived_instagram_accounts;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.order_payment_status AS ENUM ('pending','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'draft','awaiting_payment','awaiting_details','pending',
    'in_progress','ready','delivered','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_item_status AS ENUM (
    'waiting','creating','warming','ready','delivered','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  unit_price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  billing_interval text NOT NULL DEFAULT 'monthly', -- 'monthly' | 'one_time'
  details_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  deliverable_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.products TO authenticated;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_anon_auth ON public.products FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 4. Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigserial NOT NULL UNIQUE,
  org_id text NOT NULL,
  created_by_user_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity >= 1 AND quantity <= 10),
  unit_price_cents integer NOT NULL,
  subtotal_cents integer NOT NULL,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_status public.order_payment_status NOT NULL DEFAULT 'pending',
  payment_provider text NOT NULL DEFAULT 'whop',
  payment_ref text,
  whop_subscription_id text,
  whop_membership_id text,
  status public.order_status NOT NULL DEFAULT 'draft',
  paid_at timestamptz,
  details_submitted_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_org_idx ON public.orders(org_id);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_payment_ref_idx ON public.orders(payment_ref);
GRANT ALL ON public.orders TO service_role;
GRANT SELECT ON public.orders TO authenticated;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_anon_auth ON public.orders FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 5. Order items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  position integer NOT NULL,
  status public.order_item_status NOT NULL DEFAULT 'waiting',
  assigned_admin_id text,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_status_idx ON public.order_items(status);
GRANT ALL ON public.order_items TO service_role;
GRANT SELECT ON public.order_items TO authenticated;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_anon_auth ON public.order_items FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 6. Order item details (customer input)
CREATE TABLE public.order_item_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_item_details TO service_role;
GRANT SELECT ON public.order_item_details TO authenticated;
ALTER TABLE public.order_item_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_anon_auth ON public.order_item_details FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 7. Order item deliverables (admin handoff)
CREATE TABLE public.order_item_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamptz,
  delivered_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_item_deliverables TO service_role;
GRANT SELECT ON public.order_item_deliverables TO authenticated;
ALTER TABLE public.order_item_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_anon_auth ON public.order_item_deliverables FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 8. Order events (audit)
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  actor_user_id text,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON public.order_events(order_id);
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_anon_auth ON public.order_events FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 9. updated_at triggers
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER order_items_updated BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER order_item_details_updated BEFORE UPDATE ON public.order_item_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER order_item_deliverables_updated BEFORE UPDATE ON public.order_item_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Auto-stamp item timestamps on status change
CREATE OR REPLACE FUNCTION public.stamp_order_item_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'creating' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
    IF NEW.status = 'ready' AND NEW.ready_at IS NULL THEN NEW.ready_at := now(); END IF;
    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_items_stamp BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_order_item_status();

-- 11. Recompute parent order status from items + payment
CREATE OR REPLACE FUNCTION public.recompute_order_status(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  total_items int;
  active_items int;
  ready_items int;
  delivered_items int;
  progressing_items int;
  submitted_items int;
  new_status public.order_status;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF o.payment_status = 'refunded' OR o.status = 'cancelled' THEN
    RETURN;
  END IF;

  IF o.payment_status <> 'paid' THEN
    new_status := CASE WHEN o.payment_status = 'pending' THEN 'awaiting_payment'::public.order_status
                       ELSE 'draft'::public.order_status END;
    UPDATE public.orders SET status = new_status WHERE id = p_order_id AND status IS DISTINCT FROM new_status;
    RETURN;
  END IF;

  SELECT
    count(*) FILTER (WHERE status <> 'cancelled'),
    count(*) FILTER (WHERE status = 'ready'),
    count(*) FILTER (WHERE status = 'delivered'),
    count(*) FILTER (WHERE status IN ('creating','warming')),
    count(*)
  INTO active_items, ready_items, delivered_items, progressing_items, total_items
  FROM public.order_items WHERE order_id = p_order_id;

  SELECT count(*) INTO submitted_items
  FROM public.order_item_details d
  JOIN public.order_items i ON i.id = d.order_item_id
  WHERE i.order_id = p_order_id AND d.submitted_at IS NOT NULL;

  IF active_items = 0 THEN
    new_status := 'cancelled';
  ELSIF delivered_items = active_items THEN
    new_status := 'delivered';
  ELSIF (ready_items + delivered_items) = active_items THEN
    -- Auto-deliver: when all accounts ready, mark items and order delivered.
    UPDATE public.order_items SET status = 'delivered'
      WHERE order_id = p_order_id AND status = 'ready';
    new_status := 'delivered';
  ELSIF progressing_items > 0 THEN
    new_status := 'in_progress';
  ELSIF submitted_items >= active_items THEN
    new_status := 'pending';
  ELSE
    new_status := 'awaiting_details';
  END IF;

  UPDATE public.orders
  SET status = new_status,
      details_submitted_at = COALESCE(details_submitted_at,
        CASE WHEN submitted_items >= active_items AND active_items > 0 THEN now() END),
      ready_at = COALESCE(ready_at, CASE WHEN new_status IN ('ready','delivered') THEN now() END),
      delivered_at = COALESCE(delivered_at, CASE WHEN new_status = 'delivered' THEN now() END)
  WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_from_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_order_status(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END $$;
CREATE TRIGGER order_items_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_from_item();

CREATE OR REPLACE FUNCTION public.trg_recompute_from_details()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE oid uuid;
BEGIN
  SELECT order_id INTO oid FROM public.order_items WHERE id = COALESCE(NEW.order_item_id, OLD.order_item_id);
  IF oid IS NOT NULL THEN PERFORM public.recompute_order_status(oid); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_item_details_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.order_item_details
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_from_details();

-- 12. Seed Instagram product
INSERT INTO public.products (code, name, description, unit_price_cents, currency, billing_interval, details_schema, deliverable_schema)
VALUES (
  'instagram_account',
  'Warmed Instagram Account',
  'A hand-warmed Instagram account, delivered ready to post.',
  4900, 'USD', 'monthly',
  '{
    "fields": [
      {"key":"brand_name","label":"Brand Name","type":"text","required":true},
      {"key":"website","label":"Website","type":"url"},
      {"key":"niche","label":"Niche","type":"text","required":true},
      {"key":"bio","label":"Bio","type":"textarea","required":true,"max":500},
      {"key":"username_style","label":"Username Style","type":"text","placeholder":"e.g. brand.official, brand_hq"},
      {"key":"target_country","label":"Target Country","type":"text","required":true},
      {"key":"profile_photo_url","label":"Profile Picture","type":"image"},
      {"key":"competitors","label":"Competitor Accounts","type":"tags"},
      {"key":"notes","label":"Notes for our team","type":"textarea","max":2000}
    ]
  }'::jsonb,
  '{
    "fields": [
      {"key":"ig_username","label":"Instagram Username","type":"text","required":true},
      {"key":"ig_password","label":"Password","type":"secret","required":true},
      {"key":"profile_url","label":"Profile URL","type":"url"},
      {"key":"email","label":"Linked Email","type":"text"},
      {"key":"email_password","label":"Email Password","type":"secret"},
      {"key":"handoff_notes","label":"Handoff Notes","type":"textarea"}
    ]
  }'::jsonb
)
ON CONFLICT (code) DO NOTHING;
