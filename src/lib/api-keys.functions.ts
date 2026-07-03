// Workspace API key management. Admin-only within the active Clerk Organization.
// Keys are opaque secrets — we only store a sha256 hash + display prefix.
// The raw key is returned exactly once when created.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkOrg } from "@/integrations/clerk/auth-middleware";

function assertAdmin(context: { orgRole: string | null; isPersonalWorkspace?: boolean }) {
  // In a personal workspace, the owner (only member) is implicitly admin.
  if (context.isPersonalWorkspace) return;
  if (context.orgRole !== "org:admin") {
    throw new Error("Only workspace admins can manage API keys.");
  }
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .handler(async ({ context }) => {
    assertAdmin(context);
    const { data, error } = await context.supabase
      .from("api_keys")
      .select("id, label, prefix, created_at, last_used_at, revoked_at, expires_at")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) =>
    z.object({ label: z.string().trim().min(1).max(80) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context);
    const { generateApiKey } = await import("@/lib/api-auth.server");
    const key = generateApiKey();
    const { data: row, error } = await context.supabase
      .from("api_keys")
      .insert({
        org_id: context.orgId,
        created_by_user_id: context.userId,
        label: data.label,
        prefix: key.prefix,
        token_hash: key.hash,
      })
      .select("id, label, prefix, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { ...row, key: key.raw };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    assertAdmin(context);
    const { error } = await context.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
