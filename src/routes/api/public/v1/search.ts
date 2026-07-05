import { createFileRoute } from "@tanstack/react-router";

// search.search
export const Route = createFileRoute("/api/public/v1/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateApiRequest } = await import("@/lib/api-auth.server");
        const { ok, getOrMintRequestId, toErrorResponse, SpecError } = await import(
          "@/lib/api/envelope"
        );
        const { search } = await import("@/lib/search.core");
        const rid = getOrMintRequestId(request);
        try {
          const auth = await authenticateApiRequest(request);
          const url = new URL(request.url);
          const q = url.searchParams.get("q");
          if (!q) throw new SpecError("invalid_input", "q required", { q: "required" });
          const types = url.searchParams.get("types")?.split(",").filter(Boolean);
          const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 100);
          const hits = await search(auth, { q, types, limit });
          return ok(rid, hits);
        } catch (e) {
          return toErrorResponse(rid, e);
        }
      },
    },
  },
});
