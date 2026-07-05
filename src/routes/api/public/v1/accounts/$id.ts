import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET    /api/public/v1/accounts/{account_id}   accounts.get
// PATCH  /api/public/v1/accounts/{account_id}   accounts.update
// DELETE /api/public/v1/accounts/{account_id}   accounts.delete
// Filename uses $id; the URL param IS the account_id in the spec.
export const Route = createFileRoute("/api/public/v1/accounts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse } = await import("@/lib/api/envelope");
        const { getAccountRowCore, toSocialAccountView } = await import("@/lib/accounts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const row = await getAccountRowCore(auth.supabase, auth.orgId, params.id);
          return ok(rid, toSocialAccountView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      PATCH: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { updateAccountCore, toSocialAccountView } = await import("@/lib/accounts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              handle: z.string().min(1).optional(),
              display_name: z.string().optional(),
              tags: z.array(z.string()).optional(),
            })
            .strict()
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const row = await updateAccountCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.id,
            parsed.data,
          );
          return ok(rid, toSocialAccountView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      DELETE: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { deleteAccountCore } = await import("@/lib/accounts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          await deleteAccountCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.id,
          );
          return new Response(null, { status: 204, headers: { "x-request-id": rid } });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
