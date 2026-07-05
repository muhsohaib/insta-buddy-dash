import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET    /api/public/v1/posts/{post_id}   posts.get
// PATCH  /api/public/v1/posts/{post_id}   posts.update
// DELETE /api/public/v1/posts/{post_id}   posts.delete
export const Route = createFileRoute("/api/public/v1/posts/$post_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse } = await import("@/lib/api/envelope");
        const { getPostRowCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const row = await getPostRowCore(auth.supabase, auth.orgId, params.post_id);
          return ok(rid, toPostView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      PATCH: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { updatePostCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const body = (await request.json().catch(() => ({}))) as unknown;
          const schema = z
            .object({
              caption: z.string().max(2200).optional(),
              first_comment: z.string().max(2200).optional(),
              tags: z.array(z.string()).optional(),
              campaign: z.string().optional(),
              asset_ids: z.array(z.string().min(1)).min(1).optional(),
            })
            .strict();
          const parsed = schema.safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const row = await updatePostCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.post_id,
            parsed.data,
          );
          return ok(rid, toPostView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { deletePostCore } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          await deletePostCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.post_id,
          );
          return new Response(null, { status: 204, headers: { "x-request-id": rid } });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
