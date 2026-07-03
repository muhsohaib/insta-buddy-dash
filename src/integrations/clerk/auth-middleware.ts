// Server-side auth middleware for TanStack server functions.
// Verifies the Clerk session JWT sent as `Authorization: Bearer <token>` and
// exposes:
//   - context.userId: the Clerk user id (string, e.g. `user_2abc…`)
//   - context.supabase: the Supabase service-role client (bypasses RLS).
//
// All authorization is done in the server function itself (own-row filters,
// role checks). RLS on public tables is default-deny for anon/authenticated;
// service-role access is safe because only trusted server code uses it.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClerkClient, verifyToken } from "@clerk/backend";

export const requireClerkAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY is not configured.");
    }

    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: missing bearer token");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) throw new Error("Unauthorized: empty bearer token");

    let claims: { sub: string } & Record<string, unknown>;
    try {
      claims = (await verifyToken(token, { secretKey })) as typeof claims;
    } catch {
      throw new Error("Unauthorized: invalid token");
    }
    if (!claims.sub) throw new Error("Unauthorized: no subject");

    // Load Supabase admin client inside the handler so it never ships to
    // the client bundle via a transitive import.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clerk = createClerkClient({ secretKey });

    return next({
      context: {
        supabase: supabaseAdmin,
        userId: claims.sub,
        claims,
        clerk,
      },
    });
  },
);
