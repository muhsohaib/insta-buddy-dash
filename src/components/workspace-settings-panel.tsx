import { useState } from "react";
import { OrganizationProfile, useOrganization } from "@clerk/tanstack-react-start";
import { useServerFn } from "@tanstack/react-start";
import { inviteOrgMember } from "@/lib/organization.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function WorkspaceSettingsPanel() {
  const { organization, isLoaded, membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";

  if (!isLoaded) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!organization) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No active workspace.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && <InviteForm organizationId={organization.id} />}
      <div className="rounded-xl border border-hairline bg-background p-2 min-w-0">
        <OrganizationProfile routing="virtual" />
      </div>
    </div>
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
      className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-background p-3"
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
