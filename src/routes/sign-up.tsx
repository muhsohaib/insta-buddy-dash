import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SignUp, useAuth } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/sign-up")({
  ssr: false,
  component: SignUpPage,
  head: () => ({ meta: [{ title: "Create account — Loomly" }] }),
});

function SignUpPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate({ to: "/dashboard", replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <main className="relative z-10 mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-16">
        <SignUp
          routing="hash"
          signInUrl="/auth"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
        />
      </main>
    </div>
  );
}
