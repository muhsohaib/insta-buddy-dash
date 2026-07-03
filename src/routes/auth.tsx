import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SignIn, useAuth } from "@clerk/tanstack-react-start";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Loomly" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const redirect = sessionStorage.getItem("loomly:postAuthRedirect") || "/dashboard";
      sessionStorage.removeItem("loomly:postAuthRedirect");
      navigate({ to: redirect, replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-[360px] w-[360px] rounded-full ambient-cyan blur-2xl opacity-70 animate-float-slow" />
        <div className="absolute -bottom-32 right-10 h-[420px] w-[420px] rounded-full ambient-purple blur-2xl opacity-70 animate-float-slow" style={{ animationDelay: "-4s" }} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <SignIn
            routing="hash"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
          />
        </motion.div>
      </main>
    </div>
  );
}
