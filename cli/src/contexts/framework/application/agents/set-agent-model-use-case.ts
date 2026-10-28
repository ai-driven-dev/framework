import { basename, dirname, join } from "node:path";
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
  settingsFormat,
} from "../../../tools/domain/formats/main-model-config.js";
import { userMachineLocalFilesOf } from "../../../tools/domain/registry.js";
import type { AgentModelStore, MainModels } from "../../domain/ports/agent-model-store.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { MarketplaceSyncSettings } from "../flows/marketplace-sync-settings-use-case.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import type { PluginUpdateUseCase } from "../plugin/plugin-update-use-case.js";

export interface SetAgentModelOptions {
  readonly projectRoot: string;
  readonly hosts: readonly AgentHost[];
  /** Absent, the hosts go back to the session's model. */
  readonly provider?: string;
  /** Also run the main session on the provider's `smart` model. */
  readonly main?: boolean;
  /** Where the main session's settings are written; the agents' provider is machine-wide. */
  readonly scope: MarketplaceScope;
}

export interface SetAgentModelResult {
  /** The hosts whose main session now runs on the provider; a host keeping its main model in
   * no file at that scope is left out. */
  readonly mainSet: readonly AgentHost[];
  /** Plugins this project re-installed with the new models. */
  readonly reinstalled: readonly string[];
}

interface FileChange {
  readonly path: string;
  readonly content: string | null;
}

/**
 * The setter for agent models. Records the provider each host's agents run on, which every
 * build of that host then applies, re-installs this project's plugins so they carry it, and
 * optionally points the host's main session at the provider's `smart` model, recording what
 * that replaced so unsetting restores it.
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
    const chosen = new Map<AgentHost, AgentProvider>();
    if (options.provider !== undefined) {
      for (const host of options.hosts) chosen.set(host, supportedProvider(host, options.provider));
    }
    const mainModels = await this.store.loadMainModels(options.scope, options.projectRoot);
    const changes: FileChange[] = [];
    const mainSet: AgentHost[] = [];
    for (const host of options.hosts) {
      const change = await this.mainChange(options, host, chosen.get(host), mainModels);
      if (change === null) continue;
      changes.push(change);
      if (chosen.has(host)) mainSet.push(host);
    }

    const providers = await this.store.loadProviders();
    for (const host of options.hosts) {
      const provider = chosen.get(host);
      if (provider === undefined) delete providers[host];
      else providers[host] = provider;
    }
    for (const { path, content } of changes) {
      if (content === null) await this.fs.deleteFile(path);
      else await this.fs.writeFile(path, content);
    }
    await this.store.saveMainModels(options.scope, options.projectRoot, mainModels);
    await this.store.saveProviders(providers);
    return { mainSet, reinstalled: await this.reinstall(options) };
  }

  /** A main model already set follows the new provider, and goes back once none is chosen. */
  private async mainChange(
    options: SetAgentModelOptions,
    host: AgentHost,
    provider: AgentProvider | undefined,
    mainModels: MainModels
  ): Promise<FileChange | null> {
    const record = mainModels[host];
    const wanted = provider !== undefined && (options.main === true || record !== undefined);
    if (!wanted && record === undefined) return null;
    const path = await this.settingsPath(options, host);
    if (path === undefined) return null;
    const format = settingsFormat(path);
    const content = (await this.fs.fileExists(path)) ? await this.fs.readFile(path) : null;
    if (!wanted && record !== undefined) {
      delete mainModels[host];
      const next = planMainModelRemoval(content, format, record);
      return next === content ? null : { path, content: next };
    }
    for (const alternative of content === null
      ? (AGENT_MODELS.hosts[host].main?.alternatives ?? [])
      : []) {
      if (await this.fs.fileExists(join(dirname(path), alternative))) {
        throw new Error(
          `Settings live in ${alternative}; move them to ${basename(path)} before setting the main model.`
        );
      }
    }
    try {
      const plan = planMainModelInstall(
        content,
        format,
        mainModelValues(host, provider as AgentProvider),
        record
      );
      mainModels[host] = plan.record;
      return { path, content: plan.content };
    } catch (error) {
      throw new Error(`Cannot set the main model in ${path}: ${(error as Error).message}`);
    }
  }

  /** Absent where the host keeps its main model in no file at that scope. */
  private async settingsPath(
    options: SetAgentModelOptions,
    host: AgentHost
  ): Promise<string | undefined> {
    const settings = AGENT_MODELS.hosts[host].main;
    if (settings === undefined) return undefined;
    if (options.scope === "project") {
      const path = join(options.projectRoot, settings.path);
      await assertProjectPathWithinRoot(this.fs, options.projectRoot, path);
      return path;
    }
    return userMachineLocalFilesOf(host, this.homedir(), this.env)[0];
  }

  /** Files a plugin wrote are rewritten from the rebuilt tree, and a host that installs plugins
   * itself is driven again, which hands it that tree. A plugin installed in the user's home,
   * as Cursor's always is, is rewritten whatever the scope. */
  private async reinstall(options: SetAgentModelOptions): Promise<readonly string[]> {
    const user = options.scope === "user";
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
    const manifest = user ? userManifest : await this.manifestRepo.load();
    const installed = options.hosts.filter((host) => manifest?.hasTool(host) === true);
    const projectPlugins = user
      ? []
      : installed.filter((host) =>
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
    if (installed.length > 0) {
      const { errors } = await this.activation.execute({
        projectRoot: options.projectRoot,
        toolIds: installed,
        ...(user ? { scope: "user" as const, manifestRepo: this.userManifestRepo } : {}),
      });
      if (errors.length > 0) throw new Error(errors.map((error) => error.message).join("\n"));
    }
    return [...rewritten];
  }
}
