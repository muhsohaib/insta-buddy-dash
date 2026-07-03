import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/calendar?from=&to=
// Thin wrapper for calendar consumers — returns publications keyed by date.
export const Route = createFileRoute("/api/public/v1/calendar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { listPublicationsInRangeCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const from = url.searchParams.get("from") ?? undefined;
          const to = url.searchParams.get("to") ?? undefined;
          const rows = await listPublicationsInRangeCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            { from, to },
          );
          type PubRow = {
            id: string;
            scheduled_at: string;
            type: string;
            status: string;
            account_id: string;
            caption: string;
          };
          const byDay: Record<string, PubRow[]> = {};
          for (const p of rows as unknown as PubRow[]) {
            const d = new Date(p.scheduled_at).toISOString().slice(0, 10);
            (byDay[d] ??= []).push(p);
          }
          return jsonResponse(200, { data: { range: { from, to }, days: byDay } });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
