import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutGrid, CreditCard, Settings, LogOut, Shield } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string>("");
  const router = useRouter();
  const queryClient = useQueryClient();
  const amIAdminFn = useServerFn(amIAdmin);
  const { data: admin } = useQuery({ queryKey: ["me", "isAdmin"], queryFn: () => amIAdminFn() });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary" />
            <span className="text-base font-semibold tracking-tight">Loomly</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavItem to="/dashboard" icon={<LayoutGrid className="h-4 w-4" />}>Accounts</NavItem>
            <NavItem to="/dashboard/billing" icon={<CreditCard className="h-4 w-4" />}>Billing</NavItem>
            <NavItem to="/dashboard/settings" icon={<Settings className="h-4 w-4" />}>Settings</NavItem>
            {admin?.isAdmin && (
              <NavItem to="/admin" icon={<Shield className="h-4 w-4" />}>Admin</NavItem>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:block">{email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground" activeOptions={{ exact: to === "/dashboard" }}>
      {icon}
      {children}
    </Link>
  );
}
