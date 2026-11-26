import type { HostActions } from "../ports/host-actions.js";

/** The host's CLI for `binary` when one is wired and on the PATH, else `undefined`. */
export function reachableActivator(
  activators: ReadonlyMap<string, HostActions>,
  binary: string | undefined
): HostActions | undefined {
  const activator = binary === undefined ? undefined : activators.get(binary);
  return activator?.isAvailable() === true ? activator : undefined;
}
