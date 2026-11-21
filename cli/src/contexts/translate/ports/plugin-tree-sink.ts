import type {
  SourceMarketplaceRef,
  ToolBuildContract,
} from "../../tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";

/** What a build writes and how: the tool's contract, the layout, and whether it may overwrite. */
export interface DiskLayout {
  readonly contract: ToolBuildContract;
  readonly mode: FrameworkBuildMode;
  readonly force: boolean;
}

/** A layout aimed at one source tree and one output directory, both absolute. */
export interface DiskTarget extends DiskLayout {
  readonly sourceDir: string;
  readonly outDir: string;
}

/** What writing one plugin leaves for the sink's close. */
export interface PluginWritten {
  readonly files: number;
  /** The plugin's MCP declaration, plugin-root references resolved into the output, when a flat
   * build needs it for the tool's config. */
  readonly declaredMcp: string | null;
}

/** A plugin once written, as the close of the tree sees it. */
export interface BuiltPlugin {
  readonly name: string;
  readonly declaredMcp?: string | null;
}

/** Where a build puts its output: prepare the directory, write each plugin, then close the tree. */
export interface PluginTreeSink {
  prepare(target: DiskTarget): Promise<void>;
  writePlugin(target: DiskTarget, pluginName: string, pluginSrc: string): Promise<PluginWritten>;
  /** Once every plugin is built; returns the extra files written. */
  finish(
    target: DiskTarget,
    sourceMarketplace: SourceMarketplaceRef,
    builtPlugins: readonly BuiltPlugin[]
  ): Promise<number>;
}
