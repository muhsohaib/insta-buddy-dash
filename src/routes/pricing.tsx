import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { PricingPanel } from "@/components/pricing-panel";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "Pricing — Loomly" },
      { name: "description", content: "$49 per Instagram account per month. Pick your quantity and get started." },
    ],
  }),
});

function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Simple pricing.</h1>
          <p className="mt-3 text-muted-foreground">$49 per Instagram account per month. Cancel anytime.</p>
        </div>
        <div className="mt-12">
          <PricingPanel />
        </div>
      </main>
    </div>
  );
}
