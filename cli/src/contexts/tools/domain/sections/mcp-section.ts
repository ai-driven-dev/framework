import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { ConfigRef } from "../../contract/config-refs.js";
import { DualConfigError } from "../../contract/errors/tools.error.js";
import type { ConfigFilePlace } from "../../contract/tool-profile.js";
import { type JsonWriter, keepingComments } from "../formats/json-writer.js";
import {
  mcpJsonToToml,
  mergeJsonUserPrime,
  transformMcpForWin32,
} from "../formats/mcp/mcp-format.js";
import { presentUpToFirstTier } from "../formats/mcp/present-up-to-first-tier.js";
import { addTypedInstruction, removeTypedInstruction } from "../formats/mcp/typed-instructions.js";
import {
  buildTypedMcpFlatConfig,
  mergeTypedMcp,
  unmergeTypedMcp,
} from "../formats/mcp/typed-mcp-merge.js";
import type { TomlCodec } from "../formats/toml.js";

/** The config files a tool's MCP output may already live in. Tiers are tried in order; within the
 * first tier that has any file present, one present file is the answer and several are refused
 * with a dual-config error naming `toolId` and `detail`. `fallback` answers when no tier has a
 * file. Refusing is the one policy a tool has declared; taking the first of several is left
 * unwritten until a tool needs it. */
export type McpOutputPathCandidates = {
  readonly tiers: readonly (readonly string[])[];
  readonly fallback: string;
  readonly onMultipleCandidates: {
    readonly error: { readonly toolId: string; readonly detail: string };
  };
};

/** The file an MCP config goes in: the only present file of the first tier that has any, the
 * fallback when none does. Several in that tier raise the declared dual-config error. */
export function chooseOutputPath(
  candidates: McpOutputPathCandidates,
  exists: (relativePath: string) => boolean
): string {
  for (const tier of candidates.tiers) {
    const present = tier.filter(exists);
    const { toolId, detail } = candidates.onMultipleCandidates.error;
    if (present.length > 1) throw new DualConfigError(toolId, detail);
    if (present[0] !== undefined) return present[0];
  }
  return candidates.fallback;
}

/** A TOML file is written through the codec the profile was given. */
export type McpConfigParams = ({ format: "json" } | { format: "toml"; toml: TomlCodec }) & {
  outputPath: string;
  mergeStrategy?: "user-prime" | "framework-prime" | "none";
  mergeFn?: (existing: string, incoming: string) => string;
  transformContent?: (content: string) => string;
  outputPathCandidates?: McpOutputPathCandidates;
  consumes?: readonly ConfigRef[];
  /** Rewrites the config in place, keeping what a person wrote around it; plain JSON when absent. */
  writer?: JsonWriter;
};

/** The file a tool's own MCP servers are written to, and how it is merged and converted. */
export class McpConfigPart {
  readonly #params: McpConfigParams;

  constructor(params: McpConfigParams) {
    this.#params = params;
  }

  consumes(configName: string): boolean {
    return this.#params.consumes?.some((ref) => ref.name === configName) ?? false;
  }

  /** Every config artifact this file takes in, with where the canonical source keeps it. */
  consumedRefs(): readonly ConfigRef[] {
    return (this.#params.consumes ?? []).map((ref) => ({ ...ref }));
  }

  fileOf(content: string, place: ConfigFilePlace = {}): InstallationFile {
    const { outputPath, mergeStrategy = "user-prime" } = this.#params;
    return InstallationFile.placed(content, place, { outputPath, mergeStrategy });
  }

  /** Whether the framework's half of the file is written over what a person keeps in it. */
  isFrameworkPrime(): boolean {
    return this.#params.mergeStrategy === "framework-prime";
  }

  /** Whether `fileName` is the JSON file this tool shares with a person, the framework's half of
   * it written over theirs. */
  isFrameworkPrimeJson(fileName: string): boolean {
    return (
      this.#params.outputPath === fileName &&
      this.#params.format === "json" &&
      this.isFrameworkPrime()
    );
  }

  /** The tool's own rewrite of the server entries, then the conversion to its file format. */
  transform(mcpJson: string): string {
    const afterTransform = this.#params.transformContent
      ? this.#params.transformContent(mcpJson)
      : mcpJson;
    if (this.#params.format === "toml") return mcpJsonToToml(this.#params.toml, afterTransform);
    return afterTransform;
  }

  /** How a server launch is rewritten for `platform` in the canonical config, before the tool's
   * own transform, or undefined when the platform needs none. */
  launchTransformFor(platform: string): ((content: string) => string) | undefined {
    return platform === "win32" ? transformMcpForWin32 : undefined;
  }

  /** The project-relative file this tool's MCP config goes in: the candidate a project already
   * keeps (reusing user-owned configuration), the fallback when none does. A tier is only asked
   * about while no earlier tier has a file. */
  async resolveOutputPath(exists: (relativePath: string) => Promise<boolean>): Promise<string> {
    const candidates = this.#params.outputPathCandidates;
    if (candidates === undefined) return this.#params.outputPath;
    const present = await presentUpToFirstTier(candidates.tiers, exists);
    return chooseOutputPath(candidates, (path) => present.has(path));
  }

  /** Adds the plugin's transformed servers to the existing file: what the plugin contributed
   * before is replaced, a user-owned server is kept and reported as a collision. */
  mergePluginServers(
    existing: string | null,
    incomingTransformed: string,
    previousEntries: ReadonlyMap<string, string>
  ): ReturnType<typeof mergeTypedMcp> {
    const merged = mergeTypedMcp(existing, incomingTransformed, previousEntries);
    const mergedContent = keepingComments(this.#params.writer, existing, merged.mergedContent);
    return { ...merged, mergedContent };
  }

  /** Removes the servers a plugin contributed, refusing one edited since. */
  removePluginServers(existing: string, entries: ReadonlyMap<string, string>): string {
    return keepingComments(this.#params.writer, existing, unmergeTypedMcp(existing, entries));
  }

  withInstruction(existing: string | null, glob: string): string {
    return keepingComments(this.#params.writer, existing, addTypedInstruction(existing, glob));
  }

  withoutInstruction(existing: string, glob: string): string {
    return keepingComments(this.#params.writer, existing, removeTypedInstruction(existing, glob));
  }

  /** The tool's framework-owned config merged over what a person already keeps in the file. */
  frameworkConfigOver(
    baseConfig: string,
    existing: string | null,
    incoming: Record<string, unknown>
  ): string {
    return buildTypedMcpFlatConfig({ baseConfig, existing, incoming });
  }

  merge(existing: string, incoming: string): string {
    if (this.#params.mergeFn !== undefined) {
      return this.#params.mergeFn(existing, incoming);
    }
    if (this.#params.mergeStrategy === "none") {
      return incoming;
    }
    return mergeJsonUserPrime(existing, incoming);
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.#params.outputPath;
  }

  equals(other: McpConfigPart): boolean {
    return (
      this.#params.outputPath === other.#params.outputPath &&
      this.#params.format === other.#params.format &&
      this.#params.mergeStrategy === other.#params.mergeStrategy
    );
  }
}

/** Whether the tool takes a plugin's MCP file, and where it lands in the plugin directory. */
export interface McpPluginPart {
  readonly accepts: boolean;
  readonly relativePath: string;
}

export const DEFAULT_PLUGIN_MCP_PATH = ".mcp.json";

/** A tool that takes a plugin's MCP file, landing it at `relativePath` in the plugin directory. */
export function acceptedPluginMcp(relativePath: string = DEFAULT_PLUGIN_MCP_PATH): McpPluginPart {
  return { accepts: true, relativePath };
}

/** What a tool declares about MCP: the file it writes, the file a plugin delivers, or both. */
export interface McpSection {
  readonly config?: McpConfigPart;
  readonly plugin?: McpPluginPart;
}
