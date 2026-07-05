import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// GET  /api/public/v1/accounts   accounts.list
// POST /api/public/v1/accounts   accounts.create
export const Route = createFileRoute("/api/public/v1/accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, okList, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { parseLimit, parseCursor } = await import("@/lib/api/pagination");
        const { listAccountsCore, toSocialAccountView } = await import("@/lib/accounts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const limit = parseLimit(url.searchParams.get("limit"));
          const cursor = parseCursor(url.searchParams.get("cursor"));
          const status = url.searchParams.get("status");
          if (
            status &&
            !["connecting", "active", "needs_attention", "retired"].includes(status)
          ) {
            throw new SpecError("invalid_filter", "Unknown status filter", {
              status: "unknown value",
            });
          }
          const { rows, nextCursor, hasMore } = await listAccountsCore(auth.supabase, {
            orgId: auth.orgId,
            limit,
            cursor,
            filters: {
              status: status ?? undefined,
              platform: url.searchParams.get("platform") ?? undefined,
              q: url.searchParams.get("q") ?? undefined,
              tag: url.searchParams.get("tag") ?? undefined,
              created_after: url.searchParams.get("created_after") ?? undefined,
              created_before: url.searchParams.get("created_before") ?? undefined,
              updated_after: url.searchParams.get("updated_after") ?? undefined,
            },
          });
          return okList(rid, rows.map((r) => toSocialAccountView(r)), {
            has_more: hasMore,
            next_cursor: nextCursor,
          });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
      POST: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { getOrMintRequestId, ok, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { createAccountCore, toSocialAccountView } = await import("@/lib/accounts.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          if (!auth.userId) throw new SpecError("unauthenticated", "Missing user context");
          const body = (await request.json().catch(() => ({}))) as unknown;
          const parsed = z
            .object({
              platform: z.string(),
              handle: z.string().min(1),
              credentials_ref: z.string().min(1),
              tags: z.array(z.string()).optional(),
            })
            .strict()
            .safeParse(body);
          if (!parsed.success) throw new SpecError("invalid_input", parsed.error.message);
          const row = await createAccountCore(
            {
              supabase: auth.supabase,
              orgId: auth.orgId,
              userId: auth.userId,
              via: auth.actor === "machine" ? "api" : "web",
            },
            parsed.data,
          );
          return ok(rid, toSocialAccountView(row), { status: 201 });
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
