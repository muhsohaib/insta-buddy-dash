import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminNav } from "./admin.index";
import { adminListOrders } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  component: AdminOrdersPage,
  head: () => ({ meta: [{ title: "Admin orders — Loomly" }] }),
});

function AdminOrdersPage() {
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <OrdersTable />
      </AdminGate>
    </DashboardShell>
  );
}

const TONE: Record<string, string> = {
  awaiting_payment: "bg-amber-500/15 text-amber-600",
  awaiting_details: "bg-amber-500/15 text-amber-600",
  pending: "bg-blue-500/15 text-blue-600",
  in_progress: "bg-blue-500/15 text-blue-600",
  ready: "bg-emerald-500/15 text-emerald-600",
  delivered: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-red-500/15 text-red-600",
  draft: "bg-secondary text-muted-foreground",
};

function OrdersTable() {
  const fn = useServerFn(adminListOrders);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["admin", "orders"], queryFn: () => fn() }));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium">Workspace</th>
            <th className="px-4 py-3 font-medium">Qty</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Payment</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Progress</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {q.data.map((o: any) => {
            const items = o.order_items ?? [];
            const ready = items.filter((i: any) => i.status === "ready" || i.status === "delivered").length;
            return (
              <tr key={o.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link to="/admin/orders/$id" params={{ id: o.id }} className="font-medium hover:underline">
                    #{o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{o.org_id}</td>
                <td className="px-4 py-3">{o.quantity}</td>
                <td className="px-4 py-3">${(o.total_cents / 100).toFixed(0)}</td>
                <td className="px-4 py-3 capitalize">{o.payment_status}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${TONE[o.status] ?? "bg-secondary"}`}>{o.status.replace(/_/g, " ")}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{ready} / {items.length} ready</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            );
          })}
          {q.data.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No orders yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
