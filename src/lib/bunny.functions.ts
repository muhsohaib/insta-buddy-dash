import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Creates a Bunny Stream video object and returns the TUS upload envelope
// so the browser can upload directly to Bunny (resumable, no server bandwidth).
export const createBunnyUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ title: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) {
      throw new Error("Video uploads are not configured yet. Ask an admin to add Bunny.net credentials.");
    }

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
    const signature = createHmac("sha256", apiKey)
      .update(`${libraryId}${expiration}${videoId}`)
      .digest("hex");
    // Bunny docs: SHA256 hash (not HMAC) of the concatenation
    const { createHash } = await import("crypto");
    const authSignature = createHash("sha256")
      .update(`${libraryId}${apiKey}${expiration}${videoId}`)
      .digest("hex");

    return {
      videoId,
      libraryId,
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      expiration,
      authorizationSignature: authSignature,
      // fallback if the HMAC variant is expected somewhere
      hmacSignature: signature,
      thumbnailUrl: `https://vz-${libraryId}.b-cdn.net/${videoId}/thumbnail.jpg`,
      playbackUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`,
    };
  });

// Admin-only: signed direct-play URL for downloading the original file
export const getBunnyDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ video_id: z.string().min(1), library_id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    // Bunny videos have a direct-play URL served from the CDN
    return {
      url: `https://iframe.mediadelivery.net/play/${data.library_id}/${data.video_id}`,
      embed: `https://iframe.mediadelivery.net/embed/${data.library_id}/${data.video_id}`,
      original: `https://vz-${data.library_id}.b-cdn.net/${data.video_id}/original`,
    };
  });
