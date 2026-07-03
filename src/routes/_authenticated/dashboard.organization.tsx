import { createFileRoute } from "@tanstack/react-router";
import { OrganizationProfile } from "@clerk/tanstack-react-start";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/dashboard/organization")({
  component: OrganizationPage,
  head: () => ({ meta: [{ title: "Workspace — Loomly" }] }),
});

function OrganizationPage() {
  return (
    <DashboardShell>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workspace</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Members & settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates, manage roles, and update workspace settings. Admins can invite and manage members.
        </p>
      </div>
      <div className="rounded-xl border border-hairline bg-background p-2">
        <OrganizationProfile routing="hash" />
      </div>
    </DashboardShell>
  );
}
