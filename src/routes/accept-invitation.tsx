import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/tanstack-react-start";
import { useSignIn, useSignUp } from "@clerk/tanstack-react-start/legacy";

export const Route = createFileRoute("/accept-invitation")({
  ssr: false,
  component: AcceptInvitationPage,
  validateSearch: (search: Record<string, unknown>) => ({
    __clerk_ticket: (search.__clerk_ticket as string) ?? "",
    __clerk_status: (search.__clerk_status as string) ?? "",
    org: (search.org as string) ?? "",
    redirect: (search.redirect as string) ?? "/dashboard/organization",
  }),
  head: () => ({ meta: [{ title: "Accept invitation — Loomly" }] }),
});

function AcceptInvitationPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Accepting invitation…");

  const ticket = search.__clerk_ticket;
  const status = search.__clerk_status;
  const orgId = search.org;
  const finalRedirect = search.redirect || "/dashboard/organization";

  useEffect(() => {
    if (!ticket) {
      setError("Missing invitation ticket.");
      return;
    }

    async function activateOrgAndGo() {
      try {
        if (orgId) {
          await clerk.setActive({ organization: orgId });
        }
      } catch (e) {
        console.error("setActive org failed", e);
      }
      navigate({ to: finalRedirect, replace: true });
    }

    async function run() {
      // Already signed in: just accept via API-less flow — Clerk auto-adds
      // the user to the org when the ticket is consumed by signIn/signUp.
      // For signed-in users, we route through signIn ticket strategy to
      // consume the invitation.
      if (isSignedIn) {
        await activateOrgAndGo();
        return;
      }

      if (status === "sign_up") {
        if (!signUpLoaded || !signUp) return;
        try {
          const res = await signUp.create({ strategy: "ticket", ticket });
          if (res.status === "complete" && res.createdSessionId) {
            await setActiveSignUp({ session: res.createdSessionId });
            await activateOrgAndGo();
          } else {
            setMessage("Finish creating your account to join the workspace.");
            sessionStorage.setItem("loomly:postAuthRedirect", finalRedirect);
            navigate({
              to: "/sign-up",
              search: { __clerk_ticket: ticket, __clerk_status: status },
              replace: true,
            } as never);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to accept invitation.");
        }
        return;
      }

      // Default: sign_in ticket
      if (!signInLoaded || !signIn) return;
      try {
        const res = await signIn.create({ strategy: "ticket", ticket });
        if (res.status === "complete" && res.createdSessionId) {
          await setActiveSignIn({ session: res.createdSessionId });
          await activateOrgAndGo();
        } else {
          sessionStorage.setItem("loomly:postAuthRedirect", finalRedirect);
          navigate({ to: "/auth", replace: true });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to accept invitation.");
      }
    }

    if (authLoaded && signInLoaded && signUpLoaded) {
      void run();
    }
  }, [
    authLoaded, signInLoaded, signUpLoaded, isSignedIn, ticket, status, orgId,
    finalRedirect, signIn, signUp, setActiveSignIn, setActiveSignUp, clerk, navigate,
  ]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Joining workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? message}</p>
      </div>
    </div>
  );
}
