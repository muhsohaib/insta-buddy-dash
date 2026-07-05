import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/workspace/notifications — spec operationId: notifications.list
export const Route = createFileRoute("/api/public/v1/workspace/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, okList, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { parseLimit, parseCursor, paginate } = await import("@/lib/api/pagination");
        const { listNotificationsCore, toNotificationView } = await import(
          "@/lib/notifications.core"
        );
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) {
            // API-key callers have no per-user inbox.
            throw new SpecError(
              "forbidden",
              "Notifications are per-user; API keys cannot list them",
            );
          }
          const url = new URL(request.url);
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = parseCursor(url.searchParams.get("cursor"));
          const unread = url.searchParams.get("unread") === "true";

          const rows = await listNotificationsCore(auth.supabase, {
            orgId: auth.orgId,
            userId: auth.userId,
            limit,
            cursor,
            unread,
          });
          const { data, page } = paginate(rows, limit, (r) => r.created_at);
          return okList(rid, data.map(toNotificationView), page);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
