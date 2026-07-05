// Webhook delivery worker — cron-driven.
// Called every minute by pg_cron. Picks a batch of pending / retrying
// deliveries whose next_attempt_at has elapsed, POSTs the signed payload
// to the subscriber URL, and records the outcome with exponential backoff.
//
// Retry policy:
//   attempts 1..7 → retry with backoff = min(30 * 2^(attempts-1), 3600) seconds
//   attempts >= 8 → mark failed, stop retrying
//
// Security: /api/public/* bypasses auth at the edge, so this handler
// verifies the Supabase anon key in the `apikey` header before running.
import { createFileRoute } from "@tanstack/react-router";
import { signBody } from "@/lib/webhooks-dispatch.server";

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 8;
const TIMEOUT_MS = 10_000;

type DeliveryRow = {
  id: string;
  webhook_id: string;
  workspace_id: string;
  event: string;
  payload: unknown;
  attempts: number;
};

function nextBackoffSeconds(nextAttempts: number): number {
  // attempts=1 -> 30s, 2 -> 60, 3 -> 120, ... capped at 1h
  const raw = 30 * Math.pow(2, Math.max(0, nextAttempts - 1));
  return Math.min(raw, 3600);
}

async function deliverOne(
  supabase: Awaited<ReturnType<typeof getAdmin>>,
  row: DeliveryRow,
): Promise<void> {
  const { data: wh, error: whErr } = await supabase
    .from("webhooks")
    .select("id, url, secret, status")
    .eq("id", row.webhook_id)
    .maybeSingle();
  if (whErr || !wh) {
    await supabase
      .from("webhook_deliveries")
      .update({ status: "failed", response_body: "webhook not found", next_attempt_at: null })
      .eq("id", row.id);
    return;
  }
  if (wh.status !== "active") {
    await supabase
      .from("webhook_deliveries")
      .update({ status: "failed", response_body: `webhook ${wh.status}`, next_attempt_at: null })
      .eq("id", row.id);
    return;
  }

  const rawBody = JSON.stringify(row.payload ?? {});
  const ts = Math.floor(Date.now() / 1000);
  const signature = signBody(wh.secret, ts, rawBody);

  const nextAttempts = row.attempts + 1;
  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let ok = false;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Lovable-Webhooks/1.0",
        "lovable-signature": signature,
        "lovable-event": row.event,
        "lovable-delivery-id": row.id,
      },
      body: rawBody,
      signal: ctrl.signal,
    });
    httpStatus = res.status;
    const text = await res.text().catch(() => "");
    responseBody = text.slice(0, 2000);
    ok = res.ok;
  } catch (err) {
    responseBody = `fetch_error: ${String(err).slice(0, 500)}`;
  } finally {
    clearTimeout(timer);
  }

  if (ok) {
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "delivered",
        attempts: nextAttempts,
        http_status: httpStatus,
        response_body: responseBody,
        delivered_at: new Date().toISOString(),
        next_attempt_at: null,
      })
      .eq("id", row.id);
    return;
  }

  if (nextAttempts >= MAX_ATTEMPTS) {
    await supabase
      .from("webhook_deliveries")
      .update({
        status: "failed",
        attempts: nextAttempts,
        http_status: httpStatus,
        response_body: responseBody,
        next_attempt_at: null,
      })
      .eq("id", row.id);
    return;
  }

  const backoff = nextBackoffSeconds(nextAttempts);
  const next = new Date(Date.now() + backoff * 1000).toISOString();
  await supabase
    .from("webhook_deliveries")
    .update({
      status: "retrying",
      attempts: nextAttempts,
      http_status: httpStatus,
      response_body: responseBody,
      next_attempt_at: next,
    })
    .eq("id", row.id);
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function runWorker(): Promise<{ processed: number; delivered: number; retrying: number; failed: number }> {
  const supabase = await getAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, workspace_id, event, payload, attempts")
    .in("status", ["pending", "retrying"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as DeliveryRow[];

  let delivered = 0;
  let retrying = 0;
  let failed = 0;
  for (const row of rows) {
    const before = row.attempts + 1;
    await deliverOne(supabase, row);
    // Best-effort classification for the response summary.
    const { data: after } = await supabase
      .from("webhook_deliveries")
      .select("status")
      .eq("id", row.id)
      .maybeSingle();
    if (after?.status === "delivered") delivered++;
    else if (after?.status === "failed") failed++;
    else if (before >= MAX_ATTEMPTS) failed++;
    else retrying++;
  }
  return { processed: rows.length, delivered, retrying, failed };
}

export const Route = createFileRoute("/api/public/hooks/webhook-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const summary = await runWorker();
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[webhook-worker] failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: String(err).slice(0, 500) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
