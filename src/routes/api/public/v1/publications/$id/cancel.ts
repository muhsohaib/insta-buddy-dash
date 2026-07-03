import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/publications/:id/cancel — cancels a draft/scheduled publication.
export const Route = createFileRoute("/api/public/v1/publications/$id/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { cancelPublicationCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await cancelPublicationCore(
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
