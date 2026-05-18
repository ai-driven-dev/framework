import { InteractiveOnlyError } from "../../../domain/errors.js";
import { parsePluginSourceShorthand } from "../../../domain/models/plugin-source.js";
import { parsePluginSpec } from "../../../domain/models/plugin.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { PluginAddUseCase } from "./plugin-add-use-case.js";
import type { PluginInstallFromMarketplaceUseCase } from "./plugin-install-from-marketplace-use-case.js";
import type { PluginPickUseCase } from "./plugin-pick-use-case.js";

export interface PluginInstallOptions {
  pluginArg: string | undefined;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  fromMarketplace?: string;
  token?: string;
  yes?: boolean;
}

export interface PluginInstallResult {
  kind: "picked" | "local" | "marketplace";
  installed: readonly string[];
}

export class PluginInstallUseCase {
  constructor(
    private readonly pluginPickUseCase: PluginPickUseCase,
    private readonly pluginAddUseCase: PluginAddUseCase,
    private readonly pluginInstallFromMarketplaceUseCase: PluginInstallFromMarketplaceUseCase
  ) {}

  async execute(options: PluginInstallOptions): Promise<PluginInstallResult> {
    if (options.pluginArg === undefined) return this.executeNoArg(options);
    if (this.isSourceArg(options.pluginArg)) return this.executeLocalSource(options);
    return this.executeMarketplace(options);
  }

  private isSourceArg(arg: string): boolean {
    return arg.includes("://") || arg.startsWith("/") || arg.startsWith("./");
  }

  private async executeNoArg(options: PluginInstallOptions): Promise<PluginInstallResult> {
    if (!options.interactive) throw new InteractiveOnlyError("plugin install");
    const result = await this.pluginPickUseCase.execute({
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: true,
    });
    return { kind: "picked", installed: result.installed };
  }

  private async executeLocalSource(options: PluginInstallOptions): Promise<PluginInstallResult> {
    const source = parsePluginSourceShorthand(options.pluginArg as string);
    await this.pluginAddUseCase.execute({
      source,
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: options.interactive,
    });
    return { kind: "local", installed: [] };
  }

  private async executeMarketplace(options: PluginInstallOptions): Promise<PluginInstallResult> {
    const { name, version } = parsePluginSpec(options.pluginArg as string);
    if (options.token) process.env.AIDD_TOKEN = options.token;
    const result = await this.pluginInstallFromMarketplaceUseCase.execute({
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
