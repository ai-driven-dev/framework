import { join } from "node:path";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../../shared/domain/source.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/project-layout.js";
import type { LoadDistribution } from "../../../ports/plugin/load-plugin-distribution.js";
import { resolvePluginTranslator } from "../../materialize/resolve-plugin-translator.js";
import type { BuiltMaterializationDeps } from "../../shared/built-materialization-deps.js";

export interface ResolveAddedPluginSourceRequest {
  readonly source: PluginSource;
  readonly projectRoot: string;
  readonly toolIds: readonly AiToolId[];
  /** Whether the plugin is added from a github marketplace. */
  readonly githubMarketplace: boolean;
  /** What the marketplace catalog says of the plugin, when it says anything. */
  readonly catalog?: { readonly version?: string };
}

/** The tools of an add, by how they take a plugin. */
interface ToolsByTranslation {
  /** The tools that take a plugin's files as they are. */
  readonly flat: AiToolId[];
  /** The tools that take a translated plugin, or none. */
  readonly native: AiToolId[];
}

/** A plugin added from anywhere but a github marketplace: its files are placed, so it is read. */
export interface LocalAddedPluginSource {
  readonly isGithubMarketplace: false;
  readonly distribution: PluginDistribution;
}

/** A plugin added from a github marketplace, whose native tools register without a fetch. The
 * distribution is read once, and only when a flat tool or a missing catalog version asks for it. */
export interface GithubAddedPluginSource extends ToolsByTranslation {
  readonly isGithubMarketplace: true;
  readonly distribution: PluginDistribution | undefined;
  /** The catalog's version, else plugin.json's. Unknown only when nothing needs it. */
  readonly version: string | undefined;
}

export type ResolveAddedPluginSourceResult = LocalAddedPluginSource | GithubAddedPluginSource;

/** What ResolveAddedPluginSource is built from. */
export interface ResolveAddedPluginSourceDeps {
  readonly loadDistribution: LoadDistribution;
  readonly fs: FileWriter & FileReader;
  readonly built: BuiltMaterializationDeps;
}

/** Answers where an added plugin comes from: its marketplace, which tools take its files flat,
 * and, when the add needs them, its distribution and version. */
export class ResolveAddedPluginSource {
  constructor(
    private readonly deps: ResolveAddedPluginSourceDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: ResolveAddedPluginSourceRequest): Promise<ResolveAddedPluginSourceResult> {
    const { source, projectRoot, toolIds, githubMarketplace, catalog } = command;
    if (!githubMarketplace) {
      return { isGithubMarketplace: false, distribution: await this.read(source, projectRoot) };
    }
    const isFlat = (toolId: AiToolId): boolean =>
      resolvePluginTranslator(this.tools.aiProfile(toolId), {
        fs: this.deps.fs,
        built: this.deps.built,
      })?.mode === "flat";
    const flat = toolIds.filter(isFlat);
    const native = toolIds.filter((toolId) => !isFlat(toolId));
    // Without a catalog entry a github add is refused before it places anything.
    const needsDistribution =
      catalog !== undefined && (flat.length > 0 || (native.length > 0 && !catalog.version));
    const distribution = needsDistribution ? await this.read(source, projectRoot) : undefined;
    return {
      isGithubMarketplace: true,
      flat,
      native,
      distribution,
      version: catalog?.version || distribution?.manifest.version,
    };
  }

  private read(source: PluginSource, projectRoot: string): Promise<PluginDistribution> {
    return this.deps.loadDistribution(source, join(projectRoot, PLUGIN_CACHE_SUBDIR));
  }
}
