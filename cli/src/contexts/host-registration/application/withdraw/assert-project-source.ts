import { errorMessage } from "../../../../shared/domain/describe-error.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import { judgeRegistration, type SourceProof } from "../../domain/policy/registration-policy.js";
import type { HostPluginRegistryReading } from "../../domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceRegistration } from "../../domain/record/native-marketplace-source.js";
import { readRegistrationRecord } from "../../domain/record/registration-record.js";
import { assertSourceOwned, inspectHostSource } from "../native-marketplace-source-proof.js";
import { reachableActivator } from "../reachable-activator.js";
import type { ProjectSourceRequest, WithdrawalDeps } from "./withdrawal.js";

/** Refuses, before any change, a removal the host's own state does not prove safe. */
export async function assertProjectSource(
  deps: WithdrawalDeps,
  command: ProjectSourceRequest
): Promise<void> {
  const { tool, plugin, projectRoot } = command;
  const registrations = readRegistrationRecord(command.registrations);
  const toolId = tool.toolId;
  const activation = tool.nativeActivation();
  if (activation == null) return;
  const activator = reachableActivator(deps.ports.activators, activation.hostBinary());
  if (activator === undefined) return;
  const registration = recordedCatalogue(command, registrations);
  const ref = `${plugin.name}@${registration.hostName}`;
  const enabledByProject = registrations?.pluginRefs.includes(ref) === true;
  await assertRefOwned(command, { ref, enabledByProject });
  const proof = await inspectHostSource(deps.ports.sources.get(toolId), projectRoot, registration);
  assertSourceOwned(
    proof,
    `${toolId}: catalogue '${registration.hostName}' has unproven host source; reconcile manually.`
  );
  if (tool.pluginEnablementIsMachineGlobal() || !enabledByProject) return;
  await assertRefEnabled(deps, { toolId, ref, projectRoot, proof });
}

function recordedCatalogue(
  command: ProjectSourceRequest,
  registrations: ReturnType<typeof readRegistrationRecord>
): NativeMarketplaceRegistration {
  const { tool, plugin } = command;
  const registration = registrations?.marketplaces.find(
    (entry) => entry.alias === plugin.marketplace
  );
  if (registration === undefined)
    throw new Error(
      `${tool.toolId}: '${plugin.name}' has no recorded native catalogue source for '${plugin.marketplace}'; reconcile manually before removal.`
    );
  return registration;
}

/** Refuses a ref this project neither holds a machine claim on nor enabled itself. */
async function assertRefOwned(
  command: ProjectSourceRequest,
  held: {
    readonly ref: string;
    readonly enabledByProject: boolean;
  }
): Promise<void> {
  const { tool } = command;
  const { ref, enabledByProject } = held;
  if (tool.pluginEnablementIsMachineGlobal() && !(await command.isMachineOwned(ref)))
    throw new Error(
      `${tool.toolId}: '${ref}' is an unclaimed machine-global host ref; canonical machine claim required before removal.`
    );
  if (!enabledByProject)
    throw new Error(
      `${tool.toolId}: '${ref}' is not a ref this project enabled; reconcile manually before removal.`
    );
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
      `${toolId}: '${ref}' host plugin registry read failed (${errorMessage(error)}); uninstall refused.`
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
