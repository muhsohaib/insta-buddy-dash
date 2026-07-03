import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, CheckCircle2, Loader2, Clock, Sparkles, Eye, EyeOff } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getMyOrder, saveItemDetails } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/dashboard/orders/$id")({
  component: OrderDetail,
  head: () => ({ meta: [{ title: "Order — Loomly" }] }),
});

type FieldDef = { key: string; label: string; type: string; required?: boolean; placeholder?: string; max?: number };
type Schema = { fields: FieldDef[] };

const STATUS_COPY: Record<string, { label: string; tone: string; icon: any }> = {
  waiting: { label: "Waiting for details", tone: "text-amber-600", icon: Clock },
  creating: { label: "Creating", tone: "text-blue-600", icon: Loader2 },
  warming: { label: "Warming up", tone: "text-blue-600", icon: Sparkles },
  ready: { label: "Ready", tone: "text-emerald-600", icon: CheckCircle2 },
  delivered: { label: "Delivered", tone: "text-emerald-600", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "text-red-600", icon: Clock },
};

function OrderDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getMyOrder);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["order", id], queryFn: () => fn({ data: { id } }) }));
  const order = q.data as any;
  const schema: Schema = (order.products?.details_schema ?? { fields: [] }) as Schema;
  const deliverableSchema: Schema = (order.products?.deliverable_schema ?? { fields: [] }) as Schema;
  const needsDetails = order.status === "awaiting_details" || order.status === "pending";

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl">
        <Link to="/dashboard/orders" className="text-xs text-muted-foreground hover:underline">← All orders</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Order #{order.order_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.quantity} {order.quantity === 1 ? "account" : "accounts"} · ${(order.total_cents / 100).toFixed(0)}/mo · {order.status.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        <Timeline order={order} />

        {needsDetails ? (
          <DetailsForm orderId={order.id} items={order.order_items} schema={schema} />
        ) : (
          <ItemList items={order.order_items} deliverableSchema={deliverableSchema} />
        )}
      </div>
    </DashboardShell>
  );
}

function Timeline({ order }: { order: any }) {
  const steps = [
    { key: "paid", label: "Paid", done: !!order.paid_at, at: order.paid_at },
    { key: "details", label: "Details submitted", done: !!order.details_submitted_at, at: order.details_submitted_at },
    { key: "ready", label: "All accounts ready", done: !!order.ready_at, at: order.ready_at },
    { key: "delivered", label: "Delivered", done: !!order.delivered_at, at: order.delivered_at },
  ];
  return (
    <div className="soft-card mt-6 p-5">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`grid h-8 w-8 place-items-center rounded-full ${s.done ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
              {s.done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </div>
            <div>
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.at ? new Date(s.at).toLocaleDateString() : "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailsForm({ orderId, items, schema }: { orderId: string; items: any[]; schema: Schema }) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sorted.map((it, i) => [it.id, i === 0])),
  );
  const [values, setValues] = useState<Record<string, Record<string, any>>>(() =>
    Object.fromEntries(sorted.map((it) => [it.id, (it.order_item_details?.data ?? {}) as Record<string, any>])),
  );
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const save = useServerFn(saveItemDetails);

  function setField(itemId: string, key: string, v: any) {
    setValues((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [key]: v } }));
  }

  function itemValid(itemId: string) {
    const data = values[itemId] ?? {};
    return schema.fields.every((f) => !f.required || (data[f.key] != null && String(data[f.key]).trim().length > 0));
  }

  const allValid = sorted.every((it) => itemValid(it.id));

  async function onSubmitAll() {
    if (!allValid) {
      toast.error("Fill in every required field for every account.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          order_id: orderId,
          submit: true,
          items: sorted.map((it) => ({ order_item_id: it.id, data: values[it.id] ?? {} })),
        },
      });
      toast.success("Submitted! Our team is starting on your accounts.");
      await qc.invalidateQueries({ queryKey: ["order", orderId] });
      await qc.invalidateQueries({ queryKey: ["orders", "mine"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 3 of 3</div>
      <h2 className="mt-1 text-2xl font-semibold">Tell us about each account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll use this to build each Instagram account exactly to spec.
      </p>

      <div className="mt-5 space-y-3">
        {sorted.map((it, idx) => {
          const isOpen = open[it.id];
          const valid = itemValid(it.id);
          return (
            <div key={it.id} className="soft-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [it.id]: !p[it.id] }))}
                className="flex w-full items-center gap-3 p-5 text-left"
              >
                <div className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold ${valid ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">Account {idx + 1}</div>
                  <div className="text-xs text-muted-foreground">
                    {valid ? "Ready to submit" : "Needs required info"}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-hairline bg-background/40 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    {schema.fields.map((f) => (
                      <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                        <Label className="text-xs">
                          {f.label}{f.required && <span className="text-red-500"> *</span>}
                        </Label>
                        {f.type === "textarea" ? (
                          <Textarea
                            className="mt-1"
                            maxLength={f.max}
                            value={(values[it.id]?.[f.key] as string) ?? ""}
                            onChange={(e) => setField(it.id, f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                        ) : f.type === "tags" ? (
                          <Input
                            className="mt-1"
                            value={((values[it.id]?.[f.key] as string[]) ?? []).join(", ")}
                            onChange={(e) => setField(it.id, f.key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                            placeholder="one, two, three"
                          />
                        ) : (
                          <Input
                            className="mt-1"
                            type={f.type === "url" ? "url" : "text"}
                            value={(values[it.id]?.[f.key] as string) ?? ""}
                            onChange={(e) => setField(it.id, f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={onSubmitAll} disabled={saving || !allValid} className="gradient-accent text-background">
          {saving ? "Submitting…" : "Submit all accounts"}
        </Button>
      </div>
    </div>
  );
}

function ItemList({ items, deliverableSchema }: { items: any[]; deliverableSchema: Schema }) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  return (
    <div className="mt-6 space-y-3">
      {sorted.map((it, idx) => {
        const meta = STATUS_COPY[it.status] ?? { label: it.status, tone: "text-muted-foreground", icon: Clock };
        const Icon = meta.icon;
        const deliverable = it.order_item_deliverables?.data as Record<string, any> | undefined;
        return (
          <div key={it.id} className="soft-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-sm font-semibold">{idx + 1}</div>
              <div className="flex-1">
                <div className="font-medium">Account {idx + 1}</div>
                <div className={`flex items-center gap-1 text-xs ${meta.tone}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </div>
              </div>
            </div>

            {(it.status === "ready" || it.status === "delivered") && deliverable && (
              <div className="mt-4 rounded-xl border border-hairline bg-background/40 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Account handoff</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {deliverableSchema.fields.map((f) => (
                    <DeliverableField key={f.key} field={f} value={deliverable[f.key]} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeliverableField({ field, value }: { field: FieldDef; value: any }) {
  const [show, setShow] = useState(false);
  const isSecret = field.type === "secret";
  const display = isSecret && !show ? "••••••••" : String(value ?? "—");
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm">
        <span className="flex-1 truncate">{display}</span>
        {isSecret && value && (
          <button type="button" onClick={() => setShow((s) => !s)} className="text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
