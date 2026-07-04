import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/accounts/{id}
export const Route = createFileRoute("/api/public/v1/accounts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse, ApiError } = await import(
          "@/lib/api-auth.server"
        );
        const { getAccountCore } = await import("@/lib/discovery.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await getAccountCore(
            { supabase: auth.supabase, orgId: auth.orgId },
            params.id,
          );
          if (!data) throw new ApiError(404, "not_found", "Account not found");
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
