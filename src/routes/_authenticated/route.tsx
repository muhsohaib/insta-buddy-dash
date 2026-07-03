import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  useAuth,
  useOrganization,
  useOrganizationList,
  CreateOrganization,
} from "@clerk/tanstack-react-start";
import { ensureMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Wait for Clerk to hydrate on the client, then check the session.
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
  const { isLoaded: orgListLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: false },
  });
  const ensureProfileFn = useServerFn(ensureMyProfile);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      ensureProfileFn().catch((err) => console.error("ensureMyProfile failed", err));
    }
  }, [isLoaded, isSignedIn, ensureProfileFn]);

  // If the user has memberships but no active org, activate the first one.
  useEffect(() => {
    if (!orgListLoaded || !setActive) return;
    if (organization) return;
    const first = userMemberships?.data?.[0];
    if (first) {
      void setActive({ organization: first.organization.id });
    }
  }, [orgListLoaded, organization, userMemberships, setActive]);

  if (!isLoaded || !orgLoaded || !orgListLoaded) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isSignedIn) {
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  }

  // No active org AND no memberships → force organization creation.
  const memberships = userMemberships?.data ?? [];
  if (!organization && memberships.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-6">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Loomly organizes accounts, videos, and posts by workspace. Create one to continue.
            </p>
          </div>
          <CreateOrganization
            afterCreateOrganizationUrl="/dashboard"
            skipInvitationScreen={false}
          />
        </div>
      </div>
    );
  }

  // Memberships exist but activation hasn't landed yet — brief hold.
  if (!organization) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading workspace…</div>;
  }

  return <Outlet />;
}
