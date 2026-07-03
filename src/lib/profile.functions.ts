import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkAuth } from "@/integrations/clerk/auth-middleware";

// Ensures a `profiles` row exists for the current Clerk user.
// Called from the authenticated layout on first mount so downstream code
// can rely on the row being present.
export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, clerk, supabase } = context;
    const user = await clerk.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      null;
    const avatar = user.imageUrl ?? null;

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          avatar_url: avatar,
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input) =>
    z.object({ full_name: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
