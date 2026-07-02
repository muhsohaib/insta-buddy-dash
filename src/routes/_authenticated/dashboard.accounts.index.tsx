import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { listMyAccounts } from "@/lib/accounts.functions";
import { AccountCard } from "@/components/account-card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/accounts")({
  component: AccountsPage,
  head: () => ({ meta: [{ title: "Accounts — Loomly" }] }),
});

function AccountsPage() {
  const listFn = useServerFn(listMyAccounts);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["accounts"], queryFn: () => listFn() }));

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Accounts</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your Instagram accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage every account, warmup status, and quick actions.</p>
        </div>
        <Button asChild className="gradient-accent rounded-xl text-background">
          <Link to="/pricing"><Plus className="mr-1 h-4 w-4" /> Add accounts</Link>
        </Button>
      </div>

      {q.data.length === 0 ? (
        <div className="soft-card mt-8 grid place-items-center p-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">No accounts yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Subscribe to add your first Instagram account. We warm it up over 3–4 days.
          </p>
          <Button asChild className="mt-6 gradient-accent text-background">
            <Link to="/pricing">Get started</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((a) => {
            const d = Array.isArray(a.account_details) ? a.account_details[0] : a.account_details;
            return (
              <AccountCard
                key={a.id}
                id={a.id}
                username={d?.ig_username ?? null}
                label={a.label ?? d?.app_name ?? null}
                status={a.status}
                photo={d?.profile_photo_url ?? null}
              />
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
