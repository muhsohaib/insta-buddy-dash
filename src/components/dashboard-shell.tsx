import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  Search,
  Bell,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";

type NavItem = { to: string; label: string; icon: typeof CalendarIcon; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Calendar", icon: CalendarIcon, exact: true },
  { to: "/dashboard/accounts", label: "Accounts", icon: Users },
  { to: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const amIAdminFn = useServerFn(amIAdmin);
  const { data: admin } = useQuery({
    queryKey: ["me", "isAdmin"],
    queryFn: () => amIAdminFn(),
    enabled: !!isSignedIn,
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await clerk.signOut();
    router.navigate({ to: "/", replace: true });
  }

  const initials = (name || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-hairline bg-sidebar md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="relative h-7 w-7 overflow-hidden rounded-lg gradient-accent shadow-[0_4px_12px_-4px_var(--color-cyan-accent)]">
            <div className="absolute inset-[2px] rounded-md bg-background/40" />
          </div>
          <span className="text-base font-semibold tracking-tight">Loomly</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-foreground/[0.04] ring-1 ring-inset ring-hairline"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={`relative grid h-8 w-8 place-items-center rounded-lg transition ${active ? "gradient-accent text-background shadow-[0_6px_16px_-8px_var(--color-cyan-accent)]" : "bg-secondary text-muted-foreground group-hover:text-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`relative ${active ? "text-foreground" : ""}`}>{item.label}</span>
              </Link>
            );
          })}

          {admin?.isAdmin && (
            <Link
              to="/admin"
              className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
                <Shield className="h-4 w-4" />
              </span>
              Admin
            </Link>
          )}
        </nav>

        <div className="border-t border-hairline p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
              <LogOut className="h-4 w-4" />
            </span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="md:pl-64">
        {/* Top navbar */}
        <header className="sticky top-0 z-20 border-b border-hairline glass-strong">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <div className="flex items-center gap-2 md:hidden">
              <div className="h-7 w-7 rounded-lg gradient-accent" />
              <span className="text-base font-semibold tracking-tight">Loomly</span>
            </div>

            <div className="relative hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search accounts, posts…"
                className="h-10 w-full rounded-xl border border-hairline bg-surface pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative rounded-xl">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full gradient-accent" />
              </Button>
              <div className="flex items-center gap-3 rounded-full border border-hairline bg-background pl-1 pr-3 py-1">
                <div className="grid h-7 w-7 place-items-center rounded-full gradient-accent text-xs font-semibold text-background">
                  {initials || "U"}
                </div>
                <div className="hidden text-xs leading-tight sm:block">
                  <div className="font-medium text-foreground">{name || "You"}</div>
                  <div className="text-muted-foreground">{email}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile nav */}
          <div className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-2 md:hidden">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? "gradient-accent text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="px-4 py-8 md:px-8 md:py-10"
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}
