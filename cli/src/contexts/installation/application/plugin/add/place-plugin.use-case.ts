import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { PluginSource } from "../../../../../shared/domain/source.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { ReadonlyNoticeList } from "../../../../tools/contract/plugin-install-notice.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../../domain/manifest.js";
import { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/plugin-entry.js";
import type { InstallRuntimeConfig } from "../../install/config/install-runtime-config.use-case.js";
import type { PluginTranslator } from "../../materialize/plugin-translator.js";
import { resolvePluginTranslator } from "../../materialize/resolve-plugin-translator.js";
import type { BuiltMaterializationDeps } from "../../shared/built-materialization-deps.js";
import { hashOutputFiles } from "../../shared/hash-output-files.js";
import { resolveScopeForInstall } from "../plugin-target-resolution.js";
import { writePluginFiles } from "../write-plugin-files.js";
import { foreignUserScopeDir } from "./foreign-user-scope-dir.js";
import { reportInstallNotices, reportSkipWarnings } from "./report-placement.js";

/** A distribution to place for each tool, and what the project already holds of it. */
export interface PlacePluginRequest {
  readonly dist: PluginDistribution;
  readonly toolIds: readonly AiToolId[];
  readonly source: PluginSource;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  /** The user-scope owner of a plugin: placing leaves a user directory it does not own as found. */
  readonly machine: Manifest;
  readonly marketplace: string | undefined;
  readonly previousMcpEntries: ReadonlyMap<AiToolId, ReadonlyMap<string, string>>;
  readonly previousProjectHooks: ReadonlyMap<AiToolId, ProjectHooksProvenance>;
}

interface Placement {
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
}

/** What the placement of one tool starts from. */
interface ToolPlacement {
  readonly command: PlacePluginRequest;
  readonly tool: AiToolProfile;
  readonly userScopeDirTaken: boolean;
}

/** What PlacePlugin is built from. */
export interface PlacePluginDeps {
  readonly fs: FileWriter & FileReader;
  readonly logger: Logger;
  readonly built: BuiltMaterializationDeps;
  readonly pluginRuntime?: Pick<InstallRuntimeConfig, "ensurePluginRuntimeFiles">;
}

/** Puts a plugin's files in place for each tool and records the plugin in the project manifest. */
export class PlacePlugin {
  constructor(
    private readonly deps: PlacePluginDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: PlacePluginRequest): Promise<void> {
    const { dist, toolIds, projectRoot, manifest, machine } = command;
    const allSkipped: ReadonlySkipList[] = [];
    const allNotices: ReadonlyNoticeList[] = [];
    for (const toolId of toolIds) {
      const tool = this.tools.aiProfile(toolId);
      await this.deps.pluginRuntime?.ensurePluginRuntimeFiles(tool, projectRoot, manifest);
      const foreignDir = await foreignUserScopeDir({
        fs: this.deps.fs,
        command,
        tool,
        homedir: this.deps.built.homedir,
      });
      if (foreignDir !== undefined) {
        this.deps.logger.warn(
          `${toolId}: ${foreignDir} was already there and this project did not install it — left as found and not tracked, so this project's clean will not delete it.`
        );
      }
      const { skipped, notices } = await this.placeForTool({
        command,
        tool,
        userScopeDirTaken:
          foreignDir !== undefined ||
          machine.getPlugins(toolId).some((p) => p.name === dist.manifest.name),
      });
      allSkipped.push(skipped);
      allNotices.push(notices);
    }
    reportSkipWarnings(this.deps.logger, allSkipped.flat());
    reportInstallNotices(this.deps.logger, allNotices.flat());
  }

  private async placeForTool(placement: ToolPlacement): Promise<Placement> {
    const { command, tool, userScopeDirTaken } = placement;
    const { dist, source, projectRoot, manifest, marketplace } = command;
    const adapter = resolvePluginTranslator(tool, this.deps.built.translators);
    if (adapter?.mode === "flat") {
      const result = await adapter.addPlugin({
        dist,
        tool,
        source,
        projectRoot,
        manifest,
        marketplace,
        previousMcpEntries: command.previousMcpEntries.get(tool.toolId) ?? new Map(),
        userScopeDirTaken,
        previousProjectHooks: command.previousProjectHooks.get(tool.toolId),
      });
      return { ...result, notices: [] };
    }
    const output = this.deps.built.translate.execute({ distribution: dist, tool });
    return this.materializeNativePlugin(placement, adapter, {
      ...output,
      files: hashOutputFiles(output.files),
    });
  }

  // `notices` survives every branch below, including the marketplace one that discards its
  // own `translated.skipped` in favor of the adapter's: a delivered hook's trust notice is
  // a fact about the tool, not about which materialization route happened to run.
  private async materializeNativePlugin(
    placement: ToolPlacement,
    adapter: PluginTranslator | null,
    translated: {
      files: InstallationFile[];
      componentPaths: ReadonlyMap<string, string>;
      skipped: ReadonlySkipList;
      notices: ReadonlyNoticeList;
    }
  ): Promise<Placement> {
    const { command, tool } = placement;
    const { dist, source, projectRoot, manifest, marketplace } = command;
    const { files, componentPaths, skipped, notices } = translated;
    if (files.length === 0) return { skipped, notices };
    if (adapter?.mode === "marketplace" && source.kind === "local" && marketplace !== undefined) {
      const result = await adapter.addPlugin({
        dist,
        tool,
        source,
        projectRoot,
        manifest,
        marketplace,
      });
      return { ...result, notices };
    }
    await writePluginFiles(files, projectRoot, this.deps.fs);
    manifest.addPlugin(
      tool.toolId,
      InstalledPlugin.fromDistribution({
        dist,
        source,
        files,
        scope: resolveScopeForInstall(tool),
        componentPaths,
        marketplace,
      })
    );
    return { skipped, notices };
  }
}
