// Thin createServerFn wrappers that the website calls. Every handler
// delegates to publications.core so the same logic backs the REST API.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkAuth, requireClerkOrg } from "@/integrations/clerk/auth-middleware";
import {
  adminListPublicationsCore,
  adminTransitionPublicationCore,
  createPublicationCore,
  deletePublicationCore,
  getPublicationCore,
  listPublicationsInRangeCore,
  markPublishedCore,
  updatePublicationCore,
  type PublicationStatus,
} from "./publications.core";
import { adminAssert } from "./orders.core";

const mediaSchema = z.object({
  kind: z.enum(["video", "image"]),
  bunny_video_id: z.string().nullable().optional(),
  bunny_library_id: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

const createSchema = z.object({
  account_id: z.string().uuid(),
  type: z.enum(["reel", "image", "carousel", "video"]).optional(),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).optional(),
  scheduled_at: z.string(),
  notes: z.string().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  media: z.array(mediaSchema).min(1),
  status: z.enum(["draft", "scheduled"]).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      caption: z.string().max(2200).optional(),
      hashtags: z.array(z.string()).optional(),
      scheduled_at: z.string().optional(),
      notes: z.string().optional(),
      campaign_id: z.string().uuid().nullable().optional(),
      assigned_to: z.string().nullable().optional(),
      status: z
        .enum(["draft", "scheduled", "ready_for_publishing", "publishing", "published", "failed"])
        .optional(),
      instagram_post_url: z.string().nullable().optional(),
      failure_reason: z.string().nullable().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "empty patch"),
});

function ctxOf(context: { supabase: unknown; orgId: string; userId: string }) {
  return {
    supabase: context.supabase as never,
    orgId: context.orgId,
    userId: context.userId,
    actor: "user" as const,
    source: "web",
  };
}

export const listPublicationsInRange = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .inputValidator((i) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        account_id: z.string().uuid().optional(),
        status: z
          .enum(["draft", "scheduled", "ready_for_publishing", "publishing", "published", "failed"])
          .optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => listPublicationsInRangeCore(ctxOf(context), data));

export const getPublication = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => getPublicationCore(ctxOf(context), data.id));

export const createPublication = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ context, data }) => createPublicationCore(ctxOf(context), data));

export const updatePublication = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ context, data }) =>
    updatePublicationCore(ctxOf(context), data.id, data.patch),
  );

export const deletePublication = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => deletePublicationCore(ctxOf(context), data.id));

// -------- Admin --------

export const adminListPublications = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z
      .object({
        status: z
          .enum([
            "today",
            "draft",
            "scheduled",
            "ready_for_publishing",
            "publishing",
            "published",
            "failed",
          ])
          .optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    await adminAssert(context);
    return adminListPublicationsCore(context.supabase, data);
  });

export const adminTransitionPublication = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "draft",
          "scheduled",
          "ready_for_publishing",
          "publishing",
          "published",
          "failed",
        ]),
        instagram_post_url: z.string().nullable().optional(),
        failure_reason: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await adminAssert(context);
    const { id, status, ...extras } = data;
    return adminTransitionPublicationCore(
      context.supabase,
      id,
      status as PublicationStatus,
      extras,
    );
  });

export const adminMarkPublished = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        instagram_post_url: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await adminAssert(context);
    const ctx = {
      supabase: context.supabase as never,
      orgId: "*", // admin skip
      userId: context.userId,
      actor: "user" as const,
    };
    // Skip org check by using core update via admin transition
    return adminTransitionPublicationCore(context.supabase, data.id, "published", {
      instagram_post_url: data.instagram_post_url ?? null,
    });
    void ctx;
    void markPublishedCore;
  });
