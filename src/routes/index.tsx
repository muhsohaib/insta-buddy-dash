import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { CalendarClock, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Loomly — Instagram accounts + scheduling for founders" },
      { name: "description", content: "We create warmed-up Instagram accounts for founders and give you one clean calendar to schedule posts. $49 per account per month." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Built for B2C SaaS &amp; app founders
            </div>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
              Instagram accounts for founders who can't grow one.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Shadowbanned? Deleted? Don't want the hassle? We create fresh Instagram accounts,
              warm them up for you, and give you one dashboard to schedule every post.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/pricing">Start for $49/month <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">How it works</a>
              </Button>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-semibold tracking-tight">How Loomly works</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Four steps. No automation gimmicks — real humans do the sensitive work.</p>
            <div className="mt-12 grid gap-6 md:grid-cols-4">
              {[
                { n: "01", t: "Subscribe", d: "Pick how many Instagram accounts you need. $49 per account per month." },
                { n: "02", t: "Tell us the brief", d: "Fill in your niche, bio, target country, competitors, and any special instructions." },
                { n: "03", t: "We warm it up", d: "We create the account and engage in your niche for 3–4 days so it looks natural." },
                { n: "04", t: "Schedule posts", d: "Upload videos and pick times on a calendar. Our team publishes on the dot." },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-border bg-background p-6">
                  <div className="text-xs font-medium text-muted-foreground">{s.n}</div>
                  <div className="mt-2 text-lg font-medium">{s.t}</div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-3">
            <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Real, warmed-up accounts" body="We spend 3–4 days making each account look and behave like a genuine human." />
            <Feature icon={<CalendarClock className="h-5 w-5" />} title="One calendar, zero chaos" body="Drop in a video, write a caption, pick a time. That's it." />
            <Feature icon={<Sparkles className="h-5 w-5" />} title="Founders-first pricing" body="Flat $49 per account per month. Scale up or down anytime." />
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Ready to hand off Instagram?</h2>
            <p className="mt-3 text-muted-foreground">Pick your plan and we'll have your first account ready in under a week.</p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/pricing">See pricing <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} Loomly</div>
          <div className="flex gap-4">
            <Link to="/pricing">Pricing</Link>
            <Link to="/auth">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">{icon}</div>
      <div className="mt-4 text-lg font-medium">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
