import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// assets.list + assets.create
export const Route = createFileRoute("/api/public/v1/assets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { okList, getOrMintRequestId, toErrorResponse } = await import("@/lib/api/envelope");
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listAssets } = await import("@/lib/assets.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const { data, page } = await listAssets(auth, {
            limit: parseLimit(url.searchParams.get("limit")),
            cursor: parseCursor(url.searchParams.get("cursor")),
            kind: url.searchParams.get("kind"),
            status: url.searchParams.get("status"),
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
        const { createAsset } = await import("@/lib/assets.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          return await withIdempotency(
            { request, workspaceId: auth.orgId, requestId: rid, method: "POST", path: "/assets" },
            async () => {
              try {
                const body = (await request.json().catch(() => ({}))) as unknown;
                const parsed = z
                  .object({
                    kind: z.enum(["image", "video", "document", "archive", "other"]),
                    mime: z.string().min(1),
                    filename: z.string().min(1),
                    bytes: z.number().int().nonnegative().optional(),
                    tags: z.array(z.string()).optional(),
                    metadata: z.record(z.string(), z.unknown()).optional(),
                  })
                  .safeParse(body);
                if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
                return ok(rid, await createAsset(auth, parsed.data), { status: 201 });
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
