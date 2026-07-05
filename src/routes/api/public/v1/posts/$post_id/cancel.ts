import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/v1/posts/$post_id/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { cancelPostCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({ reason: z.string().max(500).optional() })
            .strict()
            .safeParse(body ?? {});
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const row = await cancelPostCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.post_id,
            parsed.data.reason,
          );
          return ok(rid, toPostView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
