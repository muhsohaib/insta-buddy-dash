import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
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
      // tokens set — navigate away
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-20">
        <div className="w-full rounded-2xl border border-border bg-secondary/30 p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Loomly</h1>
          <p className="mt-2 text-sm text-muted-foreground">One click. Your dashboard is waiting.</p>
          <Button size="lg" className="mt-8 w-full" onClick={signInGoogle} disabled={loading}>
            <GoogleIcon /> {loading ? "Redirecting…" : "Continue with Google"}
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">
            By continuing you agree to our terms of service.
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.7 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c6.9 0 9.4-4.9 9.4-8.8 0-.6-.1-1-.1-1.5H12Z" />
    </svg>
  );
}
