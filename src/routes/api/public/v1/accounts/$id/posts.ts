import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/accounts/{account_id}/posts   accounts.list_posts
// The path param is exposed as `id` in this route (file lives under
// accounts/$id/) but represents the account_id from the spec.
export const Route = createFileRoute("/api/public/v1/accounts/$id/posts")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
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
            throw new SpecError("invalid_filter", "Unknown status filter");
          }
          const { rows, nextCursor, hasMore } = await listPostsCore(auth.supabase, {
            orgId: auth.orgId,
            limit,
            cursor,
            filters: { account_id: params.id, status: status ?? undefined },
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
