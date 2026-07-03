import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Package, ArrowRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { listMyOrders } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/dashboard/orders/")({
  component: OrdersList,
  head: () => ({ meta: [{ title: "Orders — Loomly" }] }),
});

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-secondary text-muted-foreground" },
  awaiting_payment: { label: "Awaiting payment", tone: "bg-amber-500/15 text-amber-600" },
  awaiting_details: { label: "Awaiting details", tone: "bg-amber-500/15 text-amber-600" },
  pending: { label: "Pending", tone: "bg-blue-500/15 text-blue-600" },
  in_progress: { label: "In progress", tone: "bg-blue-500/15 text-blue-600" },
  ready: { label: "Ready", tone: "bg-emerald-500/15 text-emerald-600" },
  delivered: { label: "Delivered", tone: "bg-emerald-500/15 text-emerald-600" },
  cancelled: { label: "Cancelled", tone: "bg-red-500/15 text-red-600" },
};

function OrdersList() {
  const fn = useServerFn(listMyOrders);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["orders", "mine"], queryFn: () => fn() }));

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orders</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every order is a batch of Instagram accounts we build for you.</p>
        </div>
        <Button asChild className="gradient-accent rounded-xl text-background">
          <Link to="/dashboard/orders/new"><Plus className="mr-1 h-4 w-4" /> New order</Link>
        </Button>
      </div>

      {q.data.length === 0 ? (
        <div className="soft-card mt-8 grid place-items-center p-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">No orders yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Place your first order to kick off account warmup.
          </p>
          <Button asChild className="mt-6 gradient-accent text-background">
            <Link to="/dashboard/orders/new">Start an order</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {q.data.map((o) => {
            const items = o.order_items ?? [];
            const ready = items.filter((i) => i.status === "ready" || i.status === "delivered").length;
            const status = STATUS_COPY[o.status] ?? { label: o.status, tone: "bg-secondary" };
            return (
              <Link
                key={o.id}
                to="/dashboard/orders/$id"
                params={{ id: o.id }}
                className="soft-card flex items-center gap-4 p-5 transition hover:bg-secondary/40"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">Order #{o.order_number}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {o.quantity} {o.quantity === 1 ? "account" : "accounts"} · ${(o.total_cents / 100).toFixed(0)}/mo
                    {items.length > 0 && ` · ${ready}/${items.length} ready`}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
