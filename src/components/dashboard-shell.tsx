import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth, useClerk, useUser, useOrganization, useOrganizationList } from "@clerk/tanstack-react-start";
import {
  Calendar as CalendarIcon,
  Users,
  Settings,
  LogOut,
  Shield,
  Building2,
  ChevronDown,
  Plus,
  Sparkles,
  Check,
  Package,
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardModals, useOpenModal } from "@/components/dashboard-modals";

type NavItem = { to: string; label: string; icon: typeof CalendarIcon; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Calendar", icon: CalendarIcon, exact: true },
  { to: "/dashboard/orders", label: "Orders", icon: Package },
  { to: "/dashboard/accounts", label: "Accounts", icon: Users },
];


export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const amIAdminFn = useServerFn(amIAdmin);
  const openModal = useOpenModal();
  const { data: admin } = useQuery({
    queryKey: ["me", "isAdmin"],
    queryFn: () => amIAdminFn(),
    enabled: !!isSignedIn,
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const email = user?.primaryEmailAddress?.emailAddress ?? "";


  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await clerk.signOut();
    router.navigate({ to: "/", replace: true });
  }



  const workspaceName = organization?.name ?? "Personal workspace";
  const workspaceInitial = workspaceName.charAt(0).toUpperCase();
  const memberships = userMemberships?.data ?? [];

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-hairline bg-sidebar md:flex md:flex-col">
        {/* Workspace switcher (top left) */}
        <div className="px-3 pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-xl border border-hairline bg-background/60 px-2.5 py-2 text-left transition hover:bg-secondary">
                <span className="grid h-8 w-8 place-items-center rounded-lg gradient-accent text-xs font-semibold text-background">
                  {workspaceInitial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{workspaceName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{email}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {memberships.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Workspaces
                  </DropdownMenuLabel>
                  {memberships.map((m) => {
                    const active = m.organization.id === organization?.id;
                    return (
                      <div key={m.organization.id} className="flex items-center gap-1">
                        <DropdownMenuItem
                          className="flex-1"
                          onSelect={() => {
                            if (!active && setActive) {
                              setActive({ organization: m.organization.id }).catch(() => {});
                            }
                          }}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          <span className="flex-1 truncate">{m.organization.name}</span>
                          {active && <Check className="ml-2 h-4 w-4 text-primary" />}
                        </DropdownMenuItem>
                        {active && (
                          <DropdownMenuItem
                            className="p-2"
                            onSelect={(e) => {
                              e.preventDefault();
                              openModal("workspace-settings");
                            }}
                            aria-label="Workspace settings"
                            title="Workspace settings"
                          >
                            <Settings className="h-4 w-4 text-muted-foreground" />
                          </DropdownMenuItem>
                        )}
                      </div>
                    );
                  })}

                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => clerk.openCreateOrganization?.()}>
                <Plus className="mr-2 h-4 w-4" /> Create new workspace
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openModal("pricing")}>
                <Sparkles className="mr-2 h-4 w-4" /> Upgrade
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openModal("settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3 py-2">
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

        {/* Bottom-left utility nav */}
        <div className="border-t border-hairline p-3 space-y-1">
          <button
            onClick={() => openModal("pricing")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
              <Sparkles className="h-4 w-4" />
            </span>
            Upgrade
          </button>
          <button
            onClick={() => openModal("settings")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
              <Settings className="h-4 w-4" />
            </span>
            Settings
          </button>
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
            <button
              onClick={() => openModal("pricing")}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" /> Upgrade
            </button>
            <button
              onClick={() => openModal("settings")}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>
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

      {/* URL-hash driven modals — mounted once so dashboard stays alive */}
      <DashboardModals />
    </div>
  );
}
