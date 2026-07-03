import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, useOrganization, useOrganizationList } from "@clerk/tanstack-react-start";
import { ensureMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const clerk = (window as Window & { Clerk?: { load: () => Promise<void>; user?: unknown } }).Clerk;
    if (clerk?.load) {
      await clerk.load();
      if (!clerk.user) throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { isLoaded: listLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const ensureProfileFn = useServerFn(ensureMyProfile);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settledRef = useRef(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      ensureProfileFn().catch((err) => console.error("ensureMyProfile failed", err));
    }
  }, [isLoaded, isSignedIn, ensureProfileFn]);

  // Workspace gate: send users with no workspace to onboarding; auto-activate
  // the first workspace when the user has one but none is active.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgLoaded || !listLoaded) return;
    if (pathname.startsWith("/onboarding")) return;
    const memberships = userMemberships?.data ?? [];
    if (memberships.length === 0) {
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (!organization && !settledRef.current && setActive) {
      settledRef.current = true;
      setActive({ organization: memberships[0].organization.id }).catch((e) =>
        console.error("setActive failed", e),
      );
    }
  }, [isLoaded, isSignedIn, orgLoaded, listLoaded, userMemberships?.data, organization, setActive, pathname, navigate]);

  if (!isLoaded) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isSignedIn) {
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  }

  return <Outlet />;
}

