import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET  /api/public/v1/orders          list workspace orders
// POST /api/public/v1/orders          create a new order + return checkout URL
export const Route = createFileRoute("/api/public/v1/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { listOrdersCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const orders = await listOrdersCore(auth);
          return jsonResponse(200, { data: orders });
        } catch (err) {
          return apiError(err);
        }
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse, ApiError } = await import(
          "@/lib/api-auth.server"
        );
        const { createOrderCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({ quantity: z.number().int().min(1).max(50) })
            .safeParse(body);
          if (!parsed.success) {
            throw new ApiError(400, "invalid_input", parsed.error.message);
          }
          const result = await createOrderCore(auth, { quantity: parsed.data.quantity });
          return jsonResponse(201, {
            data: { id: result.orderId, checkout_url: result.url },
          });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
