import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/publications/:id/status — lightweight polling endpoint.
export const Route = createFileRoute("/api/public/v1/publications/$id/status")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { getPublicationStatusCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await getPublicationStatusCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            params.id,
          );
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
