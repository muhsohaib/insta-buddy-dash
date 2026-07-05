import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/workspace — spec operationId: workspace.get
// PATCH /api/public/v1/workspace — spec operationId: workspace.update  (7b.5)
export const Route = createFileRoute("/api/public/v1/workspace")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, err, getOrMintRequestId, toErrorResponse } = await import(
          "@/lib/api/envelope"
        );
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const now = new Date().toISOString();
          void err; // silence unused
          return ok(rid, {
            id: auth.orgId,
            object: "workspace",
            name: auth.orgId,
            created_at: now,
            updated_at: now,
          });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      PATCH: async ({ request }) => {
        const { err, getOrMintRequestId } = await import("@/lib/api/envelope");
        const rid = getOrMintRequestId(request);
        // Deferred to 7b.5 alongside members/branding.
        return err(rid, "service_unavailable", "workspace.update lands in 7b.5");
      },
    },
  },
});
