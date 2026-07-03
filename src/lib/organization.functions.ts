// Server functions for Clerk Organizations.
// Creates invitations with an app-owned `redirect_url` so accepted
// invites land on our /accept-invitation route (not Clerk's default page).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireClerkAuth } from "@/integrations/clerk/auth-middleware";

const inviteSchema = z.object({
  organizationId: z.string().min(1),
  emailAddress: z.string().email(),
  role: z.enum(["org:admin", "org:member"]).default("org:member"),
});

function getAppOrigin(): string {
  const envUrl = process.env.APP_URL || process.env.VITE_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const req = getRequest();
  const url = req ? new URL(req.url) : null;
  return url ? `${url.protocol}//${url.host}` : "";
}

export const inviteOrgMember = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((data) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const origin = getAppOrigin();
    const redirectUrl = `${origin}/accept-invitation?org=${encodeURIComponent(data.organizationId)}`;
    const invitation = await context.clerk.organizations.createOrganizationInvitation({
      organizationId: data.organizationId,
      emailAddress: data.emailAddress,
      role: data.role,
      inviterUserId: context.userId,
      redirectUrl,
    });
    return { id: invitation.id, emailAddress: invitation.emailAddress, status: invitation.status };
  });
