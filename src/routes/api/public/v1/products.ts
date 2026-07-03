import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET /api/public/v1/products  — list active products
export const Route = createFileRoute("/api/public/v1/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest, apiError, jsonResponse } = await import(
          "@/lib/api-auth.server"
        );
        const { listProductsCore } = await import("@/lib/orders.core");
        try {
          const auth = await authenticateApiRequest(request);
          const products = await listProductsCore({ supabase: auth.supabase });
          return jsonResponse(200, { data: products });
        } catch (err) {
          return apiError(err);
        }
      },
    },
  },
});

// keep zod import used (avoid unused warning in strict builds)
void z;
