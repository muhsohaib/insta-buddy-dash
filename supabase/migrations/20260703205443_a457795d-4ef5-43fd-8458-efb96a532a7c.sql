
CREATE OR REPLACE FUNCTION public.mirror_order_item_to_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE mapped text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    mapped := CASE NEW.status
      WHEN 'waiting'   THEN 'pending_details'
      WHEN 'creating'  THEN 'creating'
      WHEN 'warming'   THEN 'warming_up'
      WHEN 'ready'     THEN 'ready'
      WHEN 'delivered' THEN 'ready'
      WHEN 'cancelled' THEN 'cancelled'
    END;
    UPDATE public.instagram_accounts
      SET status = mapped::account_status
      WHERE order_item_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS order_items_mirror ON public.order_items;
CREATE TRIGGER order_items_mirror AFTER UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.mirror_order_item_to_account();
