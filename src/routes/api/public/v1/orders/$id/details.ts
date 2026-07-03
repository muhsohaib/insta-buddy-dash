import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/public/v1/orders/{id}/details  — submit per-item details
export const Route = createFileRoute("/api/public/v1/orders/$id/details")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse, ApiError } = await import(
          "@/lib/api-auth.server"
        );
        const { saveItemDetailsCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              submit: z.boolean().default(true),
              items: z
                .array(
                  z.object({
                    order_item_id: z.string().uuid(),
                    data: z.record(z.string(), z.unknown()),
                  }),
                )
                .min(1),
            })
            .safeParse(body);
          if (!parsed.success) {
            throw new ApiError(400, "invalid_input", parsed.error.message);
          }
          const result = await saveItemDetailsCore(auth, {
            order_id: params.id,
            items: parsed.data.items,
            submit: parsed.data.submit,
          });
          return jsonResponse(200, { data: result });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
