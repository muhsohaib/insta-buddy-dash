import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// orders.replacement
export const Route = createFileRoute("/api/public/v1/orders/$order_id/replacement")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { createReplacementOrder } = await import("@/lib/orders.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z.object({ reason: z.string().min(1).max(500) }).safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const view = await createReplacementOrder(auth, params.order_id, parsed.data.reason);
          return ok(rid, view, { status: 201 });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
