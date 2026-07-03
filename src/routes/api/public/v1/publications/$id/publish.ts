import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/public/v1/publications/:id/publish
// Shortcut for agents/humans to mark a publication as published.
export const Route = createFileRoute("/api/public/v1/publications/$id/publish")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { markPublishedCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({ instagram_post_url: z.string().nullable().optional() })
            .safeParse(body ?? {});
          const data = await markPublishedCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            params.id,
            { instagram_post_url: parsed.success ? parsed.data.instagram_post_url ?? null : null },
          );
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
