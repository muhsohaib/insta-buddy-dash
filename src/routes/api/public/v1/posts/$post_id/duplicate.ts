import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/posts/$post_id/duplicate")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { duplicatePostCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const row = await duplicatePostCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.post_id,
          );
          return ok(rid, toPostView(row), { status: 201 });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
