import { createFileRoute } from "@tanstack/react-router";

// members.list + members.create (invite deferred to 7c — returns 503)
export const Route = createFileRoute("/api/public/v1/workspace/members")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { listMembers } = await import("@/lib/members.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const items = await listMembers(auth);
          return okList(rid, items, { has_more: false, next_cursor: null });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      POST: async ({ request }) => {
        const { err, getOrMintRequestId } = await import("@/lib/api/envelope");
        return err(
          getOrMintRequestId(request),
          "service_unavailable",
          "members.create (invite) requires Clerk admin API wiring — lands in 7c",
        );
      },
    },
  },
});
