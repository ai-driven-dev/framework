import { isAbsolute } from "node:path";
import type { TrustPluginSource } from "../../contexts/distribution/application/plugin-source/trust-plugin-source.js";
import type { PluginAdd } from "../../contexts/installation/application/plugin/add-plugin.js";
import type {
  PlanPluginInstall,
  PlanPluginInstallCommand,
} from "../../contexts/installation/application/plugin/plan-plugin-install.js";
import { parsePluginSpec } from "../../contexts/installation/contract/plugin-spec.js";
import { InteractiveOnlyError } from "../../shared/domain/errors.js";
import { parsePluginSourceShorthand } from "../../shared/domain/source.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { PluginInstallFromMarketplace } from "./install-from-marketplace.js";

export interface PluginInstallOptions {
  pluginArg: string | undefined;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  fromMarketplace?: string;
  yes?: boolean;
  scope?: PlanPluginInstallCommand["scope"];
}

export interface PluginInstallResult {
  kind: "picked" | "local" | "marketplace";
  installed: readonly string[];
}

/** Picking a plugin interactively, as the install command needs it: ask, get a choice back. */
export interface PickPlugin {
  execute(options: {
    toolIds: AiToolId[] | "all";
    projectRoot: string;
    interactive: boolean;
  }): Promise<{ installed: readonly string[] }>;
}

/** Installs a plugin the way `plugin install` was asked: picked, from a source, or by name. */
export class InstallPlugin {
  constructor(
    private readonly planPluginInstall: Pick<PlanPluginInstall, "execute">,
    private readonly pickPlugin: PickPlugin,
    private readonly addPlugin: PluginAdd,
    private readonly installFromMarketplace: PluginInstallFromMarketplace,
    private readonly trustPluginSource: Pick<TrustPluginSource, "execute">
  ) {}

  async execute(options: PluginInstallOptions): Promise<PluginInstallResult> {
    if (options.scope !== undefined) {
      await this.planPluginInstall.execute({
        toolIds: options.toolIds,
        scope: options.scope,
      });
    }
    if (options.pluginArg === undefined) return this.executeNoArg(options);
    if (this.isSourceArg(options.pluginArg)) return this.executeLocalSource(options);
    return this.executeMarketplace(options);
  }

  private isSourceArg(arg: string): boolean {
    // `isAbsolute` also catches a Windows-rooted path (`C:\...`, `\\server\share`), which
    // `startsWith("/")` never does - without it, a local Windows source falls through to
    // the marketplace branch below and is looked up as a package name instead.
    return arg.includes("://") || arg.startsWith("./") || isAbsolute(arg);
  }

  private async executeNoArg(options: PluginInstallOptions): Promise<PluginInstallResult> {
    if (!options.interactive) throw new InteractiveOnlyError("plugin install");
    const result = await this.pickPlugin.execute({
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: true,
    });
    return { kind: "picked", installed: result.installed };
  }

  private async executeLocalSource(options: PluginInstallOptions): Promise<PluginInstallResult> {
    const source = parsePluginSourceShorthand(options.pluginArg as string);
    await this.trustPluginSource.execute({
      projectRoot: options.projectRoot,
      source,
      yes: options.yes,
    });
    await this.addPlugin.execute({
      source,
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: options.interactive,
    });
    return { kind: "local", installed: [] };
  }

  private async executeMarketplace(options: PluginInstallOptions): Promise<PluginInstallResult> {
    const { name, version } = parsePluginSpec(options.pluginArg as string);
    const result = await this.installFromMarketplace.execute({
      pluginName: name,
      version,
      fromMarketplace: options.fromMarketplace,
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: options.interactive,
      autoSelect: options.yes ?? false,
    });
    return { kind: "marketplace", installed: [result.entry.name] };
  }
}
