import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/tanstack-react-start";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
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
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate({ to: "/dashboard", replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full ambient-cyan animate-float-slow blur-2xl opacity-70" />
        <div className="absolute -bottom-40 -right-20 h-[520px] w-[520px] rounded-full ambient-purple animate-float-slow blur-2xl opacity-70" style={{ animationDelay: "-4s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,transparent,white_70%)]" />
      </div>

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
            className="mt-12 flex flex-wrap justify-center gap-3"
          >
            <Link
              to="/auth"
              className="inline-flex items-center gap-3 rounded-full bg-foreground px-8 py-4 text-base font-medium text-background shadow-[0_20px_50px_-20px_var(--color-cyan-accent)] transition hover:scale-[1.02] active:scale-100"
            >
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="inline-flex items-center gap-3 rounded-full border border-border bg-background px-8 py-4 text-base font-medium text-foreground transition hover:bg-secondary"
            >
              Create account
            </Link>
          </motion.div>

          <p className="mt-6 text-xs text-muted-foreground">
            By continuing you agree to our terms of service.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
