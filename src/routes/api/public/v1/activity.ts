import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/activity — spec operationId: activity.list
// Filters: event, actor_type, resource_type, resource_id, cursor, limit.
export const Route = createFileRoute("/api/public/v1/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, okList, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { parseLimit, parseCursor, paginate } = await import("@/lib/api/pagination");
        const { listActivitiesCore, toActivityView } = await import("@/lib/activity.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = parseCursor(url.searchParams.get("cursor"));

          const actorFilter = url.searchParams.get("actor_type");
          const validActor = ["human", "ai", "system"] as const;
          if (actorFilter && !validActor.includes(actorFilter as (typeof validActor)[number])) {
            throw new SpecError("invalid_filter", "actor_type must be human|ai|system", {
              actor_type: "unknown value",
            });
          }

          const rows = await listActivitiesCore(auth.supabase, {
            orgId: auth.orgId,
            limit,
            cursor,
            filters: {
              event: url.searchParams.get("event") ?? undefined,
              actor_type: (actorFilter as "human" | "ai" | "system" | null) ?? undefined,
              resource_type: url.searchParams.get("resource_type") ?? undefined,
              resource_id: url.searchParams.get("resource_id") ?? undefined,
            },
          });
          const { data, page } = paginate(rows, limit, (r) => r.occurred_at);
          return okList(rid, data.map(toActivityView), page);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
