import { join } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { MarketplaceScope } from "../../../../kernel/scope.js";
import type { EnvironmentReader } from "../../../tools/domain/capabilities/plugins-capability.js";
import {
  AGENT_MODELS,
  type AgentHost,
  type AgentProvider,
  supportedProvider,
} from "../../../tools/domain/formats/agent-models.js";
import {
  mainModelValues,
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../tools/domain/formats/main-model-config.js";
import { globalFilesOf, userMachineLocalFilesOf } from "../../../tools/domain/registry.js";
import type { AgentModelStore } from "../../domain/ports/agent-model-store.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { MarketplaceSyncSettings } from "../flows/marketplace-sync-settings-use-case.js";
import type { PluginUpdateUseCase } from "../plugin/plugin-update-use-case.js";

export interface SetAgentModelOptions {
  readonly projectRoot: string;
  readonly hosts: readonly AgentHost[];
  /** Absent, the hosts go back to the IDE's model. */
  readonly provider?: string;
  /** `"user"` also refreshes what `setup --global` installed; the provider and the main
   * session's model hold for the whole machine either way. */
  readonly scope: MarketplaceScope;
}

export interface SetAgentModelResult {
  /** Plugins this project re-installed with the new models. */
  readonly reinstalled: readonly string[];
  /** Each host whose main session's settings file this run changed, and that file. */
  readonly changed: readonly { readonly host: AgentHost; readonly path: string }[];
  /** Each host whose settings file was left as it is, and why. */
  readonly skipped: readonly {
    readonly host: AgentHost;
    readonly path: string;
    readonly reason: string;
  }[];
}

interface FileChange {
  readonly host: AgentHost;
  readonly path: string;
  readonly content: string | null;
}

/**
 * The setter for agent models, run once the install has succeeded. Records the provider each
 * host's agents run on, which every later build of that host applies, re-installs this
 * project's plugins so they carry it, then points the host's main session at the provider's
 * main-tier model in the host's own user settings, machine-wide like the provider and never a
 * file a project tracks, recording what that replaced so unsetting restores it.
 */
export class SetAgentModelUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly store: AgentModelStore,
    private readonly manifestRepo: ManifestRepository,
    private readonly userManifestRepo: ManifestRepository,
    private readonly pluginUpdate: Pick<PluginUpdateUseCase, "execute">,
    private readonly userPluginUpdate: Pick<PluginUpdateUseCase, "execute">,
    private readonly activation: MarketplaceSyncSettings,
    private readonly homedir: () => string,
    private readonly env: EnvironmentReader
  ) {}

  async execute(options: SetAgentModelOptions): Promise<SetAgentModelResult> {
    const chosen = this.chosenProviders(options);
    const before = await this.store.loadProviders();
    const providers = { ...before };
    for (const host of options.hosts) {
      const provider = chosen.get(host);
      if (provider === undefined) delete providers[host];
      else providers[host] = provider;
    }
    await this.store.saveProviders(providers);
    let reinstalled: readonly string[];
    try {
      reinstalled = await this.reinstall(options);
    } catch (error) {
      // A rebuild that failed leaves the machine on the provider it had.
      await this.store.saveProviders(before);
      throw error;
    }
    return { reinstalled, ...(await this.applyMainModels(options.hosts, chosen)) };
  }

  /** `clean --global`: forgets every host's provider and gives each main session back what it
   * held before AIDD, machine-wide. `dryRun` says what it would restore and changes nothing. */
  async reset(options: {
    readonly dryRun: boolean;
  }): Promise<
    Pick<SetAgentModelResult, "changed" | "skipped"> & { readonly providers: readonly AgentHost[] }
  > {
    const providers = Object.keys(await this.store.loadProviders()) as AgentHost[];
    const hosts = Object.keys(await this.store.loadMainModels()) as AgentHost[];
    const restored = await this.applyMainModels(hosts, new Map(), options.dryRun);
    if (!options.dryRun) await this.store.saveProviders({});
    return { ...restored, providers };
  }

  /** Points each host's main session at the provider, or restores what it replaced once none
   * is chosen. A settings file it cannot safely rewrite is skipped, never half-written. */
  private async applyMainModels(
    hosts: readonly AgentHost[],
    chosen: ReadonlyMap<AgentHost, AgentProvider>,
    dryRun = false
  ): Promise<Pick<SetAgentModelResult, "changed" | "skipped">> {
    const mainModels = await this.store.loadMainModels();
    const changes: FileChange[] = [];
    const skipped: { host: AgentHost; path: string; reason: string }[] = [];
    for (const host of hosts) {
      const provider = chosen.get(host);
      const record = mainModels[host];
      const current = await this.settingsPath(host);
      let path = record?.path ?? current;
      try {
        // Restored where it was written, once unset or once the host reads another file.
        if (record !== undefined && (provider === undefined || record.path !== current)) {
          const content = await this.readIfAny(record.path);
          const next = planMainModelRemoval(content, record);
          delete mainModels[host];
          if (next !== content) changes.push({ host, path: record.path, content: next });
        }
        if (provider === undefined || current === undefined) continue;
        path = current;
        const plan = planMainModelInstall(
          current,
          await this.readIfAny(current),
          mainModelValues(host, provider),
          mainModels[host]
        );
        mainModels[host] = plan.record;
        changes.push({ host, path: current, content: plan.content });
      } catch (error) {
        if (path !== undefined) skipped.push({ host, path, reason: (error as Error).message });
      }
    }
    const result = { changed: changes.map(({ host, path }) => ({ host, path })), skipped };
    if (dryRun) return result;
    // The record goes first: a run stopped between two settings files still knows what each
    // held before, so unsetting restores it instead of taking AIDD's value for the person's.
    await this.store.saveMainModels(mainModels);
    for (const { path, content } of changes) {
      if (content === null) await this.fs.deleteFile(path);
      else await this.fs.writeFile(path, content);
    }
    return result;
  }

  private async readIfAny(path: string): Promise<string | null> {
    return (await this.fs.fileExists(path)) ? this.fs.readFile(path) : null;
  }

  private chosenProviders(
    options: Pick<SetAgentModelOptions, "hosts" | "provider">
  ): Map<AgentHost, AgentProvider> {
    const chosen = new Map<AgentHost, AgentProvider>();
    if (options.provider !== undefined) {
      for (const host of options.hosts) chosen.set(host, supportedProvider(host, options.provider));
    }
    return chosen;
  }

  /** The host's own user settings file; a host declaring none there reads `main.file`, or its
   * JSONC twin when only that exists, from the directory a machine-wide install copies its
   * files into. Absent where neither exists. */
  private async settingsPath(host: AgentHost): Promise<string | undefined> {
    const settings = AGENT_MODELS.hosts[host].main;
    if (settings === undefined) return undefined;
    const home = this.homedir();
    const own = userMachineLocalFilesOf(host, home, this.env)[0];
    if (own !== undefined) return own;
    const machineDir = globalFilesOf(host)?.dir(home);
    if (machineDir === undefined) return undefined;
    const path = join(machineDir, settings.file);
    const twin = `${path}c`;
    return !(await this.fs.fileExists(path)) && (await this.fs.fileExists(twin)) ? twin : path;
  }

  /** Files a plugin wrote are rewritten from the rebuilt tree, and a host that installs plugins
   * itself is driven again, which hands it that tree. The provider is machine-wide, so this
   * project is always refreshed, and a plugin installed in the user's home, as Cursor's always
   * is, too; `--global` adds the machine-scope registrations. */
  private async reinstall(options: SetAgentModelOptions): Promise<readonly string[]> {
    const rewritten = new Set<string>();
    const userManifest = await this.userManifestRepo.load();
    const userPlugins = options.hosts.filter((host) =>
      userManifest?.getPlugins(host).some((plugin) => plugin.scope === "user")
    );
    if (userPlugins.length > 0) {
      const names = await this.userPluginUpdate.execute({
        toolIds: userPlugins,
        projectRoot: options.projectRoot,
        scope: "user",
        rebuild: true,
      });
      for (const name of names) rewritten.add(name);
    }
    const manifest = await this.manifestRepo.load();
    const installed = options.hosts.filter((host) => manifest?.hasTool(host) === true);
    const projectPlugins = installed.filter((host) =>
      manifest?.getPlugins(host).some((plugin) => plugin.scope !== "user")
    );
    if (projectPlugins.length > 0) {
      const names = await this.pluginUpdate.execute({
        toolIds: projectPlugins,
        projectRoot: options.projectRoot,
        rebuild: true,
      });
      for (const name of names) rewritten.add(name);
    }
    if (installed.length > 0) await this.activate(options.projectRoot, installed);
    if (options.scope === "user") {
      const machine = options.hosts.filter((host) => userManifest?.hasTool(host) === true);
      if (machine.length > 0) await this.activate(options.projectRoot, machine, true);
    }
    return [...rewritten];
  }

  private async activate(projectRoot: string, toolIds: AgentHost[], user = false): Promise<void> {
    const { errors } = await this.activation.execute({
      projectRoot,
      toolIds,
      ...(user ? { scope: "user" as const, manifestRepo: this.userManifestRepo } : {}),
    });
    if (errors.length > 0) throw new Error(errors.map((error) => error.message).join("\n"));
  }
}
