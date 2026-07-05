import { createFileRoute } from "@tanstack/react-router";

// api_keys.get + api_keys.delete
export const Route = createFileRoute("/api/public/v1/workspace/api-keys/$api_key_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getApiKey } = await import("@/lib/api-keys.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getApiKey(auth, params.api_key_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { deleteApiKey } = await import("@/lib/api-keys.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          await deleteApiKey(auth, params.api_key_id);
          return ok(rid, { id: params.api_key_id, revoked: true });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
