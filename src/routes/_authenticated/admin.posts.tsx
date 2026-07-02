import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminNav } from "./admin.index";
import { adminListPosts, adminMarkPostCompleted } from "@/lib/admin.functions";
import { getBunnyDownloadUrl } from "@/lib/bunny.functions";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/posts")({
  component: AdminPostsPage,
  head: () => ({ meta: [{ title: "Admin posts — Loomly" }] }),
});

function AdminPostsPage() {
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <PostsTable />
      </AdminGate>
    </DashboardShell>
  );
}

function PostsTable() {
  const [filter, setFilter] = useState<"scheduled" | "completed" | "all">("scheduled");
  const listFn = useServerFn(adminListPosts);
  const completeFn = useServerFn(adminMarkPostCompleted);
  const downloadFn = useServerFn(getBunnyDownloadUrl);
  const queryClient = useQueryClient();

  const q = useSuspenseQuery(queryOptions({
    queryKey: ["admin", "posts", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  }));

  const m = useMutation({
    mutationFn: (id: string) => completeFn({ data: { id } }),
    onSuccess: () => { toast.success("Marked completed"); queryClient.invalidateQueries({ queryKey: ["admin", "posts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function download(video_id: string | null, library_id: string | null) {
    if (!video_id || !library_id) return;
    try {
      const { original, embed } = await downloadFn({ data: { video_id, library_id } });
      window.open(original || embed, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open download");
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["scheduled", "completed", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}>
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {q.data.map((p) => {
          const acct = Array.isArray(p.instagram_accounts) ? p.instagram_accounts[0] : p.instagram_accounts;
          const details = Array.isArray(acct?.account_details) ? acct?.account_details[0] : acct?.account_details;
          const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return (
            <div key={p.id} className="flex items-start gap-4 rounded-xl border border-border bg-background p-4">
              {p.thumbnail_url ? (
                <img src={p.thumbnail_url} alt="" className="h-20 w-20 rounded-md border border-border object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-md border border-border bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{format(new Date(p.scheduled_at), "EEE, MMM d · HH:mm")}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{details?.ig_username ? `@${details.ig_username}` : details?.app_name ?? "—"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{prof?.email}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.caption || <em>No caption</em>}</p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => download(p.bunny_video_id, p.bunny_library_id)}>
                  <Download className="mr-1 h-3 w-3" /> Video
                </Button>
                {p.bunny_video_id && p.bunny_library_id && (
                  <a href={`https://iframe.mediadelivery.net/embed/${p.bunny_library_id}/${p.bunny_video_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-md border border-input px-3 py-1 text-xs hover:bg-accent">
                    <ExternalLink className="mr-1 h-3 w-3" /> Preview
                  </a>
                )}
                {p.status === "scheduled" && (
                  <Button size="sm" onClick={() => m.mutate(p.id)}>
                    <Check className="mr-1 h-3 w-3" /> Done
                  </Button>
                )}
                {p.status === "completed" && (
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-center text-xs text-emerald-900">Completed</span>
                )}
              </div>
            </div>
          );
        })}
        {q.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No posts.</div>
        )}
      </div>
    </div>
  );
}
