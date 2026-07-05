import { createFileRoute } from "@tanstack/react-router";

// deliveries.get
export const Route = createFileRoute("/api/public/v1/deliveries/$delivery_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getDelivery } = await import("@/lib/deliveries.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getDelivery(auth, params.delivery_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
