import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// assets.get / assets.update / assets.delete
export const Route = createFileRoute("/api/public/v1/assets/$asset_id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { getAsset } = await import("@/lib/assets.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return ok(rid, await getAsset(auth, params.asset_id));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      PATCH: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { updateAsset } = await import("@/lib/assets.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              filename: z.string().min(1).optional(),
              tags: z.array(z.string()).optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            })
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          return ok(rid, await updateAsset(auth, params.asset_id, parsed.data));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { deleteAsset } = await import("@/lib/assets.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          await deleteAsset(auth, params.asset_id);
          return ok(rid, { id: params.asset_id, deleted: true });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
