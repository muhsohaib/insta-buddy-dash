import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET    /api/public/v1/publications/:id
// PATCH  /api/public/v1/publications/:id
// DELETE /api/public/v1/publications/:id
export const Route = createFileRoute("/api/public/v1/publications/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { getPublicationCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await getPublicationCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            params.id,
          );
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
      PATCH: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse, ApiError } = await import(
          "@/lib/api-auth.server"
        );
        const { updatePublicationCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              caption: z.string().max(2200).optional(),
              hashtags: z.array(z.string()).optional(),
              scheduled_at: z.string().optional(),
              notes: z.string().optional(),
              assigned_to: z.string().nullable().optional(),
              status: z
                .enum([
                  "draft",
                  "scheduled",
                  "ready_for_publishing",
                  "publishing",
                  "published",
                  "failed",
                ])
                .optional(),
              instagram_post_url: z.string().nullable().optional(),
              failure_reason: z.string().nullable().optional(),
            })
            .safeParse(body);
          if (!parsed.success) {
            throw new ApiError(400, "invalid_input", parsed.error.message);
          }
          const data = await updatePublicationCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            params.id,
            parsed.data,
          );
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { deletePublicationCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          await deletePublicationCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            params.id,
          );
          return jsonResponse(200, { data: { ok: true } });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
