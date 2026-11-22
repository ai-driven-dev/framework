import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { ActiveMachineDependentsError } from "../../domain/installation.error.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { MachineClaimsReading } from "../../ports/machine-claims-reading.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  NativeRefClaim,
  RegistrationRecordData,
  RegistrationRecords,
} from "../../ports/record/registration-records.js";
import type { HostRefCountingTool } from "../../ports/tool-sections.js";
import type { UserScopePluginFileRemoval } from "../../ports/user-scope-plugin-files.js";
import type { RegisteredMarketplace } from "../sync/record-activation.use-case.js";

type PluginOf = { toolId: AiToolId; plugin: InstalledPlugin; recorded: RecordedPlugin };
type NativeOf = {
  toolId: AiToolId;
  registrations: RegistrationRecordData;
  registration: RegisteredMarketplace;
};

/** One tool's record of the catalogue being removed. */
export interface MarketplaceHostTarget {
  readonly tool: HostRefCountingTool;
  readonly registrations: RegistrationRecordData;
  readonly registration: NativeOf["registration"];
}

/** The host's side of a catalogue removal, the caller's: every plan is made before any is
 * applied, so a host that refuses stops the removal before anything is withdrawn. */
export interface MarketplaceHostRemoval<Plan> {
  plan(target: MarketplaceHostTarget): Promise<Plan>;
  apply(plan: Plan): void | Promise<void>;
}

/** What a catalogue removal asks of a tool's record, the caller's to answer. */
export interface MarketplaceRecords extends Pick<MachineClaimsReading, "holdersOf"> {
  /** The registration the alias stands for, `undefined` when it was never registered. */
  registrationOf(
    registrations: RegistrationRecordData,
    alias: string
  ): RegisteredMarketplace | undefined;
  /** The claims on the refs sitting on the host name the alias was registered under. */
  claimsOn(registrations: RegistrationRecordData, alias: string): readonly NativeRefClaim[];
  /** The record without the marketplace, nor any ref or claim on its host name. */
  withoutMarketplace(registrations: RegistrationRecordData, alias: string): RegistrationRecordData;
}

export interface PurgeMarketplacePluginsRequest<Plan> {
  marketplace: string;
  projectRoot: string;
  home: string;
  /** Runs once the machine lock is held, before anything is read from the user record. */
  whileLocked: () => Promise<void>;
  /** Runs once the plugins and host claims are gone, before the user record is saved. */
  forget: () => Promise<void>;
  hostRemoval: MarketplaceHostRemoval<Plan>;
  records: MarketplaceRecords;
}

/** What PurgeMarketplacePlugins is built from. */
export interface PurgeMarketplacePluginsDeps {
  readonly repo: ManifestRepository & Lock;
  readonly userScopePluginFiles: UserScopePluginFileRemoval;
}

/** Removes everything the machine holds on behalf of one user-scope marketplace: the plugins
 * installed from it, and the host's catalogue and plugin claims, once none is still in use. */
export class PurgeMarketplacePlugins {
  constructor(
    private readonly deps: PurgeMarketplacePluginsDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** The count of plugins and host plugin references removed. */
  async execute<Plan>(command: PurgeMarketplacePluginsRequest<Plan>): Promise<number> {
    return this.deps.repo.withExclusiveAccess(() => this.purgeLocked(command));
  }

  private async purgeLocked<Plan>(command: PurgeMarketplacePluginsRequest<Plan>): Promise<number> {
    const { marketplace, projectRoot, home, records } = command;
    await command.whileLocked();
    const manifest = await this.deps.repo.load();
    if (manifest === null)
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no user manifest.`
      );
    const held = { manifest, registered: await this.deps.repo.loadRecords() };
    const { plugins, native, nativeRefs } = this.claimsOn(held, marketplace, records);
    const holders = records.holdersOf(
      plugins.map(({ recorded }) => recorded),
      nativeRefs
    );
    if (holders.length > 0)
      throw new ActiveMachineDependentsError(`user-scope marketplace '${marketplace}'`, holders);
    const safeFiles = await this.proveFiles(plugins, home);
    await this.withdrawFromHosts(native, command.hostRemoval);
    const where = { projectRoot, home };
    for (const { toolId, plugin, files } of safeFiles) {
      await this.deps.userScopePluginFiles.remove(files, this.tools.aiProfile(toolId), where);
      manifest.removePlugin(toolId, plugin.name);
    }
    for (const { toolId, registrations, registration } of native) {
      held.registered.set(toolId, records.withoutMarketplace(registrations, registration.alias));
    }
    await command.forget();
    await this.deps.repo.saveRecords(held.registered);
    await this.deps.repo.save(manifest);
    return plugins.length + nativeRefs.length;
  }

  private async withdrawFromHosts<Plan>(
    native: readonly NativeOf[],
    hostRemoval: MarketplaceHostRemoval<Plan>
  ): Promise<void> {
    const plans = await Promise.all(
      native.map(({ toolId, registrations, registration }) =>
        hostRemoval.plan({ tool: this.tools.aiProfile(toolId), registrations, registration })
      )
    );
    for (const plan of plans) await hostRemoval.apply(plan);
  }

  private claimsOn(
    { manifest, registered }: { manifest: Manifest; registered: RegistrationRecords },
    marketplace: string,
    records: MarketplaceRecords
  ) {
    const plugins: PluginOf[] = this.tools.idsInCanonicalOrder("ai").flatMap((toolId) =>
      manifest
        .getRecordedPlugins(toolId)
        .filter((p) => p.plugin.scope === "user" && p.marketplace === marketplace)
        .map((recorded) => ({ toolId, recorded, plugin: recorded.plugin }))
    );
    const native = this.tools.idsInCanonicalOrder("ai").flatMap((toolId) => {
      const registrations = registered.get(toolId);
      if (registrations === undefined) return [];
      const registration = records.registrationOf(registrations, marketplace);
      return registration === undefined ? [] : [{ toolId, registrations, registration }];
    });
    if (plugins.length === 0 && native.length === 0) {
      throw new Error(
        `Cannot prove AIDD ownership of user-scope marketplace '${marketplace}': no canonical plugin or host catalogue claim.`
      );
    }
    const nativeRefs = native.flatMap(({ registrations }) =>
      records.claimsOn(registrations, marketplace)
    );
    return { plugins, native, nativeRefs };
  }

  private proveFiles(plugins: readonly PluginOf[], home: string) {
    return Promise.all(
      plugins.map(async ({ toolId, plugin }) => {
        const files = await this.deps.userScopePluginFiles.proven(
          plugin,
          this.tools.aiProfile(toolId),
          home
        );
        if (files.size !== plugin.files.size)
          throw new Error(
            `Refusing partial user-scope marketplace removal: '${plugin.name}' has a tracked file outside its boundary.`
          );
        return { toolId, plugin, files };
      })
    );
  }
}
