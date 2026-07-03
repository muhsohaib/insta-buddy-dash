import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@clerk/tanstack-react-start";
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
  const ensureProfileFn = useServerFn(ensureMyProfile);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      ensureProfileFn().catch((err) => console.error("ensureMyProfile failed", err));
    }
  }, [isLoaded, isSignedIn, ensureProfileFn]);

  if (!isLoaded) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isSignedIn) {
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  }

  return <Outlet />;
}
