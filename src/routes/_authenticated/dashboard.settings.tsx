import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { SettingsPanel } from "@/components/settings-panel";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Loomly" }] }),
});

function SettingsPage() {
  return (
    <DashboardShell>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-8 max-w-xl rounded-xl border border-border bg-background p-6">
        <SettingsPanel />
      </div>
    </DashboardShell>
  );
}
