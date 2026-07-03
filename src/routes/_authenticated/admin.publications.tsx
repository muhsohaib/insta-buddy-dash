import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Play, X as XIcon, Download, ExternalLink } from "lucide-react";
import { useAuth } from "@clerk/tanstack-react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminGate } from "@/components/admin-gate";
import { AdminNav } from "./admin.index";
import {
  adminListPublications,
  adminTransitionPublication,
} from "@/lib/publications.functions";
import { Button } from "@/components/ui/button";

type Filter = "today" | "ready_for_publishing" | "publishing" | "failed" | "published";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "ready_for_publishing", label: "Ready" },
  { key: "publishing", label: "Publishing" },
  { key: "failed", label: "Failed" },
  { key: "published", label: "Published" },
];

export const Route = createFileRoute("/_authenticated/admin/publications")({
  component: AdminPublicationsPage,
  head: () => ({ meta: [{ title: "Publications queue — Loomly" }] }),
});

function AdminPublicationsPage() {
  return (
    <DashboardShell>
      <AdminGate>
        <AdminNav />
        <PublicationsQueue />
      </AdminGate>
    </DashboardShell>
  );
}

function PublicationsQueue() {
  const [filter, setFilter] = useState<Filter>("today");
  const listFn = useServerFn(adminListPublications);
  const transitionFn = useServerFn(adminTransitionPublication);
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const q = useSuspenseQuery(
    queryOptions({
      queryKey: ["admin", "publications", filter],
      queryFn: () => listFn({ data: { status: filter } }),
    }),
  );

  const m = useMutation({
    mutationFn: (v: {
      id: string;
      status: "publishing" | "published" | "failed" | "ready_for_publishing";
      instagram_post_url?: string;
      failure_reason?: string;
    }) => transitionFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "publications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function download(video_id: string | null, library_id: string | null) {
    if (!video_id || !library_id) return;
    const toastId = toast.loading("Preparing download…");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch(
        `/api/public/admin/bunny-download?video=${encodeURIComponent(video_id)}&library=${encodeURIComponent(library_id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${video_id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download", { id: toastId });
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {q.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No publications.
          </div>
        )}
        {q.data.map((p) => {
          type Media = {
            bunny_video_id: string | null;
            bunny_library_id: string | null;
            thumbnail_url: string | null;
            position: number;
          };
          type Acct = {
            label: string | null;
            account_details?: { ig_username: string | null; app_name: string | null }[]
              | { ig_username: string | null; app_name: string | null };
          };
          const row = p as unknown as {
            id: string;
            scheduled_at: string;
            status: string;
            caption: string;
            type: string;
            instagram_post_url: string | null;
            publication_media: Media[];
            instagram_accounts?: Acct | Acct[];
          };
          const media = (row.publication_media ?? []).slice().sort((a, b) => a.position - b.position);
          const first = media[0];
          const acct = Array.isArray(row.instagram_accounts)
            ? row.instagram_accounts[0]
            : row.instagram_accounts;
          const details = Array.isArray(acct?.account_details)
            ? acct?.account_details[0]
            : acct?.account_details;
          const handle = details?.ig_username ? `@${details.ig_username}` : details?.app_name ?? acct?.label ?? "—";
          return (
            <div
              key={row.id}
              className="flex items-start gap-4 rounded-xl border border-border bg-background p-4"
            >
              {first?.thumbnail_url ? (
                <img src={first.thumbnail_url} alt="" className="h-20 w-20 rounded-md border border-border object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-md border border-border bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">
                    {format(new Date(row.scheduled_at), "EEE, MMM d · HH:mm")}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{handle}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                    {row.type}
                  </span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                    {row.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {row.caption || <em>No caption</em>}
                </p>
                {row.instagram_post_url && (
                  <a
                    href={row.instagram_post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Instagram post
                  </a>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2">
                {first?.bunny_video_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => download(first.bunny_video_id, first.bunny_library_id)}
                  >
                    <Download className="mr-1 h-3 w-3" /> Media
                  </Button>
                )}
                {row.status === "ready_for_publishing" && (
                  <Button size="sm" onClick={() => m.mutate({ id: row.id, status: "publishing" })}>
                    <Play className="mr-1 h-3 w-3" /> Start
                  </Button>
                )}
                {row.status === "publishing" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        const url = window.prompt("Instagram post URL (optional)") ?? undefined;
                        m.mutate({
                          id: row.id,
                          status: "published",
                          instagram_post_url: url || undefined,
                        });
                      }}
                    >
                      <Check className="mr-1 h-3 w-3" /> Done
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const reason = window.prompt("Failure reason") ?? "";
                        if (!reason) return;
                        m.mutate({ id: row.id, status: "failed", failure_reason: reason });
                      }}
                    >
                      <XIcon className="mr-1 h-3 w-3" /> Fail
                    </Button>
                  </>
                )}
                {row.status === "failed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => m.mutate({ id: row.id, status: "ready_for_publishing" })}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
