import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Minus, Plus, Check, ArrowRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { createOrderAndCheckout } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/dashboard/orders/new")({
  component: NewOrder,
  head: () => ({ meta: [{ title: "New order — Loomly" }] }),
});

const PRICE = 49;
const MAX = 10;

function NewOrder() {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const create = useServerFn(createOrderAndCheckout);
  const total = qty * PRICE;

  async function onContinue() {
    setLoading(true);
    try {
      const { url } = await create({ data: { quantity: qty } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 1 of 3</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">How many accounts?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick your quantity — we warm each account for 3–4 days then hand it over.
        </p>

        <div className="soft-card mt-8 p-8">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-sm text-muted-foreground">You'll get</div>
              <div className="mt-1 text-2xl font-semibold">
                {qty} Instagram {qty === 1 ? "account" : "accounts"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-semibold tracking-tight">${total}</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <Slider value={[qty]} min={1} max={MAX} step={1} onValueChange={(v) => setQty(v[0] ?? 1)} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>1</span><span>{MAX}</span>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setQty((q) => Math.min(MAX, q + 1))} disabled={qty >= MAX}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ul className="mt-8 space-y-2 text-sm">
            {[
              "We create and warm each account for 3–4 days",
              "Fill out per-account brand info after payment",
              "Track every account's progress live",
              "Cancel or change quantity anytime",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Button size="lg" className="mt-8 w-full gradient-accent text-background" onClick={onContinue} disabled={loading}>
            {loading ? "Opening checkout…" : `Continue to payment — $${total}/mo`}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Secure checkout via Whop. You'll fill in each account's details after payment.
          </p>
          <button
            className="mt-4 block w-full text-center text-xs text-muted-foreground hover:underline"
            onClick={() => navigate({ to: "/dashboard/orders" })}
          >
            Cancel
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
