// Streams the original Bunny Stream video back to the browser as an
// attachment. Verifies the caller is an admin via the Clerk session token.
import { createFileRoute } from "@tanstack/react-router";
import { verifyToken } from "@clerk/backend";

export const Route = createFileRoute("/api/public/admin/bunny-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("video");
        const libraryId = url.searchParams.get("library");
        if (!videoId || !libraryId) return new Response("Missing params", { status: 400 });

        // ---- Auth: verify Clerk bearer + admin role ----
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice("Bearer ".length);

        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey) return new Response("Server not configured", { status: 500 });

        let userId: string;
        try {
          const claims = await verifyToken(token, { secretKey });
          if (!claims.sub) return new Response("Unauthorized", { status: 401 });
          userId = claims.sub;
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (!isAdmin) return new Response("Forbidden", { status: 403 });

        // ---- Fetch Bunny video info to pick a real MP4 source ----
        const apiKey = process.env.BUNNY_STREAM_API_KEY;
        const hostname = (process.env.BUNNY_STREAM_HOSTNAME ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
        if (!apiKey || !hostname) return new Response("Bunny not configured", { status: 500 });

        const infoRes = await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
          { headers: { AccessKey: apiKey, accept: "application/json" } },
        );
        if (!infoRes.ok) return new Response(`Bunny lookup failed: ${infoRes.status}`, { status: 502 });
        const info = (await infoRes.json()) as {
          status?: number;
          title?: string;
          availableResolutions?: string;
          hasMP4Fallback?: boolean;
        };
        if ((info.status ?? 0) < 4) return new Response("Video is still processing on Bunny Stream.", { status: 409 });

        const resolutions = (info.availableResolutions ?? "")
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
          .sort((a, b) => parseInt(b) - parseInt(a));

        const candidates = [
          `https://${hostname}/${videoId}/original`,
          ...resolutions.map((r) => `https://${hostname}/${videoId}/play_${r}.mp4`),
        ];

        let upstream: Response | null = null;
        for (const candidate of candidates) {
          const r = await fetch(candidate, { redirect: "follow" });
          const ct = r.headers.get("content-type") ?? "";
          if (r.ok && !ct.startsWith("text/")) {
            upstream = r;
            break;
          }
          try { await r.arrayBuffer(); } catch { /* drain */ }
        }
        if (!upstream || !upstream.body) {
          return new Response(
            "No downloadable file found. Enable MP4 fallback (or Allow Direct Play URL) on the Bunny Stream library.",
            { status: 502 },
          );
        }

        const safeTitle = (info.title ?? videoId).replace(/[^\w.-]+/g, "_").slice(0, 80);
        const headers = new Headers();
        headers.set("content-type", upstream.headers.get("content-type") ?? "video/mp4");
        const len = upstream.headers.get("content-length");
        if (len) headers.set("content-length", len);
        headers.set("content-disposition", `attachment; filename="${safeTitle}.mp4"`);
        headers.set("cache-control", "private, no-store");

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
