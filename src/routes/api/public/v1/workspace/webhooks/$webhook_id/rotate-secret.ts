import { createFileRoute } from "@tanstack/react-router";

// webhooks.rotate_secret
export const Route = createFileRoute("/api/public/v1/workspace/webhooks/$webhook_id/rotate-secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { rotateSecret } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await rotateSecret(auth, params.webhook_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
