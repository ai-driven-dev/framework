import { nativeActivationWarning } from "../contract/native-activation-warning.js";
import type { HostRefusal } from "./native-refusal.js";

/** Whether a host's own CLI confirmed a call, and when it did not, the warning that says why. */
export type Confirmation =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly warning: string };

/** The warning a skipped native step carries: which step, and the host's reason. */
export const skippedWarning = (label: string) => (reason: string) =>
  nativeActivationWarning(`${label} skipped: ${reason}`);

/**
 * Confirms whether `action`, a call into a tool's own native plugin CLI, ran to completion rather
 * than being refused: a marketplace or plugin ref the host refused to drop must be told apart from
 * one it actually forgot, so a later cache purge never trusts a removal that never happened. A
 * refusal carries the caller's own warning, which `warn` receives before it returns.
 */
export function bestEffortNativeCall(
  action: () => HostRefusal,
  warningFor: (reason: string) => string,
  warn: (warning: string) => void
): Confirmation {
  const refusal = action();
  if (refusal === undefined) return { confirmed: true };
  const refused = { confirmed: false, warning: warningFor(refusal.detail) } as const;
  warn(refused.warning);
  return refused;
}
