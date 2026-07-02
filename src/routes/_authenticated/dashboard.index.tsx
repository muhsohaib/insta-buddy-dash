import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { listMyAccounts, getMySubscription } from "@/lib/accounts.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Loomly" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  pending_details: "Waiting for details",
  creating: "Creating account",
  warming_up: "Warming up",
  ready: "Ready",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  pending_details: "bg-amber-100 text-amber-900 border-amber-200",
  creating: "bg-blue-100 text-blue-900 border-blue-200",
  warming_up: "bg-violet-100 text-violet-900 border-violet-200",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-200",
  cancelled: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

function DashboardPage() {
  const listFn = useServerFn(listMyAccounts);
  const subFn = useServerFn(getMySubscription);
  const accountsQ = useSuspenseQuery(queryOptions({ queryKey: ["accounts"], queryFn: () => listFn() }));
  const subQ = useSuspenseQuery(queryOptions({ queryKey: ["subscription"], queryFn: () => subFn() }));

  return (
    <DashboardShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Instagram accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subQ.data ? (
              <>Subscription: <span className="font-medium text-foreground">{subQ.data.quantity} × $49/mo</span> — {subQ.data.status}</>
            ) : (
              "No active subscription yet."
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/pricing"><Plus className="mr-1 h-4 w-4" /> Add accounts</Link>
        </Button>
      </div>

      {accountsQ.data.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">You don't have any Instagram accounts yet.</p>
          <Button asChild className="mt-4"><Link to="/pricing">Get started</Link></Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accountsQ.data.map((a) => {
            const details = Array.isArray(a.account_details) ? a.account_details[0] : a.account_details;
            return (
              <Link
                key={a.id}
                to="/dashboard/accounts/$id"
                params={{ id: a.id }}
                className="group rounded-xl border border-border bg-background p-5 transition hover:border-foreground/20 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{a.label ?? "Instagram account"}</div>
                    <div className="mt-1 text-base font-medium">
                      {details?.ig_username ? `@${details.ig_username}` : details?.app_name ?? "Not set up yet"}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[a.status] ?? ""}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground group-hover:text-foreground">
                  <span>{a.status === "pending_details" ? "Fill out onboarding" : a.status === "ready" ? "Open calendar" : "View status"}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

// re-export just to satisfy tree-shake noise
void Badge;
