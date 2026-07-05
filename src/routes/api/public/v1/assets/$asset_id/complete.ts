import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// assets.complete
export const Route = createFileRoute("/api/public/v1/assets/$asset_id/complete")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { completeAsset } = await import("@/lib/assets.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              sha256: z.string().length(64).optional(),
              bytes: z.number().int().nonnegative().optional(),
            })
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          return ok(rid, await completeAsset(auth, params.asset_id, parsed.data));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
