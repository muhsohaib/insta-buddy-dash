// Members core — mirrors Clerk org memberships as spec Member resources.
// Reads use Clerk backend SDK; writes (invite/role/remove) currently return
// service_unavailable until 7c wires Clerk admin credentials into runtime.
import type { ApiAuth } from "./api-auth.server";
import { SpecError } from "./api/envelope";

export type MemberView = {
  id: string;
  object: "member";
  user_id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "member" | "owner";
  status: "active" | "invited" | "removed";
  created_at: string;
  updated_at: string;
};

async function clerk() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new SpecError("service_unavailable", "Clerk not configured");
  const { createClerkClient } = await import("@clerk/backend");
  return createClerkClient({ secretKey: key });
}

function mapRole(r: string | null | undefined): MemberView["role"] {
  if (!r) return "member";
  if (r.includes("admin")) return "admin";
  if (r.includes("owner")) return "owner";
  return "member";
}

export async function listMembers(auth: ApiAuth): Promise<MemberView[]> {
  if (!auth.orgId.startsWith("org_")) {
    // Personal workspace: single-member view of the caller.
    return auth.userId
      ? [
          {
            id: auth.userId,
            object: "member",
            user_id: auth.userId,
            email: null,
            name: null,
            role: "owner",
            status: "active",
            created_at: new Date(0).toISOString(),
            updated_at: new Date(0).toISOString(),
          },
        ]
      : [];
  }
  const c = await clerk();
  const list = await c.organizations.getOrganizationMembershipList({ organizationId: auth.orgId });
  const items = Array.isArray(list) ? list : (list as { data: unknown[] }).data ?? [];
  return (items as Array<Record<string, unknown>>).map((m) => {
    const pub = m.publicUserData as Record<string, unknown> | undefined;
    return {
      id: String(m.id),
      object: "member" as const,
      user_id: String((pub?.userId as string) ?? m.publicUserData ?? ""),
      email: (pub?.identifier as string) ?? null,
      name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || null,
      role: mapRole(m.role as string | undefined),
      status: "active" as const,
      created_at: new Date((m.createdAt as number) ?? 0).toISOString(),
      updated_at: new Date((m.updatedAt as number) ?? 0).toISOString(),
    };
  });
}

export async function getMember(auth: ApiAuth, id: string): Promise<MemberView> {
  const list = await listMembers(auth);
  const found = list.find((m) => m.id === id || m.user_id === id);
  if (!found) throw new SpecError("not_found", `Member ${id} not found`);
  return found;
}
