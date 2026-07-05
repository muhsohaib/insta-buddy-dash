import { createFileRoute } from "@tanstack/react-router";

// webhooks.list_deliveries
export const Route = createFileRoute("/api/public/v1/workspace/webhooks/$webhook_id/deliveries")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listDeliveries } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const { data, page } = await listDeliveries(auth, params.webhook_id, {
            limit: parseLimit(url.searchParams.get("limit")),
            cursor: parseCursor(url.searchParams.get("cursor")),
          });
          return okList(rid, data, page);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
