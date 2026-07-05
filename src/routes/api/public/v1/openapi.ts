import { createFileRoute } from "@tanstack/react-router";
import specJson from "../../../../../docs/openapi.json" with { type: "json" };

// meta.openapi — serves the frozen spec from Phase 6 with servers[0].url
// rewritten to the request origin. This is the only spec source of truth.
export const Route = createFileRoute("/api/public/v1/openapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const spec = JSON.parse(JSON.stringify(specJson)) as {
          servers?: Array<{ url: string; description?: string }>;
        };
        spec.servers = [{ url: `${origin}/api/public/v1`, description: "Live" }];
        return new Response(JSON.stringify(spec), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
