import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { amIAdmin, adminListClients } from "@/lib/admin.functions";
import { AdminGate } from "@/components/admin-gate";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
  head: () => ({ meta: [{ title: "Admin — Loomly" }] }),
});

function AdminHome() {
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <ClientsTable />
      </AdminGate>
    </DashboardShell>
  );
}

export function AdminNav() {
  return (
    <div className="mb-6 flex gap-4 border-b border-border">
      {[
        { to: "/admin", label: "Clients" },
        { to: "/admin/accounts", label: "Accounts" },
        { to: "/admin/posts", label: "Scheduled posts" },
      ].map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="border-b-2 border-transparent pb-3 text-sm text-muted-foreground hover:text-foreground [&.active]:border-foreground [&.active]:text-foreground"
          activeOptions={{ exact: t.to === "/admin" }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function ClientsTable() {
  const fn = useServerFn(adminListClients);
  const q = useSuspenseQuery(queryOptions({ queryKey: ["admin", "clients"], queryFn: () => fn() }));

  const totalMRR = q.data.reduce((sum, c) => sum + (c.status === "active" ? c.quantity * 49 : 0), 0);
  const activeClients = q.data.filter((c) => c.status === "active").length;

  return (
    <>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Clients" value={q.data.length} />
        <Stat label="Active" value={activeClients} />
        <Stat label="MRR" value={`$${totalMRR.toLocaleString()}`} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Accounts</th>
              <th className="px-4 py-3 font-medium">Submitted details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.data.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.full_name || c.email}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </td>
                <td className="px-4 py-3">{c.quantity} × $49</td>
                <td className="px-4 py-3 capitalize">{c.status}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {c.account_counts.pending_details > 0 && <span className="mr-2">📝 {c.account_counts.pending_details}</span>}
                  {c.account_counts.creating > 0 && <span className="mr-2">🔨 {c.account_counts.creating}</span>}
                  {c.account_counts.warming_up > 0 && <span className="mr-2">🔥 {c.account_counts.warming_up}</span>}
                  {c.account_counts.ready > 0 && <span className="mr-2 text-emerald-700">✅ {c.account_counts.ready}</span>}
                </td>
                <td className="max-w-xl px-4 py-3 text-xs text-muted-foreground">
                  <div className="space-y-3">
                    {c.account_submissions.map((account) => {
                      const d = account.details;
                      return (
                        <div key={account.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground">
                            <span className="font-medium">{d?.app_name || account.label || "Instagram account"}</span>
                            {d?.ig_username && <span className="text-muted-foreground">@{d.ig_username}</span>}
                            <span className="rounded-md bg-background px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{account.status.replace("_", " ")}</span>
                          </div>
                          <div><b>Holder:</b> {c.full_name || "No name"} · {c.email || "No email"}</div>
                          {d ? (
                            <>
                              <div><b>Niche:</b> {d.niche}</div>
                              <div><b>Country:</b> {d.target_country}</div>
                              {d.website && <div><b>Site:</b> <a href={d.website} target="_blank" rel="noreferrer" className="underline">{d.website}</a></div>}
                              {d.bio && <div className="mt-1 whitespace-pre-wrap"><b>Bio:</b> {d.bio}</div>}
                              {d.competitors?.length > 0 && <div className="mt-1"><b>Competitors:</b> {d.competitors.join(", ")}</div>}
                              {d.notes && <div className="mt-1 whitespace-pre-wrap"><b>Notes:</b> {d.notes}</div>}
                              {d.profile_photo_url && <a href={d.profile_photo_url} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">Open photo</a>}
                            </>
                          ) : (
                            <div className="mt-1">No submission details yet.</div>
                          )}
                        </div>
                      );
                    })}
                    {c.account_submissions.length === 0 && <span>No accounts yet.</span>}
                  </div>
                </td>
              </tr>
            ))}
            {q.data.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No clients yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

// re-referenced for silence
void amIAdmin;
void useQuery;
