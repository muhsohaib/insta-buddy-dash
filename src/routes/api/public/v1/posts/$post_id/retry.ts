import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/posts/$post_id/retry")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { retryPostCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const row = await retryPostCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.post_id,
          );
          return ok(rid, toPostView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
