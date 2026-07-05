import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/v1/workspace/notifications:read-all
// spec operationId: notifications.read_all — bulk colon operation per REST arch §6.
export const Route = createFileRoute("/api/public/v1/workspace/notifications:read-all")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { markAllNotificationsReadCore } = await import("@/lib/notifications.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) {
            throw new SpecError("forbidden", "API keys cannot mark notifications read");
          }
          const updated = await markAllNotificationsReadCore(
            auth.supabase,
            auth.orgId,
            auth.userId,
          );
          return ok(rid, { updated });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
