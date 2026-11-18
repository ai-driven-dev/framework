import { join } from "node:path";
import { NativePluginCliError } from "../../../shared/domain/errors.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import {
  judgeConfirmation,
  judgeEmptiness,
  judgeRegistryClearance,
  type PurgeVerdict,
} from "../domain/cache-purge-policy.js";
import type { HostPluginRegistryReading } from "../domain/plugin-registry-reading.js";
import {
  type DependentClaim,
  type RegistrationRecord,
  type RegistrationRecordData,
  readRegistrationRecord,
  recordedRegistrations,
} from "../domain/registration-record.js";
import type { HostActions } from "../ports/host-actions.js";
import type { HostMarketplaceRegistry } from "../ports/host-marketplace-registry.js";
import type { HostPorts } from "../ports/host-ports.js";
import type { NativeHostTool } from "../ports/host-tool.js";
import { bestEffortNativeCall } from "./best-effort-native-call.js";
import {
  assertNoForeignNativeRefs,
  inspectNativeMarketplaceSource,
} from "./native-marketplace-source-proof.js";
import { resolveUninstallScopeOrder } from "./resolve-uninstall-scope.js";

/** The facts about machine-wide ownership a withdrawal depends on, none of which this context
 * may read itself: the caller answers them from where claims live. */
export interface WithdrawalClaims {
  /** Whether a canonical machine claim owns `ref`. */
  readonly isMachineOwned: (ref: string) => Promise<boolean>;
  /** The warning that says why `ref` must stay enabled for another project, if it must. */
  readonly guardMessage: (
    binary: string,
    ref: string,
    alias: string,
    hostName: string
  ) => Promise<string | undefined>;
  /** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
  readonly resolveCacheCandidate: (
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ) => Promise<string | null>;
}

/** One installed plugin the host may have registered, by aidd's own marketplace alias. */
export interface WithdrawnPlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly scope: MarketplaceScope;
}

export interface WithdrawFromHostCommand {
  readonly tool: NativeHostTool;
  readonly plugin: WithdrawnPlugin;
  readonly projectRoot: string;
  readonly registrations: RegistrationRecordData | undefined;
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

/** `<cacheRoot>/<relativeSegments>` once proven to sit inside `cacheRoot`, else `null`. */
export type CacheCandidateResolver = WithdrawalClaims["resolveCacheCandidate"];

/** A tool whose host holds registrations this project or machine made. */
export interface RegisteredTool {
  readonly tool: NativeHostTool;
  readonly registrations: RegistrationRecordData;
  /** Root of the host's own plugin cache; absent when the host keeps none. */
  readonly cacheRoot: string | undefined;
}

export interface ProjectRegistrationWithdrawal extends RegisteredTool {
  /** The scope this project's own manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, MarketplaceScope>;
}

export interface UserRegistrationWithdrawal extends RegisteredTool {
  /** Every ref a canonical machine claim owns for this tool. */
  readonly claimedRefs: readonly string[];
}

/** A tool a pass withdrew from, with its record as the host read it and the host names removed. */
interface RemovedFromHost {
  readonly withdrawal: RegisteredTool;
  readonly registrations: RegistrationRecord;
  readonly removedHostNames: ReadonlySet<string>;
}

/** A host ref proven removable, held until every proof of the batch has passed. */
export interface ProvenHostRef {
  readonly activator: HostActions;
  readonly ref: string;
  readonly scope: MarketplaceScope;
}

/** What a project clean depends on that this context may not read itself. */
export interface ProjectCleanFacts {
  readonly projectRoot: string;
  /** The scope each marketplace is registered at, by this project's own alias. */
  readonly marketplaceScopes: ReadonlyMap<string, MarketplaceScope>;
  /** The shared machine-scope source this project references, and who else does; absent when none. */
  readonly sharedSource:
    | { readonly alias: string; readonly otherProjects: readonly string[] }
    | undefined;
  /** The alias the framework's own marketplace is registered under. */
  readonly frameworkAlias: string;
  /** The machine-wide claims on `tool`'s refs; `undefined` when no machine record exists. */
  readonly machineClaims: (tool: AiToolId) => Promise<readonly DependentClaim[] | undefined>;
  /** Runs `action` holding the machine record's lock when there is one to lock. */
  readonly exclusive: <T>(action: () => Promise<T>) => Promise<T>;
  readonly resolveCacheCandidate: CacheCandidateResolver;
}

/**
 * Removes a plugin ref from its host through the host's own CLI, then forgets the cache it left.
 *
 * Best-effort once the proofs pass: a host that cannot be reached warns by name with what is left
 * behind, and a removal the host's CLI did not confirm never purges the cache.
 */
export class WithdrawFromHost {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger,
    private readonly ports: HostPorts
  ) {}

  /** Returns `undefined` when there was nothing to undo, so no cache purge applies either;
   * otherwise whether the host's own CLI confirmed the removal. */
  async execute(command: WithdrawFromHostCommand): Promise<boolean | undefined> {
    const confirmed = await this.uninstall(command);
    if (confirmed !== undefined) await this.purgeCachedPlugin(command, confirmed);
    return confirmed;
  }

  private async uninstall(command: WithdrawFromHostCommand): Promise<boolean | undefined> {
    const { tool, plugin, projectRoot, claims } = command;
    const registrations = readRegistrationRecord(command.registrations);
    const toolId = tool.toolId;
    const nativeActivation = tool.nativeActivation();
    if (nativeActivation == null) return undefined;
    const activator = this.ports.activators.get(nativeActivation.hostBinary());
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
    const { tool, plugin, projectRoot } = command;
    const registrations = readRegistrationRecord(command.registrations);
    const toolId = tool.toolId;
    const activation = tool.nativeActivation();
    if (activation == null) return;
    const activator = this.ports.activators.get(activation.hostBinary());
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
      this.ports.sources.get(toolId),
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
    const reader = this.ports.pluginRegistries.get(toolId);
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
    registrationData: RegistrationRecordData,
    claim: ClaimedHostRef,
    projectRoot: string
  ): Promise<ProvenHostRef> {
    const registrations = recordedRegistrations(registrationData);
    const activator = this.ports.activators.get(registrations.binary);
    const reader = this.ports.pluginRegistries.get(claim.tool);
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
      this.ports.sources.get(claim.tool),
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
    const reader = this.ports.pluginRegistries.get(toolId);
    const order = await resolveUninstallScopeOrder(reader, ref, projectRoot, manifestScope);
    const refusal = uninstallAtFirstAcceptedScope(activator, ref, order);
    if (refusal === undefined) return true;
    this.logger.warn(
      `${binary} plugin uninstall '${ref}' failed: ${refusal} — an entry for it may remain in ${binary}'s own plugin registry.`
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
    const { tool, plugin, claims, pluginCacheRoot } = command;
    const registrations = readRegistrationRecord(command.registrations);
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
    await this.deleteWhenJudged(judgeConfirmation(label, candidate, confirmed), candidate, label);
  }

  private async deleteWhenJudged(
    verdict: PurgeVerdict,
    candidate: string,
    label: string
  ): Promise<void> {
    if (!verdict.purge) {
      this.logger.warn(verdict.warning);
      return;
    }
    await this.fs.deleteDirectory(candidate);
    this.logger.info(`${label} purged: ${candidate}`);
  }

  /** Refuses, before any change, a project clean whose registrations the host no longer proves
   * this project's own: a catalogue gone or foreign, or a ref another owner holds. */
  async assertProjectRegistrationsOwned(
    withdrawals: readonly ProjectRegistrationWithdrawal[],
    facts: ProjectCleanFacts
  ): Promise<void> {
    for (const withdrawal of withdrawals) {
      const { tool } = withdrawal;
      const registrations = recordedRegistrations(withdrawal.registrations);
      const toolId = tool.toolId;
      const activator = this.ports.activators.get(registrations.binary);
      if (activator === undefined || !activator.isAvailable()) continue;
      for (const registration of registrations.marketplaces) {
        if (facts.marketplaceScopes.get(registration.alias) !== "project") continue;
        const proof = await inspectNativeMarketplaceSource(
          this.ports.sources.get(toolId),
          facts.projectRoot,
          registration
        );
        if (proof.status !== "owned") {
          throw new Error(
            proof.reason ??
              `${toolId}: catalogue '${registration.hostName}' is absent on the host; clean refused until manual reconciliation.`
          );
        }
        await assertNoForeignNativeRefs(
          this.ports.pluginRegistries.get(toolId),
          registration.hostName,
          new Set([...registrations.pluginRefs, ...(await machineRefs(facts, toolId))]),
          facts.projectRoot,
          tool
        );
      }
    }
  }

  /**
   * Asks each tool's own CLI to forget what this project registered, then purges the cache that
   * left behind. Every tool is undone before any cache is purged, and never by a direct edit of
   * the host's own registry file: that file is the host's to write.
   *
   * A tool whose binary is absent is named and left alone, so its cache is never purged either.
   */
  async withdrawProjectRegistrations(
    withdrawals: readonly ProjectRegistrationWithdrawal[],
    facts: ProjectCleanFacts
  ): Promise<void> {
    const removed: RemovedFromHost[] = [];
    for (const withdrawal of withdrawals) {
      const registrations = recordedRegistrations(withdrawal.registrations);
      const removedHostNames = await this.withdrawProjectTool(withdrawal, registrations, facts);
      if (removedHostNames !== undefined) {
        removed.push({ withdrawal, registrations, removedHostNames });
      }
    }
    await this.purgeMarketplaceCaches(removed, facts.resolveCacheCandidate);
  }

  private async withdrawProjectTool(
    withdrawal: ProjectRegistrationWithdrawal,
    registrations: RegistrationRecord,
    facts: ProjectCleanFacts
  ): Promise<ReadonlySet<string> | undefined> {
    const { binary } = registrations;
    const activator = this.ports.activators.get(binary);
    if (activator === undefined || !activator.isAvailable()) {
      this.logger.warn(
        `${binary}: registration left in place, the ${binary} CLI is not on the PATH.` +
          survivingCachePaths(withdrawal.cacheRoot, registrations)
      );
      return undefined;
    }
    // Every plugin ref uninstalled before any marketplace is removed: only Copilot
    // declares `forceRemoveArgs`, so Claude and Codex can refuse to remove a
    // marketplace that still has plugins installed from it.
    for (const ref of registrations.pluginRefs) {
      await this.uninstallProjectRef(activator, withdrawal, registrations, ref, facts);
    }
    const removedHostNames = new Set<string>();
    for (const { alias, hostName } of registrations.marketplaces) {
      if (
        await this.removeProjectMarketplace(
          activator,
          withdrawal,
          registrations,
          alias,
          hostName,
          facts
        )
      )
        removedHostNames.add(hostName);
    }
    return removedHostNames;
  }

  /**
   * Uninstalls one plugin ref at the scope it was actually registered at, never a default:
   * `resolveUninstallScopeOrder` asks the host's own registry first. A real `claude` binary
   * refuses a mismatched-scope uninstall outright, so the resolved list is tried in order until
   * one succeeds; best-effort throughout, a ref the host will not forget is named, not thrown.
   */
  private async uninstallProjectRef(
    activator: HostActions,
    withdrawal: ProjectRegistrationWithdrawal,
    registrations: RegistrationRecord,
    ref: string,
    facts: ProjectCleanFacts
  ): Promise<void> {
    const { tool } = withdrawal;
    const { binary } = registrations;
    const toolId = tool.toolId;
    const claim = (await facts.machineClaims(toolId))?.find((candidate) => candidate.ref === ref);
    if (claim !== undefined) {
      const others = claim.dependents.filter((dependent) => dependent !== facts.projectRoot);
      this.logger.warn(
        `${binary}: '${ref}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.${others.length > 0 ? ` Still needed by ${others.join(", ")}.` : ""}`
      );
      return;
    }
    if (tool.pluginEnablementIsMachineGlobal()) {
      const sharedHostName = registrations.marketplaces.find(
        (registration) => registration.alias === facts.sharedSource?.alias
      )?.hostName;
      const otherProjects =
        sharedHostName !== undefined && ref.endsWith(`@${sharedHostName}`)
          ? (facts.sharedSource?.otherProjects ?? [])
          : [];
      this.logger.warn(
        `${binary}: '${ref}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.${otherProjects.length > 0 ? ` Still needed by ${otherProjects.join(", ")}.` : ""}`
      );
      return;
    }
    const sourceRegistration = registrations.marketplaces.find((registration) =>
      ref.endsWith(`@${registration.hostName}`)
    );
    if (sourceRegistration === undefined) {
      this.logger.warn(`${binary}: '${ref}' has no recorded host catalogue — left enabled.`);
      return;
    }
    const proof = await inspectNativeMarketplaceSource(
      this.ports.sources.get(toolId),
      facts.projectRoot,
      sourceRegistration
    );
    if (proof.status !== "owned") {
      this.logger.warn(
        `${binary}: '${ref}' left enabled because its current host catalogue is unproven. ${proof.reason ?? "Reconcile manually."}`
      );
      return;
    }
    const reader = this.ports.pluginRegistries.get(toolId);
    try {
      await assertNoForeignNativeRefs(
        reader,
        sourceRegistration.hostName,
        new Set([...registrations.pluginRefs, ...(await machineRefs(facts, toolId))]),
        facts.projectRoot,
        tool
      );
    } catch (error) {
      this.logger.warn(`${binary}: '${ref}' left enabled; ${String(error)}`);
      return;
    }
    const order = await resolveUninstallScopeOrder(
      reader,
      ref,
      facts.projectRoot,
      withdrawal.refScopes.get(ref) ?? "project"
    );
    const refusal = uninstallAtFirstAcceptedScope(activator, ref, order);
    if (refusal !== undefined)
      this.logger.warn(`${binary} plugin uninstall '${ref}' failed: ${refusal}`);
  }

  // `alias` resolves this project's own registry entry, the only place its `scope` is recorded;
  // `hostName` is what reaches the host's own CLI, since a host knows a registration only by its
  // catalog's own declared name. The two differ whenever a project registers under an alias its
  // catalog does not declare, a supported capability: passing `alias` to a host-facing call
  // would ask it to remove a name it never held.
  private async removeProjectMarketplace(
    activator: HostActions,
    withdrawal: ProjectRegistrationWithdrawal,
    registrations: RegistrationRecord,
    alias: string,
    hostName: string,
    facts: ProjectCleanFacts
  ): Promise<boolean> {
    const { tool, cacheRoot } = withdrawal;
    const { binary } = registrations;
    const scope = facts.marketplaceScopes.get(alias);
    if (scope === undefined) {
      this.logger.warn(
        `${binary}: '${alias}' is no longer a registered marketplace here, so its scope cannot be resolved — its ${binary} registration was left in place.`
      );
      return false;
    }
    if (scope === "user") {
      // Machine-scope: every project on this machine shares this one registration, so a single
      // project's `clean` must never unregister it. Three things survive, not one: the host's
      // own registration, the `userConfigDir()/marketplaces.json` entry, and this tool's own
      // plugin cache, named by its absolute path when the profile declares one.
      this.logger.warn(
        `${binary}: '${hostName}' is shared by every project on this machine — left registered. ` +
          describeSharedSourceSurvival(hostName, cacheRoot, facts.sharedSource)
      );
      return false;
    }
    const remove = async (): Promise<boolean> => {
      if (tool.pluginEnablementIsMachineGlobal()) {
        const machine = await facts.machineClaims(tool.toolId);
        if (machine === undefined && alias !== facts.frameworkAlias) {
          this.logger.warn(
            `${binary}: '${hostName}' is machine-global but no user manifest can prove no other project still uses it — left registered for manual cleanup.`
          );
          return false;
        }
        const claims = (machine ?? []).filter((claim) => claim.ref.endsWith(`@${hostName}`));
        if (claims.length > 0) {
          const others = [
            ...new Set(
              claims.flatMap((claim) =>
                claim.dependents.filter((dependent) => dependent !== facts.projectRoot)
              )
            ),
          ];
          this.logger.warn(
            `${binary}: '${hostName}' carries AIDD-owned machine plugin refs — left registered for explicit user-scope removal.${others.length > 0 ? ` Still needed by ${others.join(", ")}.` : ""}`
          );
          return false;
        }
      }
      return bestEffortNativeCall(
        this.logger,
        () => activator.removeMarketplace(hostName, scope),
        `${binary} marketplace remove '${hostName}'`
      );
    };
    return facts.exclusive(remove);
  }

  /** Refuses, before any change, a user clean whose host CLI cannot be reached: nothing is
   * undone for a tool whose binary is absent, and its canonical claims are kept. */
  assertUserHostsReachable(withdrawals: readonly UserRegistrationWithdrawal[]): void {
    for (const withdrawal of withdrawals) {
      this.reachableUserActivator(withdrawal, recordedRegistrations(withdrawal.registrations));
    }
  }

  private reachableUserActivator(
    withdrawal: UserRegistrationWithdrawal,
    registrations: RegistrationRecord
  ): HostActions {
    const activator = this.ports.activators.get(registrations.binary);
    if (activator === undefined || !activator.isAvailable())
      throw new Error(
        `${describeBinaryAbsent(withdrawal, registrations)} User clean refused; canonical claims retained.`
      );
    return activator;
  }

  /** Refuses, before the first host change, a user clean whose canonical claims the host does not
   * prove: an unclaimed or ambiguous catalogue, a source this machine does not own, a foreign ref
   * under an owned catalogue, or an owned ref that is no longer enabled. */
  async proveUserRegistrations(
    withdrawals: readonly UserRegistrationWithdrawal[],
    projectRoot: string
  ): Promise<void> {
    for (const withdrawal of withdrawals) {
      const { tool, claimedRefs } = withdrawal;
      const registrations = recordedRegistrations(withdrawal.registrations);
      const toolId = tool.toolId;
      if (claimedRefs.length > 0 && registrations.marketplaces.length === 0)
        throw new Error(
          `${toolId}: native refs lack a canonical catalogue source; user clean refused.`
        );
      const hostNames = new Set<string>();
      for (const { hostName } of registrations.marketplaces) {
        if (hostNames.has(hostName))
          throw new Error(
            `${toolId}: ambiguous canonical host catalogue '${hostName}'; user clean refused.`
          );
        hostNames.add(hostName);
      }
      const claimRefs = new Set(claimedRefs);
      if (claimRefs.size !== claimedRefs.length)
        throw new Error(`${toolId}: duplicate canonical native ref claims; user clean refused.`);
      const refsByHost = new Map<string, Set<string>>(
        [...hostNames].map((hostName) => [hostName, new Set<string>()])
      );
      for (const ref of new Set([...registrations.pluginRefs, ...claimRefs])) {
        const matches = [...hostNames].filter((hostName) => ref.endsWith(`@${hostName}`));
        if (matches.length !== 1)
          throw new Error(
            `${toolId}: native ref '${ref}' lacks exactly one canonical catalogue; user clean refused.`
          );
        refsByHost.get(matches[0])?.add(ref);
      }
      for (const registration of registrations.marketplaces) {
        const proof = await inspectNativeMarketplaceSource(
          this.ports.sources.get(toolId),
          projectRoot,
          registration
        );
        if (proof.status !== "owned")
          throw new Error(proof.reason ?? `${toolId}: catalogue source unproven.`);
        const owned = new Set(
          [...claimRefs].filter((ref) => ref.endsWith(`@${registration.hostName}`))
        );
        const hostRefs = await assertNoForeignNativeRefs(
          this.ports.pluginRegistries.get(toolId),
          registration.hostName,
          owned,
          projectRoot,
          tool
        );
        for (const ref of refsByHost.get(registration.hostName) ?? []) {
          if (hostRefs.get(ref)?.enabled !== true)
            throw new Error(
              `${toolId}: owned host ref '${ref}' is not enabled; user clean refused.`
            );
        }
      }
    }
  }

  /**
   * Every claimed ref uninstalled, then every marketplace unregistered, through the host's own CLI
   * at scope `"user"`, for every tool, before any cache is purged: a host's own CLI resolves what
   * it is unregistering against the built tree still on disk, and the purge removes exactly that
   * tree. A refusal from the host throws, so the claims that remain are kept.
   */
  async withdrawUserRegistrations(
    withdrawals: readonly UserRegistrationWithdrawal[],
    resolveCacheCandidate: CacheCandidateResolver
  ): Promise<void> {
    const removed: RemovedFromHost[] = [];
    for (const withdrawal of withdrawals) {
      const registrations = recordedRegistrations(withdrawal.registrations);
      const activator = this.reachableUserActivator(withdrawal, registrations);
      const { binary, marketplaces } = registrations;
      for (const ref of withdrawal.claimedRefs) {
        const uninstalled = bestEffortNativeCall(
          this.logger,
          () => activator.uninstallPlugin(ref, "user"),
          `${binary} plugin uninstall '${ref}'`
        );
        if (!uninstalled)
          throw new Error(
            `${binary}: user clean refused after plugin uninstall '${ref}' failed; canonical claims retained.`
          );
      }
      const removedHostNames = new Set<string>();
      for (const { hostName } of marketplaces) {
        const unregistered = bestEffortNativeCall(
          this.logger,
          () => activator.removeMarketplace(hostName, "user"),
          `${binary} marketplace remove '${hostName}'`
        );
        if (!unregistered)
          throw new Error(
            `${binary}: user clean refused after marketplace remove '${hostName}' failed; canonical claims retained.`
          );
        removedHostNames.add(hostName);
      }
      removed.push({ withdrawal, registrations, removedHostNames });
    }
    await this.purgeMarketplaceCaches(removed, resolveCacheCandidate);
  }

  /** Never a tool whose binary was absent: `removed` holds only the tools a pass ran for. A tool
   * whose profile declares no plugin cache is not looked at: no path is invented for a tool that
   * never named one. */
  private async purgeMarketplaceCaches(
    removed: readonly RemovedFromHost[],
    resolveCacheCandidate: CacheCandidateResolver
  ): Promise<void> {
    for (const { withdrawal, registrations, removedHostNames } of removed) {
      const { tool, cacheRoot } = withdrawal;
      if (cacheRoot === undefined) continue;
      for (const { hostName } of registrations.marketplaces) {
        await this.purgeMarketplaceCache(
          this.ports.marketplaceRegistries.get(tool.toolId),
          cacheRoot,
          registrations.binary,
          hostName,
          removedHostNames.has(hostName),
          resolveCacheCandidate
        );
      }
    }
  }

  /**
   * A host's cache directory is indexed by a name global to the machine, not to whichever caller
   * is running, so containment alone proves the path cannot escape the declared root, never that
   * the caller still owns what sits inside it. Two proofs, one per declaration:
   *
   * - a tool whose host keeps a marketplace registry (claude) also requires a confirmed host
   *   removal, then rereads the registry: a name gone says nothing there resolves any more;
   * - a tool with a cache directory alone (codex) drives a host that deletes the cached content
   *   itself and leaves only an empty shell, measured. Emptiness proves no data would be lost,
   *   never that this caller emptied it, so the host's own confirmation is required alongside it.
   *
   * A path failing containment, a registry still naming the tenant, or a removal never confirmed
   * is left in place and named.
   */
  private async purgeMarketplaceCache(
    reader: HostMarketplaceRegistry | undefined,
    cacheRoot: string,
    binary: string,
    hostName: string,
    removed: boolean,
    resolveCacheCandidate: CacheCandidateResolver
  ): Promise<void> {
    const label = `${binary}: cache for '${hostName}'`;
    const candidate = await resolveCacheCandidate(
      cacheRoot,
      hostName,
      `${binary}: cache path for '${hostName}'`
    );
    if (candidate === null) return;
    const confirmation = judgeConfirmation(label, candidate, removed);
    if (!confirmation.purge) {
      await this.deleteWhenJudged(confirmation, candidate, label);
      return;
    }
    if (reader !== undefined) {
      const verdict = judgeRegistryClearance(binary, hostName, candidate, await reader.read());
      await this.deleteWhenJudged(verdict, candidate, label);
      return;
    }
    let entries: string[];
    try {
      entries = await this.fs.listDirectory(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    await this.deleteWhenJudged(judgeEmptiness(label, candidate, entries.length), candidate, label);
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

async function machineRefs(facts: ProjectCleanFacts, tool: AiToolId): Promise<readonly string[]> {
  return ((await facts.machineClaims(tool)) ?? []).map((claim) => claim.ref);
}

/** The first refusal message when the host accepted no scope in `order`, else `undefined`. */
function uninstallAtFirstAcceptedScope(
  activator: HostActions,
  ref: string,
  order: readonly MarketplaceScope[]
): string | undefined {
  let lastMessage = "";
  for (const scope of order) {
    try {
      activator.uninstallPlugin(ref, scope);
      return undefined;
    } catch (error) {
      if (!(error instanceof NativePluginCliError)) throw error;
      lastMessage = error.message;
    }
  }
  return lastMessage;
}

/** One marketplace's own surviving cache path: empty for a host that keeps no plugin cache. */
function survivingCachePath(hostName: string, cacheRoot: string | undefined): string {
  return cacheRoot === undefined ? "" : `, and its cache at: ${join(cacheRoot, hostName)}`;
}

/** Named for the "not on the PATH" warning: the cache a skipped tool would have had purged
 * survives silently unless this names it. */
function survivingCachePaths(
  cacheRoot: string | undefined,
  registrations: RegistrationRecord
): string {
  if (cacheRoot === undefined) return "";
  const paths = registrations.marketplaces.map((m) => join(cacheRoot, m.hostName));
  return paths.length === 0 ? "" : ` Its cache survives at: ${paths.join(", ")}.`;
}

/** What survives a shared registration this run left in place, plus which other projects still
 * claim the shared source: purging it is a machine-scope decision, not one project's `clean`. */
function describeSharedSourceSurvival(
  hostName: string,
  cacheRoot: string | undefined,
  sharedSource: ProjectCleanFacts["sharedSource"]
): string {
  const base = `Its entry survives at userConfigDir()/marketplaces.json${survivingCachePath(hostName, cacheRoot)}.`;
  if (sharedSource === undefined) return base;
  const { otherProjects } = sharedSource;
  if (otherProjects.length > 0) {
    const plural = otherProjects.length === 1 ? "project" : "projects";
    return `${base} Still referenced by ${otherProjects.length} other ${plural} on this machine.`;
  }
  return `${base} No project on this machine still references it — \`aidd clean --scope user\` is what purges it for the machine.`;
}

/** Named so a binary this run cannot reach still tells a person what it left standing: the
 * marketplace and plugin-ref counts, plus the host's own cache path when it keeps one. */
function describeBinaryAbsent(
  withdrawal: UserRegistrationWithdrawal,
  registrations: RegistrationRecord
): string {
  const { cacheRoot, claimedRefs } = withdrawal;
  const { binary } = registrations;
  const base =
    `${binary}: registration left in place, the ${binary} CLI is not on the PATH. ` +
    `It would have unregistered ${registrations.marketplaces.length} marketplace(s) ` +
    `and ${claimedRefs.length} plugin ref(s).`;
  if (cacheRoot === undefined) return base;
  const paths = registrations.marketplaces.map((m) => join(cacheRoot, m.hostName));
  if (paths.length === 0) return base;
  return `${base} Its cache survives at: ${paths.join(", ")}.`;
}
