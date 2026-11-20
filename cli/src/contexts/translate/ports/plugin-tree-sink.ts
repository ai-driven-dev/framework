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

/** Where a build puts its output: prepare the directory, write each plugin, then close the tree. */
export interface PluginTreeSink {
  prepare(target: DiskTarget): Promise<void>;
  /** Returns the files written for the plugin. */
  writePlugin(target: DiskTarget, pluginName: string, pluginSrc: string): Promise<number>;
  /** Once every plugin is built; returns the extra files written. */
  finish(
    target: DiskTarget,
    sourceMarketplace: SourceMarketplaceRef,
    builtPlugins: readonly { name: string }[]
  ): Promise<number>;
}
