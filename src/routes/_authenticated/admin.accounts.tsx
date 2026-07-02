import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminNav } from "./admin.index";
import { adminListAccounts, adminUpdateAccountStatus } from "@/lib/admin.functions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Instagram, Globe, MapPin, Tag, User, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  component: AdminAccountsPage,
  head: () => ({ meta: [{ title: "Admin accounts — Loomly" }] }),
});

const STATUSES = ["pending_details", "creating", "warming_up", "ready", "cancelled"] as const;
type StatusKey = (typeof STATUSES)[number];

const STATUS_META: Record<StatusKey, { label: string; dot: string; text: string; bg: string }> = {
  pending_details: { label: "Awaiting details", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-secondary" },
  creating: { label: "In creation", dot: "bg-[var(--color-purple-accent)]", text: "text-[var(--color-purple-accent)]", bg: "bg-[color-mix(in_oklab,var(--color-purple-accent)_15%,transparent)]" },
  warming_up: { label: "Warming up", dot: "bg-warning", text: "text-warning", bg: "bg-[color-mix(in_oklab,var(--color-warning)_15%,transparent)]" },
  ready: { label: "Ready", dot: "bg-success", text: "text-success", bg: "bg-[color-mix(in_oklab,var(--color-success)_15%,transparent)]" },
  cancelled: { label: "Cancelled", dot: "bg-destructive", text: "text-destructive", bg: "bg-[color-mix(in_oklab,var(--color-destructive)_15%,transparent)]" },
};

function AdminAccountsPage() {
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admin</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Account submissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review each client submission and progress them through creation → warmup → ready.</p>
        </div>
        <Cards />
      </AdminGate>
    </DashboardShell>
  );
}

function Cards() {
  const listFn = useServerFn(adminListAccounts);
  const updateFn = useServerFn(adminUpdateAccountStatus);
  const queryClient = useQueryClient();
  const q = useSuspenseQuery(queryOptions({ queryKey: ["admin", "accounts"], queryFn: () => listFn() }));

  const m = useMutation({
    mutationFn: (v: { id: string; status: StatusKey }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "accounts"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (q.data.length === 0) {
    return (
      <div className="soft-card grid place-items-center p-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
          <User className="h-6 w-6" />
        </div>
        <h2 className="mt-6 text-xl font-semibold">No submissions yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">Client account submissions will appear here for you to progress through the pipeline.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {q.data.map((a, i) => {
        const d = Array.isArray(a.account_details) ? a.account_details[0] : a.account_details;
        const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        const meta = STATUS_META[a.status as StatusKey] ?? STATUS_META.pending_details;
        const title = d?.app_name || a.label || "Instagram account";
        const nextStep = a.status === "creating" ? "warming_up" : a.status === "warming_up" ? "ready" : null;

        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="soft-card overflow-hidden"
          >
            <div className="flex items-start gap-4 p-5">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full gradient-accent text-background ring-2 ring-hairline">
                {d?.profile_photo_url ? (
                  <img
                    src={d.profile_photo_url}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <Instagram className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">{title}</div>
                {d?.ig_username && <div className="truncate text-xs text-muted-foreground">@{d.ig_username}</div>}
                <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </div>
              </div>
            </div>

            <div className="border-t border-hairline bg-secondary/30 px-5 py-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="truncate font-medium text-foreground">{p?.full_name || "No name"}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{p?.email || "—"}</span>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-hairline p-5 text-xs">
              {d ? (
                <>
                  <Row icon={<Tag className="h-3.5 w-3.5" />} label="Niche" value={d.niche} />
                  <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Country" value={d.target_country} />
                  {d.website && (
                    <Row
                      icon={<Globe className="h-3.5 w-3.5" />}
                      label="Site"
                      value={
                        <a href={d.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-cyan-accent)] hover:underline">
                          {d.website.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                        </a>
                      }
                    />
                  )}
                  {d.bio && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bio</div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/90">{d.bio}</p>
                    </div>
                  )}
                  {d.competitors && d.competitors.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Competitors</div>
                      <ul className="mt-1 space-y-0.5">
                        {d.competitors.map((c: string, idx: number) => (
                          <li key={idx} className="truncate text-foreground/90">{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.notes && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/90">{d.notes}</p>
                    </div>
                  )}
                  {d.profile_photo_url && (
                    <a href={d.profile_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-cyan-accent)] hover:underline">
                      Open photo <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Client hasn't submitted details yet.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-hairline bg-background/50 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Set status</div>
                <Select
                  value={a.status}
                  onValueChange={(v) => m.mutate({ id: a.id, status: v as StatusKey })}
                >
                  <SelectTrigger className="mt-1 h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {nextStep && (
                <button
                  onClick={() => m.mutate({ id: a.id, status: nextStep as StatusKey })}
                  disabled={m.isPending}
                  className="inline-flex h-9 items-center gap-1.5 self-end rounded-xl gradient-accent px-3 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark {STATUS_META[nextStep as StatusKey].label}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}: </span>
        <span className="text-foreground/90">{value}</span>
      </div>
    </div>
  );
}
