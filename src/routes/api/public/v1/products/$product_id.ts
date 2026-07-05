import { createFileRoute } from "@tanstack/react-router";

// products.get
export const Route = createFileRoute("/api/public/v1/products/$product_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getProduct } = await import("@/lib/products.spec.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getProduct(auth, params.product_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
