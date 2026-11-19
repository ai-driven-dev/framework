import type { AiToolId } from "../../../../shared/domain/tool.js";
import { judgeRegistration, type SourceProof } from "../../domain/policy/registration-policy.js";
import type { HostPluginRegistryReading } from "../../domain/reading/plugin-registry-reading.js";
import { readRegistrationRecord } from "../../domain/record/registration-record.js";
import {
  assertSourceOwned,
  inspectNativeMarketplaceSource,
} from "../native-marketplace-source-proof.js";
import type { ProjectSourceCommand, WithdrawalDeps } from "./withdrawal.js";

/** Refuses, before any change, a removal the host's own state does not prove safe. */
export async function assertProjectSource(
  deps: WithdrawalDeps,
  command: ProjectSourceCommand
): Promise<void> {
  const { tool, plugin, projectRoot } = command;
  const registrations = readRegistrationRecord(command.registrations);
  const toolId = tool.toolId;
  const activation = tool.nativeActivation();
  if (activation == null) return;
  const activator = deps.ports.activators.get(activation.hostBinary());
  if (activator === undefined || !activator.isAvailable()) return;
  const registration = registrations?.marketplaces.find(
    (entry) => entry.alias === plugin.marketplace
  );
  if (registration === undefined)
    throw new Error(
      `${toolId}: '${plugin.name}' has no recorded native catalogue source for '${plugin.marketplace}'; reconcile manually before removal.`
    );
  const ref = `${plugin.name}@${registration.hostName}`;
  const enabledByProject = registrations?.pluginRefs.includes(ref) === true;
  if (tool.pluginEnablementIsMachineGlobal() && !(await command.isMachineOwned(ref)))
    throw new Error(
      `${toolId}: '${ref}' is an unclaimed machine-global host ref; canonical machine claim required before removal.`
    );
  if (!enabledByProject && activator.enablesPlugins() !== true)
    throw new Error(
      `${toolId}: '${ref}' is not a ref this project enabled; reconcile manually before removal.`
    );
  const proof = await inspectNativeMarketplaceSource(
    deps.ports.sources.get(toolId),
    projectRoot,
    registration
  );
  assertSourceOwned(
    proof,
    `${toolId}: catalogue '${registration.hostName}' has unproven host source; reconcile manually.`
  );
  if (tool.pluginEnablementIsMachineGlobal() || !enabledByProject) return;
  await assertRefEnabled(deps, { toolId, ref, projectRoot, proof });
}

interface RefEnabledRequest {
  readonly toolId: AiToolId;
  readonly ref: string;
  readonly projectRoot: string;
  readonly proof: SourceProof;
}

/** Refuses a ref the host's own plugin registry does not show enabled at an exact scope. */
async function assertRefEnabled(deps: WithdrawalDeps, request: RefEnabledRequest): Promise<void> {
  const { toolId, ref, projectRoot, proof } = request;
  const reader = deps.ports.pluginRegistries.get(toolId);
  if (reader === undefined)
    throw new Error(
      `${toolId}: '${ref}' has no readable host plugin registry; uninstall refused before project changes.`
    );
  let reading: HostPluginRegistryReading;
  try {
    reading = await reader.read(projectRoot);
  } catch (error) {
    throw new Error(
      `${toolId}: '${ref}' host plugin registry read failed (${error instanceof Error ? error.message : String(error)}); uninstall refused.`
    );
  }
  const current = reading.refs?.get(ref);
  const enabledWithExactScope =
    current?.enabled === true && (current.scope === "project" || current.scope === "user");
  // The source was proven owned above, so only the ref can still be refused.
  const verdict = judgeRegistration({
    intent: "withdraw-ref",
    refEnabled: enabledWithExactScope,
    source: proof,
  });
  if (verdict.outcome === "refuse")
    throw new Error(
      `${toolId}: '${ref}' is not provably enabled with an exact host scope (${reading.unreadable ?? reading.location}); uninstall refused.`
    );
}
