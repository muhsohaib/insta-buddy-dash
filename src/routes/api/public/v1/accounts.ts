import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/accounts — list Instagram accounts in the workspace
export const Route = createFileRoute("/api/public/v1/accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { listAccountsCore } = await import("@/lib/discovery.core");
        try {
          const auth = await authenticateApiRequest(request);
          const data = await listAccountsCore({ supabase: auth.supabase, orgId: auth.orgId });
          return jsonResponse(200, { data });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});
