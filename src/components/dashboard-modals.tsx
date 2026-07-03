import { useCallback, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PricingPanel } from "@/components/pricing-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { WorkspaceSettingsPanel } from "@/components/workspace-settings-panel";

export type ModalKey = "pricing" | "settings" | "workspace-settings";

const MODAL_KEYS: ModalKey[] = ["pricing", "settings", "workspace-settings"];

function parseHash(raw: string): ModalKey | null {
  const clean = (raw ?? "").replace(/^#/, "").toLowerCase();
  return (MODAL_KEYS as string[]).includes(clean) ? (clean as ModalKey) : null;
}

/** Opens a URL-hash driven modal for #pricing / #settings / #workspace-settings
 *  while keeping the underlying dashboard route mounted. Browser back/forward
 *  toggles the modal through hash history entries. */
export function DashboardModals() {
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const active = parseHash(hash);

  const close = useCallback(() => {
    navigate({ to: ".", hash: "", replace: false });
  }, [navigate]);

  useEffect(() => {
    // no-op; kept for future analytics of modal open state
  }, [active]);

  return (
    <>
      <Dialog open={active === "pricing"} onOpenChange={(o) => (!o ? close() : undefined)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upgrade</DialogTitle>
            <DialogDescription>
              $49 per Instagram account per month. Change quantity anytime.
            </DialogDescription>
          </DialogHeader>
          <PricingPanel compact />
        </DialogContent>
      </Dialog>

      <Dialog open={active === "settings"} onOpenChange={(o) => (!o ? close() : undefined)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Manage your account preferences.</DialogDescription>
          </DialogHeader>
          <SettingsPanel />
        </DialogContent>
      </Dialog>

      <Dialog
        open={active === "workspace-settings"}
        onOpenChange={(o) => (!o ? close() : undefined)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workspace settings</DialogTitle>
            <DialogDescription>
              Invite teammates, manage roles, and update workspace details.
            </DialogDescription>
          </DialogHeader>
          <WorkspaceSettingsPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}


/** Helper to build hash-navigation props for a specific modal. */
export function useOpenModal() {
  const navigate = useNavigate();
  return useCallback(
    (key: ModalKey) => {
      navigate({ to: ".", hash: key });
    },
    [navigate],
  );
}
