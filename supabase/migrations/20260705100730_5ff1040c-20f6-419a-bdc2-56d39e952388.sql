-- Idempotency keys for /api/public/v1 mutations.
CREATE TABLE public.api_idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  response_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX api_idempotency_expires_idx ON public.api_idempotency_keys (expires_at);

GRANT ALL ON public.api_idempotency_keys TO service_role;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
-- Deny-all for authenticated/anon; only service_role (used by server handlers) may read/write.
CREATE POLICY "idem service only insert" ON public.api_idempotency_keys FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "idem service only select" ON public.api_idempotency_keys FOR SELECT TO authenticated USING (false);

-- Fixed-window rate-limit counters.
CREATE TABLE public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, bucket, window_start)
);
CREATE INDEX api_rate_limits_lookup_idx ON public.api_rate_limits (workspace_id, bucket, window_start DESC);

GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rl service only insert" ON public.api_rate_limits FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "rl service only select" ON public.api_rate_limits FOR SELECT TO authenticated USING (false);

-- Atomic increment for the rate limiter.
CREATE OR REPLACE FUNCTION public.api_rate_limit_hit(
  _workspace_id TEXT,
  _bucket TEXT,
  _window_start TIMESTAMPTZ,
  _window_seconds INTEGER,
  _limit INTEGER
) RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.api_rate_limits (workspace_id, bucket, window_start, window_seconds, count)
    VALUES (_workspace_id, _bucket, _window_start, _window_seconds, 1)
    ON CONFLICT (workspace_id, bucket, window_start)
    DO UPDATE SET count = api_rate_limits.count + 1, updated_at = now()
    RETURNING count INTO new_count;
  RETURN QUERY SELECT
    (new_count <= _limit),
    GREATEST(_limit - new_count, 0),
    (_window_start + (_window_seconds || ' seconds')::INTERVAL);
END;
$$;

REVOKE ALL ON FUNCTION public.api_rate_limit_hit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_rate_limit_hit(TEXT, TEXT, TIMESTAMPTZ, INTEGER, INTEGER) TO service_role;