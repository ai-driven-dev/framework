import { join } from "node:path";
import { NativePluginCliError } from "../../../shared/domain/errors.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { HostActions } from "../contract/host-actions.js";
import type { HostMarketplaceSources } from "../contract/host-marketplace-sources.js";
import type {
  HostPluginRegistry,
  HostPluginRegistryReading,
} from "../contract/host-plugin-registry.js";
import type { RegistrationRecord } from "../contract/registration-record.js";
import { inspectNativeMarketplaceSource } from "./native-marketplace-source-proof.js";
import { resolveUninstallScopeOrder } from "./resolve-uninstall-scope.js";

/** The facts about machine-wide ownership a withdrawal depends on, none of which this context
 * may read itself: the caller answers them from where claims live. */
export interface WithdrawalClaims {
  /** Whether a canonical machine claim owns `ref`. */
  isMachineOwned(ref: string): Promise<boolean>;
  /** The warning that says why `ref` must stay enabled for another project, if it must. */
  guardMessage(
    binary: string,
    ref: string,
    alias: string,
    hostName: string
  ): Promise<string | undefined>;
  /** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
  resolveCacheCandidate(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null>;
}

/** One installed plugin the host may have registered, by aidd's own marketplace alias. */
export interface WithdrawnPlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: MarketplaceScope;
}

export interface WithdrawFromHostCommand {
  readonly tool: AiToolProfile;
  readonly plugin: WithdrawnPlugin;
  readonly projectRoot: string;
  readonly registrations: RegistrationRecord | undefined;
  readonly claims: WithdrawalClaims;
  /** Root of the host's own plugin cache; absent when the host keeps none. */
  readonly pluginCacheRoot: string | undefined;
}

export type ProjectSourceCommand = Pick<
  WithdrawFromHostCommand,
  "tool" | "projectRoot" | "registrations"
> & {
  readonly plugin: WithdrawnPlugin;
  readonly isMachineOwned: WithdrawalClaims["isMachineOwned"];
};

export interface ClaimedHostRef {
  readonly tool: AiToolId;
  readonly ref: string;
}

/** A host ref proven removable, held until every proof of the batch has passed. */
export interface ProvenHostRef {
  readonly activator: HostActions;
  readonly ref: string;
  readonly scope: MarketplaceScope;
}

/**
 * Removes a plugin ref from its host through the host's own CLI, then forgets the cache it left.
 *
 * Best-effort once the proofs pass: a host that cannot be reached warns by name with what is left
 * behind, and a removal the host's CLI did not confirm never purges the cache.
 */
export class WithdrawFromHost {
  constructor(
    private readonly fs: FileWriter,
    private readonly logger: Logger,
    /** Native plugin CLI activators keyed by `NativeActivation.hostBinary()`. */
    private readonly activators: ReadonlyMap<string, HostActions>,
    /** Host plugin registry readers, consulted so the scope asked for is the one the host holds. */
    private readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources>
  ) {}

  /** Returns `undefined` when there was nothing to undo, so no cache purge applies either;
   * otherwise whether the host's own CLI confirmed the removal. */
  async execute(command: WithdrawFromHostCommand): Promise<boolean | undefined> {
    const confirmed = await this.uninstall(command);
    if (confirmed !== undefined) await this.purgeCachedPlugin(command, confirmed);
    return confirmed;
  }

  private async uninstall(command: WithdrawFromHostCommand): Promise<boolean | undefined> {
    const { tool, plugin, projectRoot, registrations, claims } = command;
    const toolId = tool.toolId;
    const nativeActivation = tool.nativeActivation();
    if (nativeActivation == null) return undefined;
    const activator = this.activators.get(nativeActivation.hostBinary());
    if (activator === undefined) return undefined;
    if (!activator.isAvailable()) {
      const hostName = hostNameFor(registrations, plugin.marketplace) ?? plugin.marketplace;
      this.logger.warn(
        `${nativeActivation.hostBinary()} CLI not found on PATH — '${plugin.name}@${hostName}' was not uninstalled from the host; its ref may remain enabled after local removal.`
      );
      return false;
    }
    await this.assertProjectSource({
      tool,
      plugin,
      projectRoot,
      registrations,
      isMachineOwned: claims.isMachineOwned,
    });
    const alias = plugin.marketplace;
    const registeredHostName = hostNameFor(registrations, alias);
    if (registeredHostName === undefined && registrations !== undefined) {
      this.logger.warn(
        `${toolId}: this tool's own native registrations name no entry for '${alias}' — uninstalling '${plugin.name}@${alias}' by that alias rather than the host's own name for it.`
      );
    }
    const hostName = registeredHostName ?? alias;
    const ref = `${plugin.name}@${hostName}`;
    if (await claims.isMachineOwned(ref)) {
      this.logger.warn(
        `${toolId}: '${ref}' is an AIDD-owned machine plugin ref — left enabled; this project's claim detaches after local removal.`
      );
      return undefined;
    }
    if (
      registeredHostName !== undefined &&
      activator.enablesPlugins() &&
      registrations?.pluginRefs.includes(ref) !== true
    ) {
      this.logger.warn(`${toolId}: '${ref}' is not a ref this project enabled — left enabled.`);
      return undefined;
    }
    const guardMessage = await claims.guardMessage(
      nativeActivation.hostBinary(),
      ref,
      alias,
      hostName
    );
    if (guardMessage !== undefined) {
      this.logger.warn(guardMessage);
      return undefined;
    }
    return this.uninstallViaActivator(
      activator,
      nativeActivation.hostBinary(),
      ref,
      toolId,
      plugin.scope,
      projectRoot
    );
  }

  /** Refuses, before any change, a removal the host's own state does not prove safe. */
  async assertProjectSource(command: ProjectSourceCommand): Promise<void> {
    const { tool, plugin, projectRoot, registrations } = command;
    const toolId = tool.toolId;
    const activation = tool.nativeActivation();
    if (activation == null) return;
    const activator = this.activators.get(activation.hostBinary());
    if (activator === undefined || !activator.isAvailable()) return;
    const registration = registrations?.marketplaces.find(
      (entry) => entry.alias === plugin.marketplace
    );
    if (registration === undefined)
      throw new Error(
        `${toolId}: '${plugin.name}' has no recorded native catalogue source for '${plugin.marketplace}'; reconcile manually before removal.`
      );
    const ref = `${plugin.name}@${registration.hostName}`;
    if (tool.pluginEnablementIsMachineGlobal() && !(await command.isMachineOwned(ref)))
      throw new Error(
        `${toolId}: '${ref}' is an unclaimed machine-global host ref; canonical machine claim required before removal.`
      );
    if (registrations?.pluginRefs.includes(ref) !== true && activator.enablesPlugins() !== true)
      throw new Error(
        `${toolId}: '${ref}' is not a ref this project enabled; reconcile manually before removal.`
      );
    const proof = await inspectNativeMarketplaceSource(
      this.sources.get(toolId),
      projectRoot,
      registration
    );
    if (proof.status !== "owned") {
      throw new Error(
        proof.reason ??
          `${toolId}: catalogue '${registration.hostName}' has unproven host source; reconcile manually.`
      );
    }
    if (tool.pluginEnablementIsMachineGlobal() || registrations?.pluginRefs.includes(ref) !== true)
      return;
    const reader = this.pluginRegistries.get(toolId);
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
    if (current?.enabled !== true || (current.scope !== "project" && current.scope !== "user"))
      throw new Error(
        `${toolId}: '${ref}' is not provably enabled with an exact host scope (${reading.unreadable ?? reading.location}); uninstall refused.`
      );
  }

  /** Proves an AIDD-owned ref is still enabled on a reachable host and sits under a catalogue this
   * project owns, so a batch can be refused before the first host change. */
  async proveClaimedRef(
    registrations: RegistrationRecord,
    claim: ClaimedHostRef,
    projectRoot: string
  ): Promise<ProvenHostRef> {
    const activator = this.activators.get(registrations.binary);
    const reader = this.pluginRegistries.get(claim.tool);
    if (activator === undefined || !activator.isAvailable() || reader === undefined) {
      throw new Error(
        `Cannot prove or remove AIDD-owned native ref '${claim.ref}': ${registrations.binary} CLI or host registry is unavailable.`
      );
    }
    const onHost = (await reader.read(projectRoot)).refs?.get(claim.ref);
    if (onHost?.enabled !== true)
      throw new Error(
        `Cannot prove native ref '${claim.ref}' is still enabled on ${registrations.binary}; no host mutation made.`
      );
    const catalogues = registrations.marketplaces.filter((registration) =>
      claim.ref.endsWith(`@${registration.hostName}`)
    );
    if (catalogues.length !== 1) {
      throw new Error(
        `Native ref '${claim.ref}' has no exact canonical catalogue source proof; removal refused.`
      );
    }
    const proof = await inspectNativeMarketplaceSource(
      this.sources.get(claim.tool),
      projectRoot,
      catalogues[0]
    );
    if (proof.status !== "owned") {
      throw new Error(proof.reason ?? `Native ref '${claim.ref}' has unproven host source.`);
    }
    return { activator, ref: claim.ref, scope: onHost.scope ?? "user" };
  }

  uninstallProven(proven: ProvenHostRef): void {
    proven.activator.uninstallPlugin(proven.ref, proven.scope);
  }

  /**
   * Tries every scope `resolveUninstallScopeOrder` names, in order, stopping at the first the
   * host's own CLI accepts — a real `claude` binary refuses a mismatched-scope uninstall outright,
   * so a manifest whose recorded scope disagrees with what was registered gets a corrective
   * attempt rather than silently leaving the entry behind.
   */
  private async uninstallViaActivator(
    activator: HostActions,
    binary: string,
    ref: string,
    toolId: AiToolId,
    manifestScope: MarketplaceScope,
    projectRoot: string
  ): Promise<boolean> {
    if (!activator.isAvailable()) {
      this.logger.warn(
        `${binary} CLI not found on PATH — '${ref}' was not uninstalled from ${binary}'s own plugin registry and may still be enabled there.`
      );
      return false;
    }
    const reader = this.pluginRegistries.get(toolId);
    const order = await resolveUninstallScopeOrder(reader, ref, projectRoot, manifestScope);
    let lastMessage = "";
    for (const scope of order) {
      try {
        activator.uninstallPlugin(ref, scope);
        return true;
      } catch (error) {
        if (!(error instanceof NativePluginCliError)) throw error;
        lastMessage = error.message;
      }
    }
    this.logger.warn(
      `${binary} plugin uninstall '${ref}' failed: ${lastMessage} — an entry for it may remain in ${binary}'s own plugin registry.`
    );
    return false;
  }

  /**
   * `cache/<hostName>/<plugin>/` under the same declared-root-plus-`realpath` containment
   * whitelist `clean`'s own marketplace-level purge shares, but never gated on emptiness the way
   * that one is: this directory holds exactly the content the host is being asked to forget, not a
   * leftover shell another project's install could still hold. `hostName` comes from this tool's
   * own registration record, never the alias, which a host never learns.
   */
  private async purgeCachedPlugin(
    command: WithdrawFromHostCommand,
    confirmed: boolean
  ): Promise<void> {
    const { tool, plugin, registrations, claims, pluginCacheRoot } = command;
    if (pluginCacheRoot === undefined) return;
    const hostName = hostNameFor(registrations, plugin.marketplace);
    if (hostName === undefined) return;
    const label = `${tool.toolId}: cache for '${plugin.name}'`;
    const candidate = await claims.resolveCacheCandidate(
      pluginCacheRoot,
      join(hostName, plugin.name),
      label
    );
    if (candidate === null) return;
    if (!confirmed) {
      this.logger.warn(`${label} left in place, its own removal was not confirmed: ${candidate}`);
      return;
    }
    await this.fs.deleteDirectory(candidate);
    this.logger.info(`${label} purged: ${candidate}`);
  }
}

/** The host's own name for `alias`; `undefined` when `registrations` is absent or names no entry
 * for it. `alias` is aidd's own key into this project's registry, never what a host learns. */
function hostNameFor(
  registrations: RegistrationRecord | undefined,
  alias: string
): string | undefined {
  return registrations?.marketplaces.find((m) => m.alias === alias)?.hostName;
}
