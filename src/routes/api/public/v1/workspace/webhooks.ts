import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// webhooks.list + webhooks.create
export const Route = createFileRoute("/api/public/v1/workspace/webhooks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listWebhooks } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const { data, page } = await listWebhooks(auth, {
            limit: parseLimit(url.searchParams.get("limit")),
            cursor: parseCursor(url.searchParams.get("cursor")),
          });
          return okList(rid, data, page);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { createWebhook } = await import("@/lib/webhooks.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              url: z.string().url().startsWith("https://"),
              description: z.string().max(500).optional(),
              events: z.array(z.string()).min(1),
            })
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          return ok(rid, await createWebhook(auth, parsed.data), { status: 201 });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
