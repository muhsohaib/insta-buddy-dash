import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/posts/$post_id/status")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse } = await import("@/lib/api/envelope");
        const { getPostStatusCore } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const view = await getPostStatusCore(auth.supabase, auth.orgId, params.post_id);
          return ok(rid, view);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
