import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { Film, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/library")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "Video Library — Loomly" }] }),
});

function LibraryPage() {
  return (
    <DashboardShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Video Library</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your uploaded videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every clip you've uploaded across accounts, ready to reuse.</p>
        </div>
      </div>

      <div className="soft-card mt-8 grid place-items-center p-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]">
          <Film className="h-6 w-6" />
        </div>
        <h2 className="mt-6 text-xl font-semibold">Library coming soon</h2>
        <p className="mt-2 flex items-center gap-1 max-w-sm text-sm text-muted-foreground">
          <Sparkles className="h-3 w-3 text-[var(--color-cyan-accent)]" />
          We're building a unified library view for all your uploads.
        </p>
      </div>
    </DashboardShell>
  );
}
