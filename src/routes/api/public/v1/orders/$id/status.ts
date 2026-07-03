import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/orders/{id}/status  — light payload for polling agents
export const Route = createFileRoute("/api/public/v1/orders/$id/status")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { getOrderStatusCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const status = await getOrderStatusCore(auth, params.id);
          return jsonResponse(200, { data: status });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
