import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Hammer, Flame } from "lucide-react";

export type AccountGateState = "none" | "creating" | "warming_up";

const CONTENT: Record<AccountGateState, {
  icon: React.ReactNode;
  title: string;
  description: string;
}> = {
  none: {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Add an Instagram account first",
    description: "You need at least one active account to schedule posts. Pick a plan and we'll warm one up for you in a few days.",
  },
  creating: {
    icon: <Hammer className="h-5 w-5" />,
    title: "Your account is being created",
    description: "Our team is setting up your Instagram account. You'll be able to schedule posts once it's ready.",
  },
  warming_up: {
    icon: <Flame className="h-5 w-5" />,
    title: "Your account is warming up",
    description: "We're warming your account to keep it safe. Scheduling opens as soon as the warmup finishes.",
  },
};

export function CreateAccountDialog({
  open,
  onClose,
  state = "none",
}: {
  open: boolean;
  onClose: () => void;
  state?: AccountGateState;
}) {
  const c = CONTENT[state];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]">
            {c.icon}
          </div>
          <DialogTitle className="text-center text-xl">{c.title}</DialogTitle>
          <DialogDescription className="text-center">{c.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            {state === "none" ? "Not now" : "Close"}
          </Button>
          {state === "none" ? (
            <Button asChild className="w-full gradient-accent text-background sm:w-auto">
              <Link to="/pricing">
                Add account <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full gradient-accent text-background sm:w-auto">
              <Link to="/dashboard/accounts">
                View accounts <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
