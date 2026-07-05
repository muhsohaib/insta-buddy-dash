import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// deliveries.report_issue
export const Route = createFileRoute("/api/public/v1/deliveries/$delivery_id/report-issue")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { reportIssue } = await import("@/lib/deliveries.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z.object({ reason: z.string().min(1).max(1000) }).safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          return ok(rid, await reportIssue(auth, params.delivery_id, parsed.data.reason));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
