import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/media — list workspace media assets
export const Route = createFileRoute("/api/public/v1/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { listMediaCore } = await import("@/lib/discovery.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await listMediaCore({ supabase: auth.supabase, orgId: auth.orgId });
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
