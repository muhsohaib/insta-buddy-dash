import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/activity/{activity_id} — spec operationId: activity.get
export const Route = createFileRoute("/api/public/v1/activity/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { getActivityCore, toActivityView } = await import("@/lib/activity.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const row = await getActivityCore(auth.supabase, auth.orgId, params.id);
          if (!row) throw new SpecError("not_found", "Activity not found");
          return ok(rid, toActivityView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
