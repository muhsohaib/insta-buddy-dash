import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET  /api/public/v1/posts        posts.list
// POST /api/public/v1/posts        posts.create
export const Route = createFileRoute("/api/public/v1/posts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, okList, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listPostsCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = parseCursor(url.searchParams.get("cursor"));
          const status = url.searchParams.get("status");
          if (
            status &&
            !["draft", "scheduled", "publishing", "published", "failed", "cancelled"].includes(
              status,
            )
          ) {
            throw new SpecError("invalid_filter", "Unknown status filter", {
              status: "unknown value",
            });
          }
          const { rows, nextCursor, hasMore } = await listPostsCore(auth.supabase, {
            orgId: auth.orgId,
            limit,
            cursor,
            filters: {
              status: status ?? undefined,
              account_id: url.searchParams.get("account_id") ?? undefined,
              asset_id: url.searchParams.get("asset_id") ?? undefined,
              platform: url.searchParams.get("platform") ?? undefined,
              tag: url.searchParams.get("tag") ?? undefined,
              q: url.searchParams.get("q") ?? undefined,
              via: url.searchParams.get("via") ?? undefined,
              campaign: url.searchParams.get("campaign") ?? undefined,
              created_after: url.searchParams.get("created_after") ?? undefined,
              created_before: url.searchParams.get("created_before") ?? undefined,
              updated_after: url.searchParams.get("updated_after") ?? undefined,
              scheduled_after: url.searchParams.get("scheduled_after") ?? undefined,
              scheduled_before: url.searchParams.get("scheduled_before") ?? undefined,
            },
          });
          return okList(rid, rows.map((r) => toPostView(r)), {
            has_more: hasMore,
            next_cursor: nextCursor,
          });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { createPostCore, toPostView } = await import("@/lib/posts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const schema = z
            .object({
              account_id: z.string().min(1),
              asset_ids: z.array(z.string().min(1)).min(1),
              caption: z.string().max(2200),
              first_comment: z.string().max(2200).optional(),
              tags: z.array(z.string()).optional(),
              campaign: z.string().optional(),
              scheduled_at: z.string().datetime().optional(),
            })
            .strict();
          const parsed = schema.safeParse(body);
          if (!parsed.success) {
            throw new SpecError("invalid_input", parsed.error.message);
          }
          if (!auth.userId) {
            throw new SpecError("unauthenticated", "Missing user context");
          }
          const row = await createPostCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            parsed.data,
          );
          return ok(rid, toPostView(row), { status: 201 });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
