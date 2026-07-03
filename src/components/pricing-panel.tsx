import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { createWhopCheckout } from "@/lib/whop.functions";

export function PricingPanel({ compact = false }: { compact?: boolean }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const total = qty * 49;

  async function onCheckout() {
    if (!isSignedIn) {
      sessionStorage.setItem("loomly:postAuthRedirect", "/pricing");
      navigate({ to: "/auth" });
      return;
    }
    setLoading(true);
    try {
      const { url } = await createWhopCheckout({ data: { quantity: qty } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-border bg-secondary/30 p-8 md:p-10"}>
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

      <div className="mt-8">
        <div className="mb-3 flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>20</span>
        </div>
        <Slider value={[qty]} min={1} max={20} step={1} onValueChange={(v) => setQty(v[0] ?? 1)} />
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setQty(n)}
              className={`rounded-full border px-3 py-1 text-xs transition ${qty === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-8 space-y-3 text-sm">
        {[
          "We create and warm up each account for 3–4 days",
          "One calendar to schedule every post",
          "Direct video upload up to 4K",
          "Human team publishes on schedule",
          "Cancel or change quantity anytime",
        ].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button size="lg" className="mt-8 w-full" disabled={loading} onClick={onCheckout}>
        {loading ? "Opening checkout…" : `Continue — $${total}/month`}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Secure checkout via Whop.{" "}
        {isSignedIn ? null : (
          <>
            <Link to="/auth" className="underline">Sign in</Link> first if you already have an account.
          </>
        )}
      </p>
    </div>
  );
}
