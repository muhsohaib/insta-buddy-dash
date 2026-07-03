import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/orders/{id}/deliverables
// Returns the delivered Instagram account credentials per item.
export const Route = createFileRoute("/api/public/v1/orders/$id/deliverables")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { getOrderDeliverablesCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const result = await getOrderDeliverablesCore(auth, params.id);
          return jsonResponse(200, { data: result });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
