import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DashboardShell } from "@/components/dashboard-shell";
import { listMyAccounts, getMySubscription } from "@/lib/accounts.functions";
import { listMyPostsForAccount } from "@/lib/posts.functions";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, TrendingUp, Sparkles } from "lucide-react";
import { CalendarGrid, type CalendarPost } from "@/components/calendar-grid";
import { CreateAccountDialog, type AccountGateState } from "@/components/create-account-dialog";
import { SchedulePostDialog, type ReadyAccount } from "@/components/schedule-post-dialog";
import { PickAccountDialog, type PickableAccount } from "@/components/pick-account-dialog";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Calendar — Loomly" }] }),
});

function DashboardPage() {
  const listFn = useServerFn(listMyAccounts);
  const subFn = useServerFn(getMySubscription);
  const listPostsFn = useServerFn(listMyPostsForAccount);
  const queryClient = useQueryClient();

  const accountsQ = useSuspenseQuery(queryOptions({ queryKey: ["accounts"], queryFn: () => listFn() }));
  const subQ = useSuspenseQuery(queryOptions({ queryKey: ["subscription"], queryFn: () => subFn() }));

  const readyAccounts: ReadyAccount[] = useMemo(
    () =>
      accountsQ.data
        .filter((a) => a.status === "ready")
        .map((a) => {
          const d = Array.isArray(a.account_details) ? a.account_details[0] : a.account_details;
          return { id: a.id, username: d?.ig_username ?? "", label: a.label };
        }),
    [accountsQ.data]
  );

  const readyIds = useMemo(() => readyAccounts.map((a) => a.id), [readyAccounts]);

  // Aggregate posts across ready accounts
  const postsQueries = useSuspenseQuery(
    queryOptions({
      queryKey: ["posts", "all", readyIds],
      queryFn: async () => {
        if (readyIds.length === 0) return [] as CalendarPost[];
        const results = await Promise.all(
          readyIds.map((id) => listPostsFn({ data: { account_id: id } }))
        );
        const out: CalendarPost[] = [];
        results.forEach((posts, idx) => {
          const acct = readyAccounts[idx];
          for (const p of posts) {
            out.push({
              id: p.id,
              scheduled_at: p.scheduled_at,
              caption: p.caption,
              account_label: acct?.username ?? acct?.label ?? null,
            });
          }
        });
        return out;
      },
    })
  );

  const [openDate, setOpenDate] = useState<Date | null>(null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const hasReady = readyAccounts.length > 0;
  const hasWarming = accountsQ.data.some((a) => a.status === "warming_up");
  const hasCreating = accountsQ.data.some((a) => a.status === "creating" || a.status === "pending_details");
  const gateState: AccountGateState = hasWarming ? "warming_up" : hasCreating ? "creating" : "none";

  function onCreateFromDay(date: Date) {
    if (!hasReady) {
      setShowCreateAccount(true);
      return;
    }
    setOpenDate(date);
  }

  const activeCount = accountsQ.data.filter((a) => a.status === "ready").length;
  const warmupCount = accountsQ.data.filter((a) => a.status === "warming_up" || a.status === "creating").length;
  const scheduledCount = postsQueries.data.length;

  return (
    <DashboardShell>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendar</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Plan your <span className="gradient-text">week</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subQ.data
              ? `Subscription active — ${subQ.data.quantity} × $49/mo`
              : "No subscription yet — add an Instagram account to get started."}
          </p>
        </div>
        <Button
          onClick={() => (hasReady ? setOpenDate(new Date()) : setShowCreateAccount(true))}
          className="gradient-accent rounded-xl text-background shadow-[0_10px_30px_-8px_var(--color-cyan-accent)] hover:shadow-[0_15px_40px_-8px_var(--color-cyan-accent)]"
        >
          <Plus className="mr-1 h-4 w-4" /> {hasReady ? "Schedule post" : "Create new account"}
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Active accounts" value={String(activeCount)} tone="cyan" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="In warmup" value={String(warmupCount)} tone="purple" />
        <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Scheduled posts" value={String(scheduledCount)} tone="cyan" />
      </div>

      {/* Calendar */}
      <div className="mt-6">
        {accountsQ.data.length === 0 ? (
          <EmptyCalendar onCreate={() => setShowCreateAccount(true)} />
        ) : (
          <CalendarGrid posts={postsQueries.data} onCreate={onCreateFromDay} />
        )}
      </div>

      {/* Dialogs */}
      <CreateAccountDialog open={showCreateAccount} onClose={() => setShowCreateAccount(false)} state={gateState} />
      <SchedulePostDialog
        open={openDate !== null}
        initialDate={openDate}
        accounts={readyAccounts}
        onClose={() => setOpenDate(null)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["posts"] });
        }}
      />
    </DashboardShell>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "cyan" | "purple" }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="soft-card flex items-center gap-4 p-4"
    >
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone === "cyan" ? "bg-[color-mix(in_oklab,var(--color-cyan-accent)_18%,transparent)] text-[var(--color-cyan-accent)]" : "bg-[color-mix(in_oklab,var(--color-purple-accent)_18%,transparent)] text-[var(--color-purple-accent)]"}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </div>
    </motion.div>
  );
}

function EmptyCalendar({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="soft-card grid place-items-center p-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]">
        <Plus className="h-6 w-6" />
      </div>
      <h2 className="mt-6 text-xl font-semibold">Your calendar is ready</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Add your first Instagram account and we'll warm it up in a few days. Then you can schedule posts here.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline"><Link to="/pricing">See pricing</Link></Button>
        <Button className="gradient-accent text-background" onClick={onCreate}>
          <Plus className="mr-1 h-4 w-4" /> Create new account
        </Button>
      </div>
    </div>
  );
}
