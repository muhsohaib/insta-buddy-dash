import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/me — spec operationId: meta.me
// Returns the caller's Member + Workspace + granted scopes.
export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const now = new Date().toISOString();
          // Member and Workspace are Clerk-managed today; project minimal shape
          // matching spec ResourceBase + Member/Workspace envelopes.
          // Full Clerk-org name/plan hydration lands in 7b.5.
          return ok(rid, {
            member: {
              id: auth.userId ?? `apikey:${auth.orgId}`,
              object: "member",
              role: auth.actor === "machine" ? "api_key" : "member",
              created_at: now,
              updated_at: now,
            },
            workspace: {
              id: auth.orgId,
              object: "workspace",
              name: auth.orgId,
              created_at: now,
              updated_at: now,
            },
            scopes: ["*"], // scope enforcement lands in 7c
          });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
