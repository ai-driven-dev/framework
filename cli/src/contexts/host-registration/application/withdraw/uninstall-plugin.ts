import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import { readRegistrationRecord } from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import { hostNameFor, uninstallAtFirstAcceptedScope } from "./host-call.js";
import { resolveUninstallScopeOrder } from "./uninstall-scope-order.js";
import type { WithdrawalDeps, WithdrawFromHostRequest } from "./withdrawal.js";

/** Returns `undefined` when nothing was undone, else whether the host's own CLI confirmed it. */
export async function uninstallPlugin(
  deps: WithdrawalDeps,
  command: WithdrawFromHostRequest
): Promise<boolean | undefined> {
  const { tool, plugin, projectRoot } = command;
  const registrations = readRegistrationRecord(command.registrations);
  const binary = tool.nativeActivation()?.hostBinary();
  const activator = binary === undefined ? undefined : deps.ports.activators.get(binary);
  if (binary === undefined || activator === undefined) return undefined;
  if (!activator.isAvailable()) {
    const hostName = hostNameFor(registrations, plugin.marketplace) ?? plugin.marketplace;
    deps.logger.warn(
      `${binary} CLI not found on PATH — '${plugin.name}@${hostName}' was not uninstalled from the host; its ref may remain enabled after local removal.`
    );
    return false;
  }
  const ref = await refLeftEnabledUnless(deps, { command, activator, binary });
  if (ref === undefined) return undefined;
  return uninstallViaActivator(deps, {
    activator,
    binary,
    ref,
    toolId: tool.toolId,
    manifestScope: plugin.scope,
    projectRoot,
  });
}

/** The ref to uninstall, or `undefined` once a guard has named why it stays enabled. */
async function refLeftEnabledUnless(
  deps: WithdrawalDeps,
  request: {
    readonly command: WithdrawFromHostRequest;
    readonly activator: HostActions;
    readonly binary: string;
  }
): Promise<string | undefined> {
  const { command, binary } = request;
  const { tool, plugin, claims } = command;
  const toolId = tool.toolId;
  const registrations = readRegistrationRecord(command.registrations);
  const alias = plugin.marketplace;
  const registeredHostName = hostNameFor(registrations, alias);
  if (registeredHostName === undefined && registrations !== undefined) {
    deps.logger.warn(
      `${toolId}: this tool's own native registrations name no entry for '${alias}' — uninstalling '${plugin.name}@${alias}' by that alias rather than the host's own name for it.`
    );
  }
  const ref = `${plugin.name}@${registeredHostName ?? alias}`;
  if (await claims.isMachineOwned(ref)) {
    deps.logger.warn(
      `${toolId}: '${ref}' is an AIDD-owned machine plugin ref — left enabled; this project's claim detaches after local removal.`
    );
    return undefined;
  }
  if (registeredHostName !== undefined && registrations?.pluginRefs.includes(ref) !== true) {
    deps.logger.warn(`${toolId}: '${ref}' is not a ref this project enabled — left enabled.`);
    return undefined;
  }
  const guardMessage = await claims.guardMessage(binary, ref, alias);
  if (guardMessage === undefined) return ref;
  deps.logger.warn(guardMessage);
  return undefined;
}

interface UninstallRequest {
  readonly activator: HostActions;
  readonly binary: string;
  readonly ref: string;
  readonly toolId: AiToolId;
  readonly manifestScope: Scope;
  readonly projectRoot: string;
}

/**
 * Tries every scope `resolveUninstallScopeOrder` names, in order, stopping at the first the
 * host's own CLI accepts: a real `claude` binary refuses a mismatched-scope uninstall outright,
 * so a manifest whose recorded scope disagrees with what was registered gets a corrective
 * attempt rather than silently leaving the entry behind.
 */
async function uninstallViaActivator(
  deps: WithdrawalDeps,
  request: UninstallRequest
): Promise<boolean> {
  const { activator, binary, ref, toolId, manifestScope, projectRoot } = request;
  if (!activator.isAvailable()) {
    deps.logger.warn(
      `${binary} CLI not found on PATH — '${ref}' was not uninstalled from ${binary}'s own plugin registry and may still be enabled there.`
    );
    return false;
  }
  const reader = deps.ports.pluginRegistries.get(toolId);
  const order = await resolveUninstallScopeOrder({ reader, ref, projectRoot, manifestScope });
  const refusal = uninstallAtFirstAcceptedScope(activator, ref, order);
  if (refusal === undefined) return true;
  deps.logger.warn(
    `${binary} plugin uninstall '${ref}' failed: ${refusal} — an entry for it may remain in ${binary}'s own plugin registry.`
  );
  return false;
}
