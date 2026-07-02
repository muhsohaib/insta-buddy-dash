import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Instagram, Check, Hammer, Flame, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type PickableAccount = {
  id: string;
  username: string | null;
  label: string | null;
  status: string;
  photo: string | null;
};

const META: Record<string, { label: string; tone: string; dot: string; icon: React.ReactNode; msg: string }> = {
  ready: {
    label: "Ready",
    tone: "text-success",
    dot: "bg-success",
    icon: <Check className="h-3.5 w-3.5" />,
    msg: "Schedule a post to this account.",
  },
  warming_up: {
    label: "Warming up",
    tone: "text-warning",
    dot: "bg-warning",
    icon: <Flame className="h-3.5 w-3.5" />,
    msg: "This account is warming up. Scheduling opens as soon as warmup finishes.",
  },
  creating: {
    label: "Creating",
    tone: "text-[var(--color-purple-accent)]",
    dot: "bg-[var(--color-purple-accent)]",
    icon: <Hammer className="h-3.5 w-3.5" />,
    msg: "Our team is setting up this account. You'll be able to schedule as soon as it's ready.",
  },
  pending_details: {
    label: "Needs details",
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground",
    icon: <Hammer className="h-3.5 w-3.5" />,
    msg: "Finish onboarding for this account to start scheduling.",
  },
  cancelled: {
    label: "Suspended",
    tone: "text-destructive",
    dot: "bg-destructive",
    icon: <Hammer className="h-3.5 w-3.5" />,
    msg: "This account is suspended.",
  },
};

export function PickAccountDialog({
  open,
  onClose,
  accounts,
  onPickReady,
}: {
  open: boolean;
  onClose: () => void;
  accounts: PickableAccount[];
  onPickReady: (id: string) => void;
}) {
  const [notice, setNotice] = useState<{ id: string; status: string } | null>(null);

  function handleClose() {
    setNotice(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose an account</DialogTitle>
          <DialogDescription>Select which account you want to post to.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {accounts.map((a) => {
            const meta = META[a.status] ?? META.pending_details;
            const isReady = a.status === "ready";
            const display = a.username ? `@${a.username}` : a.label ?? "Instagram account";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  if (isReady) {
                    onPickReady(a.id);
                    handleClose();
                  } else {
                    setNotice({ id: a.id, status: a.status });
                  }
                }}
                className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  isReady
                    ? "border-hairline hover:border-[var(--color-cyan-accent)] hover:bg-surface-2/60"
                    : "border-hairline bg-surface-2/40 hover:bg-surface-2/70"
                }`}
              >
                <div className="relative">
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full gradient-accent text-background ring-2 ring-hairline">
                    {a.photo ? (
                      <img src={a.photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Instagram className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background ${meta.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{display}</div>
                  <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${meta.tone}`}>
                    {meta.icon}
                    {meta.label}
                  </div>
                </div>
                <ArrowRight className={`h-4 w-4 transition ${isReady ? "text-muted-foreground group-hover:translate-x-0.5 group-hover:text-[var(--color-cyan-accent)]" : "text-muted-foreground/50"}`} />
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="mt-3 flex items-start gap-3 rounded-xl border border-hairline bg-surface-2/60 p-3"
            >
              <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg gradient-accent text-background">
                {META[notice.status]?.icon}
              </div>
              <div className="flex-1 text-sm">
                <div className={`text-xs font-semibold uppercase tracking-wider ${META[notice.status]?.tone}`}>
                  {META[notice.status]?.label}
                </div>
                <div className="mt-0.5 text-foreground/80">{META[notice.status]?.msg}</div>
                {notice.status === "pending_details" && (
                  <Link
                    to="/dashboard/accounts/$id"
                    params={{ id: notice.id }}
                    onClick={handleClose}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-cyan-accent)]"
                  >
                    Finish setup <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
