// Client-side function middleware that attaches the Clerk session token
// to every server-function RPC as `Authorization: Bearer <token>`.
//
// Registered globally in src/start.ts. On the server (SSR) it's a no-op —
// the browser sends the request that already carries the header.
import { createMiddleware } from "@tanstack/react-start";

type ClerkWindow = Window & {
  Clerk?: {
    session?: { getToken: () => Promise<string | null> };
  };
};

export const attachClerkAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();
    const clerk = (window as ClerkWindow).Clerk;
    const token = clerk?.session ? await clerk.session.getToken() : null;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
