import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { BarChart3, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  component: AnalyticsPage,
  head: () => ({ meta: [{ title: "Analytics — Loomly" }] }),
});

function AnalyticsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analytics</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Performance overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reach, followers, and engagement across all accounts.</p>
        </div>
      </div>

      <div className="soft-card mt-8 grid place-items-center p-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h2 className="mt-6 text-xl font-semibold">Analytics coming soon</h2>
        <p className="mt-2 flex items-center gap-1 max-w-sm text-sm text-muted-foreground">
          <Sparkles className="h-3 w-3 text-[var(--color-cyan-accent)]" />
          Deep insights across accounts land in the next release.
        </p>
      </div>
    </DashboardShell>
  );
}
