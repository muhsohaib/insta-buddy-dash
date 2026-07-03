import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useOrganizationList, useOrganization, useAuth } from "@clerk/tanstack-react-start";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Create your workspace — Loomly" }] }),
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const { isLoaded, createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const redirectedRef = useRef(false);

  // If user already has a workspace, skip onboarding.
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !isLoaded) return;
    if (redirectedRef.current) return;
    const memberships = userMemberships?.data ?? [];
    if (memberships.length > 0) {
      redirectedRef.current = true;
      const activeId = organization?.id ?? memberships[0].organization.id;
      (async () => {
        try {
          if (!organization || organization.id !== activeId) {
            await setActive?.({ organization: activeId });
          }
        } catch (e) {
          console.error("setActive failed", e);
        }
        navigate({ to: "/dashboard", replace: true });
      })();
    }
  }, [authLoaded, isSignedIn, isLoaded, userMemberships?.data, organization, setActive, navigate]);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createOrganization || !setActive) {
      toast.error("Workspace client not ready — please refresh and try again");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Workspace name is required");
      return;
    }
    setSubmitting(true);
    redirectedRef.current = true; // prevent the memberships effect from racing
    try {
      console.log("[onboarding] creating workspace", trimmed);
      const org = await createOrganization({ name: trimmed });
      console.log("[onboarding] workspace created", org.id);

      if (logoFile) {
        // Don't let a stuck setLogo call block onboarding.
        await Promise.race([
          org.setLogo({ file: logoFile }).catch((err) => {
            console.error("[onboarding] setLogo failed", err);
          }),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);
      }

      try {
        await setActive({ organization: org.id });
      } catch (err) {
        console.error("[onboarding] setActive failed", err);
      }

      // Hard redirect — guarantees the authenticated layout re-runs with the
      // new active organization even if TanStack's client navigation stalls.
      window.location.assign("/dashboard");
    } catch (err) {
      console.error("[onboarding] createOrganization failed", err);
      redirectedRef.current = false;
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
      setSubmitting(false);
    }
  }

  const checking = !authLoaded || !isLoaded;
  const memberships = userMemberships?.data ?? [];
  if (checking || memberships.length > 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-[360px] w-[360px] rounded-full ambient-cyan blur-2xl opacity-70 animate-float-slow" />
        <div className="absolute -bottom-32 right-10 h-[420px] w-[420px] rounded-full ambient-purple blur-2xl opacity-70 animate-float-slow" style={{ animationDelay: "-4s" }} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-lg items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full rounded-2xl border border-hairline bg-surface p-8 shadow-[0_20px_60px_-24px_var(--color-cyan-accent)]"
        >
          <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[var(--color-cyan-accent)]" />
            Welcome to Loomly
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your workspace is where your accounts, videos and scheduled posts live. You can invite teammates later.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                autoFocus
                required
                placeholder="Acme Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Workspace logo <span className="text-muted-foreground">(optional)</span></Label>
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-hairline bg-background">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickLogo}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    {logoFile ? "Change logo" : "Upload logo"}
                  </Button>
                  {logoFile && (
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="text-left text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full gradient-accent rounded-xl text-background shadow-[0_10px_30px_-8px_var(--color-cyan-accent)]"
            >
              {submitting ? "Creating…" : "Create workspace"}
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
