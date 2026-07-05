import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// orders.list + orders.create
export const Route = createFileRoute("/api/public/v1/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listOrdersSpec } = await import("@/lib/orders.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const { data, page } = await listOrdersSpec(auth, {
            limit: parseLimit(url.searchParams.get("limit")),
            cursor: parseCursor(url.searchParams.get("cursor")),
            status: url.searchParams.get("status"),
          });
          return okList(rid, data, page);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { createOrderCore } = await import("@/lib/orders.core");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { withIdempotency } = await import("@/lib/api/idempotency.server");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return await withIdempotency(
            { request, workspaceId: auth.orgId, requestId: rid, method: "POST", path: "/orders" },
            async () => {
              try {
                const body = (await request.json().catch(() => ({}))) as unknown;
                const parsed = z
                  .object({ quantity: z.number().int().min(1).max(50) })
                  .safeParse(body);
                if (!parsed.success) {
                  throw new SpecError("invalid_input", parsed.error.message);
                }
                const result = await createOrderCore(auth, { quantity: parsed.data.quantity });
                return ok(rid, { id: result.orderId, checkout_url: result.url }, { status: 201 });
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
