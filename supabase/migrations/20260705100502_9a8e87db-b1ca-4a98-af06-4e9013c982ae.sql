CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add index for worker query performance
CREATE INDEX IF NOT EXISTS whd_worker_idx
  ON public.webhook_deliveries (status, next_attempt_at)
  WHERE status IN ('pending', 'retrying');