import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Loomly" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const redirect = sessionStorage.getItem("loomly:postAuthRedirect") || "/dashboard";
        sessionStorage.removeItem("loomly:postAuthRedirect");
        navigate({ to: redirect });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const redirect = sessionStorage.getItem("loomly:postAuthRedirect") || "/dashboard";
        sessionStorage.removeItem("loomly:postAuthRedirect");
        navigate({ to: redirect });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signInGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Sign-in failed. Try again.");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-[360px] w-[360px] rounded-full ambient-cyan blur-2xl opacity-70 animate-float-slow" />
        <div className="absolute -bottom-32 right-10 h-[420px] w-[420px] rounded-full ambient-purple blur-2xl opacity-70 animate-float-slow" style={{ animationDelay: "-4s" }} />
      </div>

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg gradient-accent" />
          <span className="text-base font-semibold tracking-tight">Loomly</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full soft-card p-8 text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Loomly</h1>
          <p className="mt-2 text-sm text-muted-foreground">One click. Your dashboard is waiting.</p>
          <button
            onClick={signInGoogle}
            disabled={loading}
            className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:opacity-60"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-background">
              <GoogleIcon />
            </span>
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            By continuing you agree to our terms of service.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.7 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c6.9 0 9.4-4.9 9.4-8.8 0-.6-.1-1-.1-1.5H12Z" />
    </svg>
  );
}
