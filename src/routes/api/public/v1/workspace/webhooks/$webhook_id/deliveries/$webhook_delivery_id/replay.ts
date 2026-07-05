import { createFileRoute } from "@tanstack/react-router";

// webhooks.replay_delivery
export const Route = createFileRoute(
  "/api/public/v1/workspace/webhooks/$webhook_id/deliveries/$webhook_delivery_id/replay",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { replayDelivery } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const view = await replayDelivery(auth, params.webhook_id, params.webhook_delivery_id);
          return ok(rid, view, { status: 202 });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
