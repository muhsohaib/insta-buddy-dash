import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardShell } from "@/components/dashboard-shell";
import { getMyAccount, submitAccountDetails, uploadPhotoPath, finalizePhotoUrl } from "@/lib/accounts.functions";
import { listMyPostsForAccount } from "@/lib/posts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus } from "lucide-react";
import { PostDialog } from "@/components/post-dialog";
import { format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard/accounts/$id")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Account — Loomly" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  pending_details: "Waiting for details",
  creating: "Creating account",
  warming_up: "Warming up",
  ready: "Ready",
  cancelled: "Cancelled",
};

function AccountPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getMyAccount);
  const listPostsFn = useServerFn(listMyPostsForAccount);
  const queryClient = useQueryClient();

  const acctQ = useSuspenseQuery(queryOptions({ queryKey: ["account", id], queryFn: () => getFn({ data: { id } }) }));

  // Realtime for status changes
  useEffect(() => {
    const ch = supabase
      .channel(`account-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "instagram_accounts", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["account", id] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, queryClient]);

  const account = acctQ.data;
  if (!account) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Account not found.</p>
      </DashboardShell>
    );
  }

  const details = Array.isArray(account.account_details) ? account.account_details[0] : account.account_details;

  return (
    <DashboardShell>
      <div className="mb-6">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to accounts
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {details?.ig_username ? `@${details.ig_username}` : details?.app_name ?? account.label ?? "Instagram account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Status: <span className="text-foreground">{STATUS_LABEL[account.status] ?? account.status}</span></p>
        </div>
      </div>

      {account.status === "pending_details" ? (
        <OnboardingForm accountId={id} />
      ) : account.status === "ready" ? (
        <ScheduleCalendar accountId={id} listPostsFn={listPostsFn} />
      ) : (
        <StatusView status={account.status} />
      )}
    </DashboardShell>
  );
}

const formSchema = z.object({
  ig_username: z.string().max(80).optional(),
  bio: z.string().min(1, "Bio is required").max(500),
  target_country: z.string().min(1, "Country is required"),
  app_name: z.string().min(1, "App name is required"),
  website: z.string().max(300).optional(),
  niche: z.string().min(1, "Niche is required"),
  competitors: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

function OnboardingForm({ accountId }: { accountId: string }) {
  const submitFn = useServerFn(submitAccountDetails);
  const uploadFn = useServerFn(uploadPhotoPath);
  const finalizeFn = useServerFn(finalizePhotoUrl);
  const queryClient = useQueryClient();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const { path, token } = await uploadFn({ data: { ext } });
      const { error } = await supabase.storage
        .from("account-photos")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw error;
      const { signedUrl } = await finalizeFn({ data: { path } });
      setPhotoUrl(signedUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const competitors = (values.competitors ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
      await submitFn({
        data: {
          account_id: accountId,
          profile_photo_url: photoUrl,
          ig_username: values.ig_username || null,
          bio: values.bio,
          target_country: values.target_country,
          app_name: values.app_name,
          website: values.website || null,
          niche: values.niche,
          competitors,
          notes: values.notes || null,
        },
      });
      toast.success("Details submitted. We'll get to work.");
      queryClient.invalidateQueries({ queryKey: ["account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-2xl space-y-6 rounded-xl border border-border bg-background p-6">
      <p className="text-sm text-muted-foreground">Fill out this once and we'll create your account exactly to spec.</p>

      <div>
        <Label>Profile photo</Label>
        <div className="mt-2 flex items-center gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-16 w-16 rounded-full border border-border object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full border border-dashed border-border" />
          )}
          <Input type="file" accept="image/*" onChange={onPhotoChange} disabled={uploading} />
        </div>
      </div>

      <Field label="App / SaaS name" error={errors.app_name?.message}>
        <Input {...register("app_name")} placeholder="Acme" />
      </Field>
      <Field label="Preferred Instagram username (optional)" error={errors.ig_username?.message}>
        <Input {...register("ig_username")} placeholder="acme.app" />
      </Field>
      <Field label="Bio" error={errors.bio?.message}>
        <Textarea rows={3} {...register("bio")} placeholder="What's the account about?" />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Target country" error={errors.target_country?.message}>
          <Input {...register("target_country")} placeholder="United States" />
        </Field>
        <Field label="Niche" error={errors.niche?.message}>
          <Input {...register("niche")} placeholder="Fitness / productivity / etc." />
        </Field>
      </div>
      <Field label="Website" error={errors.website?.message}>
        <Input {...register("website")} placeholder="https://" />
      </Field>
      <Field label="Competitor Instagram links (one per line)" error={errors.competitors?.message}>
        <Textarea rows={3} {...register("competitors")} placeholder="https://instagram.com/competitor1" />
      </Field>
      <Field label="Additional instructions (optional)" error={errors.notes?.message}>
        <Textarea rows={3} {...register("notes")} placeholder="Anything else we should know?" />
      </Field>

      <Button type="submit" disabled={isSubmitting || uploading} className="w-full">
        {isSubmitting ? "Submitting…" : "Submit and start creation"}
      </Button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StatusView({ status }: { status: string }) {
  const stages = ["creating", "warming_up", "ready"];
  const currentIdx = stages.indexOf(status);
  return (
    <div className="mt-10 max-w-xl rounded-xl border border-border bg-background p-8">
      <h2 className="text-lg font-medium">We're on it.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Once your account is Ready you'll be able to schedule posts here.
      </p>
      <ol className="mt-6 space-y-3">
        {[
          { key: "creating", label: "Creating account" },
          { key: "warming_up", label: "Warming up (3–4 days of engagement)" },
          { key: "ready", label: "Ready — you can schedule posts" },
        ].map((s, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${done ? "border-primary bg-primary text-primary-foreground" : active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>
                {i + 1}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ScheduleCalendar({ accountId, listPostsFn }: { accountId: string; listPostsFn: (args: { data: { account_id: string } }) => Promise<Array<{ id: string; scheduled_at: string; caption: string; thumbnail_url: string | null; status: string }>>; }) {
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [openDate, setOpenDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  const postsQ = useSuspenseQuery(queryOptions({
    queryKey: ["posts", accountId],
    queryFn: () => listPostsFn({ data: { account_id: accountId } }),
  }));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor));
    const end = endOfWeek(endOfMonth(monthAnchor));
    const out: Date[] = [];
    let d = start;
    while (d <= end) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [monthAnchor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, typeof postsQ.data>();
    for (const p of postsQ.data) {
      const key = format(new Date(p.scheduled_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [postsQ.data]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMonthAnchor((m) => addMonths(m, -1))}>‹</Button>
          <div className="min-w-[10rem] text-center text-sm font-medium">{format(monthAnchor, "MMMM yyyy")}</div>
          <Button variant="ghost" size="sm" onClick={() => setMonthAnchor((m) => addMonths(m, 1))}>›</Button>
        </div>
        <Button size="sm" onClick={() => setOpenDate(new Date())}>
          <Plus className="mr-1 h-4 w-4" /> New post
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-secondary/60 px-2 py-2 text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, monthAnchor);
          const key = format(d, "yyyy-MM-dd");
          const posts = postsByDay.get(key) ?? [];
          return (
            <button
              key={d.toISOString()}
              onClick={() => setOpenDate(d)}
              className={`min-h-[6rem] bg-background p-2 text-left transition hover:bg-secondary/50 ${inMonth ? "" : "text-muted-foreground/60"}`}
            >
              <div className={`text-xs ${isSameDay(d, new Date()) ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}>
                {format(d, "d")}
              </div>
              <div className="mt-1 space-y-1">
                {posts.slice(0, 3).map((p) => (
                  <div key={p.id} className="truncate rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                    {format(new Date(p.scheduled_at), "HH:mm")} · {p.caption.slice(0, 20) || "Video post"}
                  </div>
                ))}
                {posts.length > 3 && <div className="text-[10px] text-muted-foreground">+{posts.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>

      <PostDialog
        accountId={accountId}
        open={openDate !== null}
        initialDate={openDate}
        onClose={() => setOpenDate(null)}
        onCreated={() => { queryClient.invalidateQueries({ queryKey: ["posts", accountId] }); }}
      />
    </div>
  );
}
