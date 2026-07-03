import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OrganizationProfile, useOrganization, CreateOrganization } from "@clerk/tanstack-react-start";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/dashboard/organization")({
  component: OrganizationPage,
  head: () => ({ meta: [{ title: "Workspace — Loomly" }] }),
});

function OrganizationPage() {
  const { organization, isLoaded } = useOrganization();
  const navigate = useNavigate();

  return (
    <DashboardShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workspace</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {organization ? "Members & settings" : "Create an organization"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {organization
              ? "Invite teammates, manage roles, and update workspace settings."
              : "You're currently in your personal workspace. Create an organization to invite teammates and share resources."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Close workspace settings"
          className="shrink-0 rounded-xl"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="rounded-xl border border-hairline bg-background p-2">
        {!isLoaded ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : organization ? (
          <OrganizationProfile routing="hash" />
        ) : (
          <CreateOrganization afterCreateOrganizationUrl="/dashboard/organization" />
        )}
      </div>
    </DashboardShell>
  );
}
