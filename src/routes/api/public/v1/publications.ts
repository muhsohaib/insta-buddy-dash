import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET  /api/public/v1/publications      list workspace publications
// POST /api/public/v1/publications      create a new publication
export const Route = createFileRoute("/api/public/v1/publications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { listPublicationsInRangeCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const status = url.searchParams.get("status") ?? undefined;
          const from = url.searchParams.get("from") ?? undefined;
          const to = url.searchParams.get("to") ?? undefined;
          const account_id = url.searchParams.get("account_id") ?? undefined;
          const data = await listPublicationsInRangeCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            {
              from,
              to,
              account_id: account_id ?? undefined,
              status: (status as never) ?? undefined,
            },
          );
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse, ApiError } = await import(
          "@/lib/api-auth.server"
        );
        const { createPublicationCore } = await import("@/lib/publications.core");
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const schema = z.object({
            account_id: z.string().uuid(),
            type: z.enum(["reel", "image", "carousel", "video"]).optional(),
            caption: z.string().max(2200).optional(),
            hashtags: z.array(z.string()).optional(),
            scheduled_at: z.string(),
            notes: z.string().optional(),
            status: z.enum(["draft", "scheduled"]).optional(),
            media: z
              .array(
                z.object({
                  kind: z.enum(["video", "image"]),
                  bunny_video_id: z.string().nullable().optional(),
                  bunny_library_id: z.string().nullable().optional(),
                  thumbnail_url: z.string().nullable().optional(),
                  image_url: z.string().nullable().optional(),
                }),
              )
              .min(1),
          });
          const parsed = schema.safeParse(body);
          if (!parsed.success) {
            throw new ApiError(400, "invalid_input", parsed.error.message);
          }
          const pub = await createPublicationCore(
            { ...auth, actor: auth.actor === "machine" ? "api_key" : "user", source: "api" },
            parsed.data,
          );
          return jsonResponse(201, { data: pub });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
