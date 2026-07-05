import { createFileRoute } from "@tanstack/react-router";

// orders.list_deliveries
export const Route = createFileRoute("/api/public/v1/orders/$order_id/deliveries")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listDeliveries } = await import("@/lib/deliveries.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const { data, page } = await listDeliveries(auth, {
            limit: parseLimit(url.searchParams.get("limit")),
            cursor: parseCursor(url.searchParams.get("cursor")),
            orderId: params.order_id,
          });
          return okList(rid, data, page);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
