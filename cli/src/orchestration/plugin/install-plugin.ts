import { isAbsolute } from "node:path";
import type { PluginAdd } from "../../contexts/installation/application/plugin/add/plugin-add.js";
import type {
  PlanPluginInstall,
  PlanPluginInstallCommand,
} from "../../contexts/installation/application/plugin/plan-plugin-install.js";
import { parsePluginSpec } from "../../contexts/installation/contract/plugin-spec.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import { parsePluginSourceShorthand } from "../domain/source-shorthand.model.js";
import { InteractiveOnlyError } from "../orchestration.error.js";
import type { ConfirmPluginSourceTrust } from "./confirm-plugin-source-trust.js";
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

export interface InstallPluginDeps {
  readonly planPluginInstall: Pick<PlanPluginInstall, "execute">;
  readonly pickPlugin: PickPlugin;
  readonly addPlugin: PluginAdd;
  readonly installFromMarketplace: PluginInstallFromMarketplace;
  readonly trustPluginSource: Pick<ConfirmPluginSourceTrust, "execute">;
}

/** Installs a plugin the way `plugin install` was asked: picked, from a source, or by name. */
export class InstallPlugin {
  constructor(private readonly deps: InstallPluginDeps) {}

  async execute(options: PluginInstallOptions): Promise<PluginInstallResult> {
    if (options.scope !== undefined) {
      await this.deps.planPluginInstall.execute({
        toolIds: options.toolIds,
        scope: options.scope,
      });
    }
    const { pluginArg } = options;
    if (pluginArg === undefined) return this.executeNoArg(options);
    if (this.isSourceArg(pluginArg)) return this.executeLocalSource(options, pluginArg);
    return this.executeMarketplace(options, pluginArg);
  }

  private isSourceArg(arg: string): boolean {
    // `isAbsolute` also catches a Windows-rooted path (`C:\...`, `\\server\share`), which
    // `startsWith("/")` never does - without it, a local Windows source falls through to
    // the marketplace branch below and is looked up as a package name instead.
    return arg.includes("://") || arg.startsWith("./") || isAbsolute(arg);
  }

  private async executeNoArg(options: PluginInstallOptions): Promise<PluginInstallResult> {
    if (!options.interactive) throw new InteractiveOnlyError("plugin install");
    const result = await this.deps.pickPlugin.execute({
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: true,
    });
    return { kind: "picked", installed: result.installed };
  }

  private async executeLocalSource(
    options: PluginInstallOptions,
    pluginArg: string
  ): Promise<PluginInstallResult> {
    const source = parsePluginSourceShorthand(pluginArg);
    await this.deps.trustPluginSource.execute({
      projectRoot: options.projectRoot,
      source,
      yes: options.yes,
    });
    await this.deps.addPlugin.execute({
      source,
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: options.interactive,
      githubMarketplace: false,
    });
    return { kind: "local", installed: [] };
  }

  private async executeMarketplace(
    options: PluginInstallOptions,
    pluginArg: string
  ): Promise<PluginInstallResult> {
    const { name, version } = parsePluginSpec(pluginArg);
    const result = await this.deps.installFromMarketplace.execute({
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
