import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { getMySubscription } from "@/lib/accounts.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  component: BillingPage,
  head: () => ({ meta: [{ title: "Billing — Loomly" }] }),
});

function BillingPage() {
  const fn = useServerFn(getMySubscription);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["subscription"], queryFn: () => fn() }));
  const sub = q.data;
  return (
    <DashboardShell>
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <div className="mt-8 max-w-xl rounded-xl border border-border bg-background p-6">
        {sub ? (
          <>
            <div className="flex justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Current plan</div>
                <div className="mt-1 text-lg font-medium">{sub.quantity} × $49/month</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1 text-lg font-medium capitalize">{sub.status}</div>
              </div>
            </div>
            {sub.current_period_end && (
              <p className="mt-6 text-sm text-muted-foreground">
                Renews {new Date(sub.current_period_end).toLocaleDateString()}
              </p>
            )}
            <Button asChild variant="outline" className="mt-6">
              <a href="https://whop.com/orders" target="_blank" rel="noreferrer">Manage in Whop →</a>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">No active subscription.</p>
            <Button asChild className="mt-4"><a href="/pricing">Subscribe</a></Button>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
