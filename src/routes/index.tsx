import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Loomly — Instagram accounts + scheduling for founders" },
      { name: "description", content: "Sign in and start scheduling. Loomly creates warmed-up Instagram accounts and lets founders schedule every post in one calendar." },
    ],
  }),
});

function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
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
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full ambient-cyan animate-float-slow blur-2xl opacity-70" />
        <div className="absolute -bottom-40 -right-20 h-[520px] w-[520px] rounded-full ambient-purple animate-float-slow blur-2xl opacity-70" style={{ animationDelay: "-4s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,transparent,white_70%)]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 overflow-hidden rounded-lg gradient-accent shadow-[0_4px_12px_-4px_var(--color-cyan-accent)]">
            <div className="absolute inset-[2px] rounded-md bg-background/40" />
          </div>
          <span className="text-base font-semibold tracking-tight">Loomly</span>
        </div>
        <div className="text-xs text-muted-foreground">Instagram scheduling, done for you</div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col items-center justify-center px-6 pb-24">
        {!checking && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full text-center"
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-[var(--color-cyan-accent)]" />
              Built for B2C founders
            </div>

            <h1 className="mt-8 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
              Sign in and start <span className="gradient-text">scheduling</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              One click to your dashboard. Manage accounts, schedule posts, ship growth.
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
              className="mt-12 flex justify-center"
            >
              <button
                onClick={signInGoogle}
                disabled={loading}
                className="group relative inline-flex items-center gap-3 rounded-full bg-foreground px-8 py-4 text-base font-medium text-background shadow-[0_20px_50px_-20px_var(--color-cyan-accent)] transition hover:scale-[1.02] hover:shadow-[0_25px_60px_-15px_var(--color-cyan-accent)] active:scale-100 disabled:opacity-60"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-background">
                  <GoogleIcon />
                </span>
                <span>{loading ? "Redirecting…" : "Continue with Google"}</span>
                <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
              </button>
            </motion.div>

            <p className="mt-6 text-xs text-muted-foreground">
              By continuing you agree to our terms of service.
            </p>
          </motion.div>
        )}
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
