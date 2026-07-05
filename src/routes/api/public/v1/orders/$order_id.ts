import { createFileRoute } from "@tanstack/react-router";

// orders.get
export const Route = createFileRoute("/api/public/v1/orders/$order_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getOrderSpec } = await import("@/lib/orders.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getOrderSpec(auth, params.order_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
