import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { OrganizationProfile, useOrganization } from "@clerk/tanstack-react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { inviteOrgMember } from "@/lib/organization.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/organization")({
  component: OrganizationPage,
  head: () => ({ meta: [{ title: "Workspace — Loomly" }] }),
});

function OrganizationPage() {
  const { organization, isLoaded } = useOrganization();
  const navigate = useNavigate();

  // Every signed-in user should have an active workspace. If not, send them
  // through onboarding — never render the raw Clerk "create organization" UI.
  useEffect(() => {
    if (isLoaded && !organization) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoaded, organization, navigate]);

  return (
    <DashboardShell>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workspace</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Members & settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates, manage roles, and update workspace settings.
        </p>
      </div>

      {organization && <InviteForm organizationId={organization.id} />}

      <div className="rounded-xl border border-hairline bg-background p-2">
        {!isLoaded || !organization ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <OrganizationProfile routing="hash" />
        )}
      </div>
    </DashboardShell>
  );
}

function InviteForm({ organizationId }: { organizationId: string }) {
  const invite = useServerFn(inviteOrgMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"org:admin" | "org:member">("org:member");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    try {
      await invite({ data: { organizationId, emailAddress: email, role } });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-background p-3"
    >
      <Input
        type="email"
        required
        placeholder="teammate@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-w-[240px] flex-1"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "org:admin" | "org:member")}
        className="h-10 rounded-md border border-hairline bg-background px-3 text-sm"
      >
        <option value="org:member">Member</option>
        <option value="org:admin">Admin</option>
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
