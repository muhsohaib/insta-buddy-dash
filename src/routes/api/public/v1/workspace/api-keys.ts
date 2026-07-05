import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// api_keys.list + api_keys.create
export const Route = createFileRoute("/api/public/v1/workspace/api-keys")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listApiKeys } = await import("@/lib/api-keys.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const { data, page } = await listApiKeys(auth, {
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
        const { withIdempotency } = await import("@/lib/api/idempotency.server");
        const { createApiKey } = await import("@/lib/api-keys.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return await withIdempotency(
            { request, workspaceId: auth.orgId, requestId: rid, method: "POST", path: "/workspace/api-keys" },
            async () => {
              try {
                const body = (await request.json().catch(() => ({}))) as unknown;
                const parsed = z
                  .object({
                    label: z.string().min(1).max(120),
                    scopes: z.array(z.string()).optional(),
                    expires_at: z.string().datetime().nullable().optional(),
                  })
                  .safeParse(body);
                if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
                return ok(rid, await createApiKey(auth, parsed.data), { status: 201 });
              } catch (e) {
                return toErrorResponse(rid, e);
              }
            },
          );
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
