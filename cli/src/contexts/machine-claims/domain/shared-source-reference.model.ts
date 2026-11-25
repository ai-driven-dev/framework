import type { HintedMessage } from "../../../shared/domain/describe-error.js";
import type { Scope } from "../../../shared/domain/scope.js";

/** The framework marketplace's reserved name at scope `"user"`: the one shared, machine-scope
 * source every project's own `references.json` claim tracks. A single predicate rather than an
 * inline check per caller, so a fourth site cannot drift onto a different spelling and skip the
 * check. The distribution owns the name; the caller hands it over. */
export function frameworkSourceIsShared(
  name: string,
  scope: Scope,
  frameworkMarketplaceName: string
): boolean {
  return name === frameworkMarketplaceName && scope === "user";
}

/**
 * Whether uninstalling `ref` here would take away a plugin another project on this machine still
 * needs: applied before driving a host's own CLI to uninstall, never after.
 *
 * Any one condition failing means uninstalling `ref` here cannot break another project, so it
 * proceeds. The caller builds `ref` from the host's own name for the source, never the
 * project's own local alias, which a host never learns.
 */
export function refAnotherProjectStillNeeds(input: {
  enablementIsMachineGlobal: boolean;
  otherProjects: readonly string[];
}): boolean {
  const { enablementIsMachineGlobal, otherProjects } = input;
  if (!enablementIsMachineGlobal) return false;
  return otherProjects.length > 0;
}

/**
 * The message both `clean` and `plugin remove` warn with instead of ever uninstalling `ref`, once
 * `refAnotherProjectStillNeeds` says it is guarded: the two callers differ only in how they
 * resolve the inputs, never in the sentence itself.
 */
export function describeGuardedPluginRefMessage(input: {
  binary: string;
  ref: string;
  otherProjects: readonly string[];
}): HintedMessage {
  const { binary, ref, otherProjects } = input;
  const plural = otherProjects.length === 1 ? "project" : "projects";
  const verb = otherProjects.length === 1 ? "references" : "reference";
  return {
    text:
      `${binary}: '${ref}' left enabled — ${binary} enables a plugin machine-wide, and ` +
      `${otherProjects.length} other ${plural} still ${verb} the shared source: ` +
      `${otherProjects.join(", ")} — which is why it stays`,
    hint: "full-removal",
  };
}
