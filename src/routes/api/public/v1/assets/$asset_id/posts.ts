import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/assets/{asset_id}/posts   assets.list_posts
// Filters publications by real `publication_media.asset_id` FK (Phase 7d+),
// with legacy `asset://` placeholder fallback for pre-7d rows.
export const Route = createFileRoute("/api/public/v1/assets/$asset_id/posts")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, okList, toErrorResponse } = await import(
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
          const { rows, nextCursor, hasMore } = await listPostsCore(auth.supabase, {
            orgId: auth.orgId,
            limit,
            cursor,
            filters: { asset_id: params.asset_id },
          });
          return okList(rid, rows.map((r) => toPostView(r)), {
            has_more: hasMore,
            next_cursor: nextCursor,
          });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
