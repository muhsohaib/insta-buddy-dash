import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// POST /api/public/v1/accounts/{account_id}/rotate   accounts.rotate
export const Route = createFileRoute("/api/public/v1/accounts/$id/rotate")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { rotateAccountCredentialsCore, toSocialAccountView } = await import(
          "@/lib/accounts.core"
        );
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({ new_credentials_ref: z.string().min(1) })
            .strict()
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const row = await rotateAccountCredentialsCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            params.id,
            parsed.data.new_credentials_ref,
          );
          return ok(rid, toSocialAccountView(row));
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
