import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export function CreateAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center text-xl">Add an Instagram account first</DialogTitle>
          <DialogDescription className="text-center">
            You need at least one active account to schedule posts. Pick a plan and we'll warm one up for you in a few days.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">Not now</Button>
          <Button asChild className="w-full gradient-accent text-background sm:w-auto">
            <Link to="/pricing">
              Add account <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
