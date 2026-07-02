// Streams the original Bunny Stream video back to the browser as an
// attachment. Bunny's CDN `/original` path returns an HTML 404 page unless
// "Allow direct play URL" is enabled on the library — and even then the
// browser would render the file inline instead of downloading it. Proxying
// through this route:
//   - hides the Bunny API key,
//   - picks a real MP4 URL from the library's MP4-fallback resolutions,
//   - forces `Content-Disposition: attachment` so the browser downloads.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/admin/bunny-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("video");
        const libraryId = url.searchParams.get("library");
        if (!videoId || !libraryId) return new Response("Missing params", { status: 400 });

        // ---- Auth: verify Supabase bearer + admin role ----
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice("Bearer ".length);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return new Response("Server not configured", { status: 500 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: claimsData.claims.sub,
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

        // Try candidate URLs in order: original first, then MP4-fallback resolutions high→low.
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
          // Bunny's 404 page returns HTML; skip anything that isn't a real binary.
          if (r.ok && !ct.startsWith("text/")) {
            upstream = r;
            break;
          }
          // Drain body so the socket can be reused.
          try { await r.arrayBuffer(); } catch {}
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
