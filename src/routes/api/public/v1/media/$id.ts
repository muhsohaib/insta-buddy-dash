import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/media/{id}
export const Route = createFileRoute("/api/public/v1/media/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse, ApiError } = await import(
          "@/lib/api-auth.server"
        );
        const { getMediaCore } = await import("@/lib/discovery.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await getMediaCore(
            { supabase: auth.supabase, orgId: auth.orgId },
            params.id,
          );
          if (!data) throw new ApiError(404, "not_found", "Media asset not found");
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
