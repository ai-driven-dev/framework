import type { ArtifactContract, ToolBuildContract } from "../../tools/contract/build-contract.js";

export type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;
/** What a flat MCP merge needs of its artifact: the merge, and where its file lives. */
export type FlatMcpTarget = Required<Pick<SupportedArtifact, "merge" | "mergeDest">>;

/** What a flat write needs of a build: the contract, the overwrite flag and both directories. */
export interface FlatTarget {
  readonly contract: ToolBuildContract;
  readonly force: boolean;
  readonly sourceDir: string;
  readonly outDir: string;
}

/** One plugin's source file of one artifact, aimed at a flat target. */
export interface FlatArtifactStep {
  readonly target: FlatTarget;
  readonly artifact: SupportedArtifact;
  readonly pluginName: string;
}

export interface FlatFileStep extends FlatArtifactStep {
  readonly absPath: string;
  /** The folder of the plugin's source holding `absPath`. */
  readonly srcRoot: string;
}

export interface FlatHooksStep extends FlatArtifactStep {
  readonly hooksSrc: string;
  readonly pluginSrc: string;
}

export interface FlatMcpStep {
  readonly target: FlatTarget;
  readonly mcp: FlatMcpTarget;
  readonly pluginName: string;
  readonly mcpSrc: string;
}

/** Writes a built plugin into one flat tool directory, merging into the files other plugins share. */
export interface FlatPluginWriter {
  /** Once every plugin is built: the tool's config artefact. Returns the files written. */
  writeConfig(target: FlatTarget, builtPlugins: readonly { name: string }[]): Promise<number>;
  writeAgent(step: FlatFileStep): Promise<number>;
  writeSkill(step: FlatFileStep): Promise<number>;
  /** One plugin's hooks: the hooks file or the bridge, then the scripts it points at. */
  writeHooks(step: FlatHooksStep): Promise<number>;
  writeMcp(step: FlatMcpStep): Promise<number>;
}
