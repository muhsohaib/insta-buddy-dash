import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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

const HASH_MODAL_KEYS: Exclude<ModalKey, "workspace-settings">[] = ["pricing", "settings"];

function parseHash(raw: string): Exclude<ModalKey, "workspace-settings"> | null {
  const clean = (raw ?? "").replace(/^#/, "").toLowerCase();
  return (HASH_MODAL_KEYS as string[]).includes(clean)
    ? (clean as Exclude<ModalKey, "workspace-settings">)
    : null;
}

/** Workspace-settings uses a local store instead of URL hash because Clerk's
 *  <OrganizationProfile routing="hash"> hijacks the hash to route between
 *  its own tabs (e.g. #/members), which would otherwise close the modal. */
let wsOpen = false;
const wsListeners = new Set<() => void>();
function setWorkspaceSettingsOpen(next: boolean) {
  if (wsOpen === next) return;
  wsOpen = next;
  wsListeners.forEach((l) => l());
}
function subscribeWorkspaceSettings(cb: () => void) {
  wsListeners.add(cb);
  return () => wsListeners.delete(cb);
}
function useWorkspaceSettingsOpen() {
  return useSyncExternalStore(
    subscribeWorkspaceSettings,
    () => wsOpen,
    () => false,
  );
}

/** Opens a URL-hash driven modal for #pricing / #settings while keeping the
 *  underlying dashboard route mounted. Workspace settings is opened via a
 *  local store (see note above). */
export function DashboardModals() {
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const active = parseHash(hash);
  const wsSettingsOpen = useWorkspaceSettingsOpen();

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
        open={wsSettingsOpen}
        onOpenChange={(o) => setWorkspaceSettingsOpen(o)}
      >
        <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden">
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
      if (key === "workspace-settings") {
        setWorkspaceSettingsOpen(true);
        return;
      }
      navigate({ to: ".", hash: key });
    },
    [navigate],
  );
}
