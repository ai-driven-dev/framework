/** Whether a host's own CLI confirmed a call, and when it did not, the warning that says why. */
export type Confirmation =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly warning: string };

/** The warning a skipped native step carries: which step, and the host's reason. */
export const skippedWarning = (label: string) => (reason: string) =>
  `Native plugin activation — ${label} skipped: ${reason}`;
