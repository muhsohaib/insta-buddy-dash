import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/orders/{id}  — full order (items, details, deliverables)
export const Route = createFileRoute("/api/public/v1/orders/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { getOrderCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const order = await getOrderCore(auth, params.id);
          return jsonResponse(200, { data: order });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
