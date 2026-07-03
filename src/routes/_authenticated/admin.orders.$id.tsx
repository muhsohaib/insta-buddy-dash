import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminNav } from "./admin.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { adminGetOrder, adminUpdateItemStatus, adminSaveDeliverable } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/admin/orders/$id")({
  component: AdminOrderDetail,
  head: () => ({ meta: [{ title: "Admin order — Loomly" }] }),
});

type FieldDef = { key: string; label: string; type: string; required?: boolean };

function AdminOrderDetail() {
  const { id } = Route.useParams();
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <Inner id={id} />
      </AdminGate>
    </DashboardShell>
  );
}

function Inner({ id }: { id: string }) {
  const fn = useServerFn(adminGetOrder);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["admin", "order", id], queryFn: () => fn({ data: { id } }) }));
  const order = q.data as any;
  const detailsFields: FieldDef[] = order.products?.details_schema?.fields ?? [];
  const deliverableFields: FieldDef[] = order.products?.deliverable_schema?.fields ?? [];
  const items = [...order.order_items].sort((a: any, b: any) => a.position - b.position);

  return (
    <div>
      <Link to="/admin/orders" className="text-xs text-muted-foreground hover:underline">← All orders</Link>
      <h1 className="mt-2 text-2xl font-semibold">Order #{order.order_number}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.org_id} · {order.quantity} accounts · ${(order.total_cents / 100).toFixed(0)}/mo · {order.status.replace(/_/g, " ")}
      </p>

      <div className="mt-6 space-y-6">
        {items.map((it: any, idx: number) => (
          <ItemCard key={it.id} orderId={id} item={it} idx={idx} detailsFields={detailsFields} deliverableFields={deliverableFields} />
        ))}
      </div>
    </div>
  );
}

const STATUSES = ["waiting", "creating", "warming", "ready", "delivered", "cancelled"] as const;

function ItemCard({
  orderId,
  item,
  idx,
  detailsFields,
  deliverableFields,
}: {
  orderId: string;
  item: any;
  idx: number;
  detailsFields: FieldDef[];
  deliverableFields: FieldDef[];
}) {
  const qc = useQueryClient();
  const upd = useServerFn(adminUpdateItemStatus);
  const saveDel = useServerFn(adminSaveDeliverable);
  const [deliverable, setDeliverable] = useState<Record<string, any>>(
    (item.order_item_deliverables?.data ?? {}) as Record<string, any>,
  );
  const [saving, setSaving] = useState(false);
  const details = (item.order_item_details?.data ?? {}) as Record<string, any>;

  async function setStatus(s: string) {
    try {
      await upd({ data: { id: item.id, status: s as any } });
      toast.success(`Item ${idx + 1}: ${s}`);
      await qc.invalidateQueries({ queryKey: ["admin", "order", orderId] });
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveHandoff(markReady: boolean) {
    setSaving(true);
    try {
      await saveDel({ data: { order_item_id: item.id, data: deliverable, mark_ready: markReady } });
      toast.success(markReady ? "Marked ready" : "Handoff saved");
      await qc.invalidateQueries({ queryKey: ["admin", "order", orderId] });
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Account {idx + 1}</div>
          <div className="mt-0.5 font-semibold capitalize">{item.status}</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md border px-2 py-1 text-xs ${item.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Customer details</div>
          <div className="mt-2 space-y-2 rounded-lg bg-secondary/30 p-3 text-sm">
            {detailsFields.map((f) => (
              <div key={f.key}>
                <div className="text-xs text-muted-foreground">{f.label}</div>
                <div className="whitespace-pre-wrap break-words">
                  {Array.isArray(details[f.key])
                    ? (details[f.key] as string[]).join(", ")
                    : (details[f.key] ?? "—")}
                </div>
              </div>
            ))}
            {Object.keys(details).length === 0 && <div className="text-muted-foreground">Awaiting details from customer.</div>}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Handoff (delivered to customer)</div>
          <div className="mt-2 space-y-3">
            {deliverableFields.map((f) => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    className="mt-1"
                    value={(deliverable[f.key] as string) ?? ""}
                    onChange={(e) => setDeliverable((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    className="mt-1"
                    type={f.type === "secret" ? "text" : f.type === "url" ? "url" : "text"}
                    value={(deliverable[f.key] as string) ?? ""}
                    onChange={(e) => setDeliverable((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => saveHandoff(false)} disabled={saving}>Save</Button>
              <Button size="sm" onClick={() => saveHandoff(true)} disabled={saving} className="gradient-accent text-background">
                Save & mark ready
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
