import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// webhooks.get + webhooks.update + webhooks.delete
export const Route = createFileRoute("/api/public/v1/workspace/webhooks/$webhook_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getWebhook } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getWebhook(auth, params.webhook_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      PATCH: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { updateWebhook } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              url: z.string().url().startsWith("https://").optional(),
              description: z.string().max(500).optional(),
              events: z.array(z.string()).min(1).optional(),
              status: z.enum(["active", "paused", "disabled"]).optional(),
            })
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          return ok(rid, await updateWebhook(auth, params.webhook_id, parsed.data));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { deleteWebhook } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          await deleteWebhook(auth, params.webhook_id);
          return ok(rid, { id: params.webhook_id, deleted: true });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
