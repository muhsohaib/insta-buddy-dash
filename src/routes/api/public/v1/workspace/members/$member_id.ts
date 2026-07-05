import { createFileRoute } from "@tanstack/react-router";

// members.get + members.update + members.delete
export const Route = createFileRoute("/api/public/v1/workspace/members/$member_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getMember } = await import("@/lib/members.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getMember(auth, params.member_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      PATCH: async ({ request }) => {
        const { err, getOrMintRequestId } = await import("@/lib/api/envelope");
        return err(
          getOrMintRequestId(request),
          "service_unavailable",
          "members.update requires Clerk admin API wiring — lands in 7c",
        );
      },
      DELETE: async ({ request }) => {
        const { err, getOrMintRequestId } = await import("@/lib/api/envelope");
        return err(
          getOrMintRequestId(request),
          "service_unavailable",
          "members.delete requires Clerk admin API wiring — lands in 7c",
        );
      },
    },
  },
});
