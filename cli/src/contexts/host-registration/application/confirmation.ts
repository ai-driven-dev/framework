import { NativePluginCliError } from "../domain/host-registration.error.js";

/** Whether a host's own CLI confirmed a call, and when it did not, the warning that says why. */
export type Confirmation =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly warning: string };

/**
 * Runs `action`, a call into a tool's own native plugin CLI, and confirms whether it ran to
 * completion rather than throwing: a marketplace or plugin ref the host refused to drop must be
 * told apart from one it actually forgot, so a later cache purge never trusts a removal that never
 * happened. A refusal carries the caller's own warning, which `warn` receives before it returns.
 *
 * Only `NativePluginCliError` is swallowed: every throw a real activator produces is that class,
 * so anything else is a bug in the activator and must propagate.
 */
export function bestEffortNativeCall(
  action: () => void,
  warningFor: (reason: string) => string,
  warn: (warning: string) => void
): Confirmation {
  try {
    action();
    return { confirmed: true };
  } catch (error) {
    if (!(error instanceof NativePluginCliError)) throw error;
    const refused = { confirmed: false, warning: warningFor(error.message) } as const;
    warn(refused.warning);
    return refused;
  }
}

/** The warning a skipped native step carries: which step, and the host's reason. */
export const skippedWarning = (label: string) => (reason: string) =>
  `Native plugin activation \u2014 ${label} skipped: ${reason}`;
