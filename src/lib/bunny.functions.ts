import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireClerkAuth } from "@/integrations/clerk/auth-middleware";

// Resolve the Bunny Stream CDN hostname from env. Never derive from the
// Library ID — Bunny assigns a unique CDN hostname per library
// (e.g. "vz-e696c0e8-e0a.b-cdn.net"), and it must be configured explicitly.
function getCdnHostname(): string {
  const raw = process.env.BUNNY_STREAM_HOSTNAME;
  if (!raw) {
    throw new Error(
      "BUNNY_STREAM_HOSTNAME is not configured. Copy the CDN Hostname from Bunny Stream → Library → API and save it as a secret.",
    );
  }
  // Strip any accidental scheme / trailing slash
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

// Creates a Bunny Stream video object and returns the TUS upload envelope
// so the browser can upload directly to Bunny (resumable, no server bandwidth).
export const createBunnyUpload = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input) => z.object({ title: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) {
      throw new Error("Video uploads are not configured yet. Ask an admin to add Bunny.net credentials.");
    }
    const hostname = getCdnHostname();

    // 1. Create the video object
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: "POST",
      headers: { AccessKey: apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ title: data.title }),
    });
    if (!createRes.ok) throw new Error(`Bunny create failed: ${createRes.status} ${await createRes.text()}`);
    const created = (await createRes.json()) as { guid: string };
    const videoId = created.guid;

    // 2. TUS auth: SHA256(libraryId + apiKey + expiration + videoId)
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 6h
    const authSignature = createHash("sha256")
      .update(`${libraryId}${apiKey}${expiration}${videoId}`)
      .digest("hex");

    return {
      videoId,
      libraryId,
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      expiration,
      authorizationSignature: authSignature,
      thumbnailUrl: `https://${hostname}/${videoId}/thumbnail.jpg`,
      playbackUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`,
    };
  });

// Admin-only: returns URLs for downloading / previewing the original video.
// Also reports the current processing status so the UI can wait for encoding
// to finish before opening the CDN URL.
export const getBunnyDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input) =>
    z.object({ video_id: z.string().min(1), library_id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const hostname = getCdnHostname();
    const apiKey = process.env.BUNNY_STREAM_API_KEY;

    // Query Bunny for the current processing status (0..4 = queued/processing,
    // 5 = finished). Bunny returns 4xx for missing videos.
    let status: number | null = null;
    let ready = false;
    if (apiKey) {
      const infoRes = await fetch(
        `https://video.bunnycdn.com/library/${data.library_id}/videos/${data.video_id}`,
        { headers: { AccessKey: apiKey, accept: "application/json" } },
      );
      if (infoRes.ok) {
        const info = (await infoRes.json()) as { status?: number };
        status = typeof info.status === "number" ? info.status : null;
        ready = status !== null && status >= 4;
      }
    }

    return {
      ready,
      status,
      embed: `https://iframe.mediadelivery.net/embed/${data.library_id}/${data.video_id}`,
      play: `https://iframe.mediadelivery.net/play/${data.library_id}/${data.video_id}`,
      // Original file served from the library's dedicated CDN hostname.
      // Requires "Direct Play URL" (or a fallback MP4) enabled on the library.
      original: `https://${hostname}/${data.video_id}/original`,
      thumbnail: `https://${hostname}/${data.video_id}/thumbnail.jpg`,
    };
  });
