import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const fn = useServerFn(amIAdmin);
  const q = useQuery({ queryKey: ["me", "isAdmin"], queryFn: () => fn() });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Checking access…</p>;
  if (!q.data?.isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <h1 className="text-lg font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">This area is for the Loomly team.</p>
      </div>
    );
  }
  return <>{children}</>;
}
