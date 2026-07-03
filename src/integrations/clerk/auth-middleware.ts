// Server-side auth middleware for TanStack server functions.
// Verifies the Clerk session JWT sent as `Authorization: Bearer <token>` and
// exposes:
//   - context.userId: the Clerk user id (string, e.g. `user_2abc…`)
//   - context.orgId:  the active Clerk organization id, when present
//   - context.orgRole: the caller's role in the active org (`org:admin` | `org:member`)
//   - context.supabase: the Supabase service-role client (bypasses RLS).
//
// Two middlewares are exported:
//   - `requireClerkAuth`: signed-in Clerk user (no org required).
//   - `requireClerkOrg`:  signed-in AND has an active organization; use this
//                         for every org-scoped resource query.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClerkClient, verifyToken } from "@clerk/backend";

type ClerkClaims = {
  sub: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
} & Record<string, unknown>;

async function verifyClerk() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not configured.");

  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing bearer token");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized: empty bearer token");

  let claims: ClerkClaims;
  try {
    claims = (await verifyToken(token, { secretKey })) as ClerkClaims;
  } catch {
    throw new Error("Unauthorized: invalid token");
  }
  if (!claims.sub) throw new Error("Unauthorized: no subject");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const clerk = createClerkClient({ secretKey });

  return {
    supabase: supabaseAdmin,
    userId: claims.sub,
    orgId: claims.org_id ?? null,
    orgRole: claims.org_role ?? null,
    claims,
    clerk,
  };
}

export const requireClerkAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => next({ context: await verifyClerk() }),
);

export const requireClerkOrg = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const ctx = await verifyClerk();
    if (!ctx.orgId) {
      throw new Error("No active organization. Create or select a workspace first.");
    }
    return next({
      context: { ...ctx, orgId: ctx.orgId as string },
    });
  },
);
