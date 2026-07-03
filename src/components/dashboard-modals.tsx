import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PricingPanel } from "@/components/pricing-panel";
import { SettingsPanel, type SettingsTab } from "@/components/settings-panel";

export type ModalKey = "pricing" | "settings" | "workspace-settings";

const HASH_MODAL_KEYS: ("pricing" | "settings")[] = ["pricing", "settings"];

function parseHash(raw: string): "pricing" | "settings" | null {
  const clean = (raw ?? "").replace(/^#/, "").toLowerCase();
  return (HASH_MODAL_KEYS as string[]).includes(clean)
    ? (clean as "pricing" | "settings")
    : null;
}

/** Local store controls which tab the settings modal opens on. Using a store
 *  (not URL hash) because Clerk components inside the modal may hijack the
 *  hash for their own subroutes. */
let settingsTab: SettingsTab = "account";
const tabListeners = new Set<() => void>();
function setSettingsTab(next: SettingsTab) {
  if (settingsTab === next) return;
  settingsTab = next;
  tabListeners.forEach((l) => l());
}
function subscribeSettingsTab(cb: () => void) {
  tabListeners.add(cb);
  return () => tabListeners.delete(cb);
}
function useSettingsTab() {
  return useSyncExternalStore(
    subscribeSettingsTab,
    () => settingsTab,
    () => settingsTab,
  );
}

export function DashboardModals() {
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const active = parseHash(hash);
  const tab = useSettingsTab();

  const close = useCallback(() => {
    navigate({ to: ".", hash: "", replace: false });
  }, [navigate]);

  useEffect(() => {
    if (active !== "settings") setSettingsTab("account");
  }, [active]);

  return (
    <>
      <Dialog open={active === "pricing"} onOpenChange={(o) => (!o ? close() : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a new order</DialogTitle>
            <DialogDescription>
              Every batch of accounts is one order. Pick how many you need on the next step.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <a
              href="/dashboard/orders/new"
              onClick={close}
              className="inline-flex items-center rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-background"
            >
              Continue
            </a>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={active === "settings"} onOpenChange={(o) => (!o ? close() : undefined)}>
        <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-hidden p-0">
          <SettingsPanel
            initialTab={tab}
            onRequestClose={close}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Opens a modal. `workspace-settings` opens the shared Settings modal on
 *  the Workspace tab. */
export function useOpenModal() {
  const navigate = useNavigate();
  return useCallback(
    (key: ModalKey) => {
      if (key === "workspace-settings") {
        setSettingsTab("workspace");
        navigate({ to: ".", hash: "settings" });
        return;
      }
      if (key === "settings") setSettingsTab("account");
      navigate({ to: ".", hash: key });
    },
    [navigate],
  );
}
