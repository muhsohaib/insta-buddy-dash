import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/public/v1/posts:bulk-cancel   posts.bulk_cancel
export const Route = createFileRoute("/api/public/v1/posts:bulk-cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { cancelPostCore } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              post_ids: z.array(z.string().min(1)).min(1).max(500),
              reason: z.string().optional(),
            })
            .strict()
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const ctx = {
            supabase: auth.supabase,
            orgId: auth.orgId,
            userId: auth.userId,
            via: (auth.actor === "machine" ? "api" : "web") as "api" | "web",
          };
          let succeeded = 0;
          let failed = 0;
          for (const id of parsed.data.post_ids) {
            try {
              await cancelPostCore(ctx, id, parsed.data.reason);
              succeeded += 1;
            } catch {
              failed += 1;
            }
          }
          const total = succeeded + failed;
          return ok(
            rid,
            {
              operation_id: `op_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
              status: failed === 0 ? "succeeded" : succeeded === 0 ? "failed" : "succeeded",
              progress: 1,
              summary: { total, succeeded, failed },
            },
            { status: 202 },
          );
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
