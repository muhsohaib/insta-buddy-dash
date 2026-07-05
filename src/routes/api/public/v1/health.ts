import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/health — spec operationId: meta.health
// Public, unauthenticated liveness probe.
export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { ok, getOrMintRequestId } = await import("@/lib/api/envelope");
        const rid = getOrMintRequestId(request);
        return ok(rid, { status: "ok", time: new Date().toISOString() });
      },
    },
  },
});
