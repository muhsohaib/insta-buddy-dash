import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { listMyAccounts, createAdditionalAccount } from "@/lib/accounts.functions";
import { listMyPostsForAccount } from "@/lib/posts.functions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CalendarGrid, type CalendarPost } from "@/components/calendar-grid";
import { CreateAccountDialog, type AccountGateState } from "@/components/create-account-dialog";
import { SchedulePostDialog, type ReadyAccount } from "@/components/schedule-post-dialog";
import { PickAccountDialog, type PickableAccount } from "@/components/pick-account-dialog";
import { EditPostDialog, type EditablePost } from "@/components/edit-post-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Calendar — Loomly" }] }),
});

function DashboardPage() {
  const listFn = useServerFn(listMyAccounts);
  const listPostsFn = useServerFn(listMyPostsForAccount);
  const createAccountFn = useServerFn(createAdditionalAccount);
  const queryClient = useQueryClient();

  const accountsQ = useSuspenseQuery(queryOptions({ queryKey: ["accounts"], queryFn: () => listFn() }));

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
              bunny_video_id: p.bunny_video_id,
              bunny_library_id: p.bunny_library_id,
              thumbnail_url: p.thumbnail_url,
            });
          }
        });
        return out;
      },
    })
  );

  const [openDate, setOpenDate] = useState<Date | null>(null);
  const [scheduleAccountId, setScheduleAccountId] = useState<string | undefined>(undefined);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [editingPost, setEditingPost] = useState<EditablePost | null>(null);

  const hasReady = readyAccounts.length > 0;
  const hasWarming = accountsQ.data.some((a) => a.status === "warming_up");
  const hasCreating = accountsQ.data.some((a) => a.status === "creating");
  const gateState: AccountGateState = hasWarming ? "warming_up" : hasCreating ? "creating" : "none";

  const pickable: PickableAccount[] = useMemo(
    () =>
      accountsQ.data
        .filter((a) => ["ready", "warming_up", "creating", "pending_details"].includes(a.status))
        .map((a) => {
          const d = Array.isArray(a.account_details) ? a.account_details[0] : a.account_details;
          return {
            id: a.id,
            username: d?.ig_username ?? null,
            label: a.label ?? d?.app_name ?? null,
            status: a.status,
            photo: d?.profile_photo_url ?? null,
          };
        }),
    [accountsQ.data]
  );

  function onCreateFromDay(date: Date) {
    // No accounts at all → gate to pricing / status.
    if (pickable.length === 0) {
      setShowCreateAccount(true);
      return;
    }
    // Only one account and it's ready → straight to scheduler.
    if (pickable.length === 1 && hasReady) {
      setScheduleAccountId(pickable[0].id);
      setOpenDate(date);
      return;
    }
    // Multiple accounts (or a single non-ready one) → let the user pick.
    setPickerDate(date);
    setShowPicker(true);
  }

  async function onCreateAccount() {
    if (creatingAccount) return;
    setCreatingAccount(true);
    try {
      const pendingAccount = accountsQ.data.find((a) => a.status === "pending_details");
      const account = pendingAccount ?? await createAccountFn();
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      navigate({ to: "/dashboard/accounts/$id", params: { id: account.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add account");
    } finally {
      setCreatingAccount(false);
    }
  }

  function onEmptyCreateAccount() {
    if (accountsQ.data.length === 0) {
      setShowCreateAccount(true);
      return;
    }
    void onCreateAccount();
  }

  return (
    <DashboardShell>
      {/* Calendar */}
      <div className="mt-2">
        {accountsQ.data.length === 0 ? (
          <EmptyCalendar onCreate={onEmptyCreateAccount} />
        ) : (
          <CalendarGrid
            posts={postsQueries.data}
            onCreate={onCreateFromDay}
            onEditPost={(p) => setEditingPost(p)}
          />
        )}
      </div>

      <EditPostDialog
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["posts"] })}
      />

      {/* Dialogs */}
      <CreateAccountDialog open={showCreateAccount} onClose={() => setShowCreateAccount(false)} state={gateState} />
      <PickAccountDialog
        open={showPicker}
        onClose={() => setShowPicker(false)}
        accounts={pickable}
        onPickReady={(id) => {
          setScheduleAccountId(id);
          setOpenDate(pickerDate ?? new Date());
        }}
      />
      <SchedulePostDialog
        open={openDate !== null}
        initialDate={openDate}
        accounts={readyAccounts}
        defaultAccountId={scheduleAccountId}
        onClose={() => { setOpenDate(null); setScheduleAccountId(undefined); }}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["posts"] });
        }}
      />
    </DashboardShell>
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
