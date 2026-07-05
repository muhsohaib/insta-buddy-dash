import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/workspace/notifications/{notification_id}/read
// spec operationId: notifications.read
export const Route = createFileRoute("/api/public/v1/workspace/notifications/$id/read")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { markNotificationReadCore, toNotificationView } = await import(
          "@/lib/notifications.core"
        );
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) {
            throw new SpecError("forbidden", "API keys cannot mark notifications read");
          }
          const row = await markNotificationReadCore(
            auth.supabase,
            auth.orgId,
            auth.userId,
            params.id,
          );
          return ok(rid, toNotificationView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
