import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { ReadonlyNoticeList } from "../../../../../shared/domain/materialization/plugin-install-notice.js";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { PluginSource } from "../../../../../shared/domain/plugin/source.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../../tools/contract/tool-vocabulary.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/plugin-entry.js";
import { RecordedPlugin } from "../../../domain/plugins/recorded-plugin.js";
import type { EnsurePluginRuntimeFiles } from "../../install/config/ensure-plugin-runtime-files.use-case.js";
import type { BuiltPlacement } from "../../materialize/add-plugin-request.js";
import { placementModeOf } from "../../materialize/plugin-placement.js";
import { registerMarketplacePlugin } from "../../materialize/register-marketplace-plugin.js";
import { hashOutputFiles } from "../../shared/hash-output-files.js";
import { writePluginFiles } from "../files/write-plugin-files.js";
import { resolveScopeForInstall } from "../plugin-target-resolution.js";
import type { FindForeignUserScopeDir } from "./foreign-user-scope-dir.js";
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

/** What placing one tool's files reports. */
export interface Placement {
  readonly skipped: ReadonlySkipList;
  readonly notices: ReadonlyNoticeList;
}

/** What the placement of one tool starts from. */
export interface ToolPlacement {
  readonly command: PlacePluginRequest;
  readonly tool: AiToolProfile;
  readonly userScopeDirTaken: boolean;
}

/** Places one tool's files: from its built tree, or natively from a fresh translation. */
export type PlaceForTool = (placement: ToolPlacement) => Promise<Placement>;

/** What placing one tool's files reaches. */
export type ToolPlacementDeps = Pick<BuiltPlacement, "translate" | "placeBuiltTree"> & {
  readonly fs: FileWriter;
};

/** The per-tool placement, bound to what it reaches. */
export function toolPlacementOf(deps: ToolPlacementDeps): PlaceForTool {
  return (placement) => placeForTool(placement, deps);
}

/** What PlacePlugin is built from. */
export interface PlacePluginDeps {
  readonly logger: Logger;
  readonly findForeignDir: FindForeignUserScopeDir;
  readonly placeForTool: PlaceForTool;
  readonly pluginRuntime?: Pick<EnsurePluginRuntimeFiles, "execute">;
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
      await this.deps.pluginRuntime?.execute(tool, projectRoot, manifest);
      const foreignDir = await this.deps.findForeignDir(command, tool);
      if (foreignDir !== undefined) {
        this.deps.logger.warn(
          `${toolId}: ${foreignDir} was already there and this project did not install it — left as found and not tracked, so this project's clean will not delete it.`
        );
      }
      const { skipped, notices } = await this.deps.placeForTool({
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
}

async function placeForTool(placement: ToolPlacement, deps: ToolPlacementDeps): Promise<Placement> {
  const { command, tool, userScopeDirTaken } = placement;
  const { dist, source, projectRoot, manifest, marketplace } = command;
  const mode = placementModeOf(tool);
  if (mode === "built-tree") {
    const request = {
      dist,
      tool,
      source,
      projectRoot,
      manifest,
      marketplace,
      previousMcpEntries: command.previousMcpEntries.get(tool.toolId) ?? new Map(),
      userScopeDirTaken,
      previousProjectHooks: command.previousProjectHooks.get(tool.toolId),
    };
    const result = await deps.placeBuiltTree(request);
    return { ...result, notices: [] };
  }
  const output = deps.translate.execute({ distribution: dist, tool });
  return materializeNativePlugin(
    placement,
    { ...output, mode, files: hashOutputFiles(output.files) },
    deps.fs
  );
}

// `notices` survives every branch below, including the marketplace one that discards its
// own `translated.skipped` in favor of the registration's: a delivered hook's trust notice is
// a fact about the tool, not about which materialization route happened to run.
async function materializeNativePlugin(
  placement: ToolPlacement,
  translated: {
    mode: PluginTranslationMode | null;
    files: InstallationFile[];
    componentPaths: ReadonlyMap<string, string>;
    skipped: ReadonlySkipList;
    notices: ReadonlyNoticeList;
  },
  fs: FileWriter
): Promise<Placement> {
  const { command, tool } = placement;
  const { dist, source, projectRoot, manifest, marketplace } = command;
  const { mode, files, componentPaths, skipped, notices } = translated;
  if (files.length === 0) return { skipped, notices };
  if (mode === "marketplace" && source.kind === "local" && marketplace !== undefined) {
    const request = { dist, tool, source, projectRoot, manifest, marketplace };
    return { ...registerMarketplacePlugin(request), notices };
  }
  await writePluginFiles(files, projectRoot, fs);
  manifest.addPlugin(
    tool.toolId,
    RecordedPlugin.fromDistribution({
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
