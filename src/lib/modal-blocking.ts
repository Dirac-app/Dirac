/** Broadcast when a blocking overlay modal opens or closes (tour gating, etc.). */

export type BlockingModalId = "shortcuts-help" | "morning-briefing";

export function notifyBlockingModalOpened(id: BlockingModalId) {
  window.dispatchEvent(
    new CustomEvent("dirac:modal-opened", { detail: { id } }),
  );
}

export function notifyBlockingModalClosed(id: BlockingModalId) {
  window.dispatchEvent(
    new CustomEvent("dirac:modal-closed", { detail: { id } }),
  );
}

export function isAiSidebarTourTooltip(id: string): boolean {
  return id === "ai_sidebar";
}
