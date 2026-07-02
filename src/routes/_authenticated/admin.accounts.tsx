import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminNav } from "./admin.index";
import { adminListAccounts, adminUpdateAccountStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  component: AdminAccountsPage,
  head: () => ({ meta: [{ title: "Admin accounts — Loomly" }] }),
});

const STATUSES = ["pending_details", "creating", "warming_up", "ready", "cancelled"] as const;

function AdminAccountsPage() {
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <Table />
      </AdminGate>
    </DashboardShell>
  );
}

function Table() {
  const listFn = useServerFn(adminListAccounts);
  const updateFn = useServerFn(adminUpdateAccountStatus);
  const queryClient = useQueryClient();
  const q = useSuspenseQuery(queryOptions({ queryKey: ["admin", "accounts"], queryFn: () => listFn() }));

  const m = useMutation({
    mutationFn: (v: { id: string; status: (typeof STATUSES)[number] }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); queryClient.invalidateQueries({ queryKey: ["admin", "accounts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">App</th>
            <th className="px-4 py-3 font-medium">Details</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {q.data.map((a) => {
            const d = Array.isArray(a.account_details) ? a.account_details[0] : a.account_details;
            const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            return (
              <tr key={a.id} className="align-top hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{p?.full_name || p?.email}</div>
                  <div className="text-xs text-muted-foreground">{p?.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{d?.app_name ?? "—"}</div>
                  {d?.ig_username && <div className="text-xs text-muted-foreground">@{d.ig_username}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {d ? (
                    <>
                      <div><b>Niche:</b> {d.niche}</div>
                      <div><b>Country:</b> {d.target_country}</div>
                      {d.website && <div><b>Site:</b> <a href={d.website} target="_blank" rel="noreferrer" className="underline">{d.website}</a></div>}
                      {d.bio && <div className="mt-1 max-w-md whitespace-pre-wrap"><b>Bio:</b> {d.bio}</div>}
                      {d.competitors?.length > 0 && <div className="mt-1"><b>Competitors:</b> {d.competitors.join(", ")}</div>}
                      {d.notes && <div className="mt-1 max-w-md whitespace-pre-wrap"><b>Notes:</b> {d.notes}</div>}
                      {d.profile_photo_url && <a href={d.profile_photo_url} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">Photo</a>}
                    </>
                  ) : "Not submitted"}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={a.status}
                    onChange={(e) => m.mutate({ id: a.id, status: e.target.value as (typeof STATUSES)[number] })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
          {q.data.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No accounts yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
