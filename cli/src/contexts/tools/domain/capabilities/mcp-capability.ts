import type { Hasher } from "../../../../kernel/ports/hasher.js";
import { mcpJsonToToml, mergeJsonUserPrime } from "../formats/mcp-format.js";
import {
  buildOpencodeFlatConfig,
  mergeOpencodeMcp,
  unmergeOpencodeMcp,
} from "../formats/opencode-mcp-merge.js";

/** The config files a tool's MCP output may already live in. Tiers are tried in order; within the
 * first tier that has any file present, two present files make `conflict` throw, one is the answer.
 * `fallback` answers when no tier has a file. */
export type McpOutputPathCandidates = {
  readonly tiers: readonly (readonly string[])[];
  readonly fallback: string;
  readonly conflict: () => never;
};

type McpCapabilityParams = {
  outputPath: string;
  format: "json" | "toml";
  mergeStrategy?: "user-prime" | "framework-prime" | "none";
  mergeFn?: (existing: string, incoming: string) => string;
  transformContent?: (content: string) => string;
  outputPathCandidates?: McpOutputPathCandidates;
  consumes?: readonly string[];
};

export class McpCapability {
  readonly #params: McpCapabilityParams;

  constructor(params: McpCapabilityParams) {
    this.#params = params;
  }

  consumes(configName: string): boolean {
    return this.#params.consumes?.includes(configName) ?? false;
  }

  outputPath(): string {
    return this.#params.outputPath;
  }

  mergeStrategy(): "user-prime" | "framework-prime" | "none" {
    return this.#params.mergeStrategy ?? "user-prime";
  }

  /** Whether `fileName` is the JSON file this tool shares with a person, the framework's half of
   * it written over theirs. */
  isFrameworkPrimeJson(fileName: string): boolean {
    return (
      this.#params.outputPath === fileName &&
      this.#params.format === "json" &&
      this.mergeStrategy() === "framework-prime"
    );
  }

  /** The tool's own rewrite of the server entries, then the conversion to its file format. */
  transform(mcpJson: string): string {
    const afterTransform = this.#params.transformContent
      ? this.#params.transformContent(mcpJson)
      : mcpJson;
    if (this.#params.format === "toml") {
      return mcpJsonToToml(afterTransform);
    }
    return afterTransform;
  }

  /** The project-relative file this tool's MCP config goes in: the first tier of candidates for
   * which `exists` answers true (reusing user-owned configuration), the fallback when none does.
   * Two files in the answering tier raise the declared conflict. */
  async resolveOutputPath(exists: (relativePath: string) => Promise<boolean>): Promise<string> {
    const candidates = this.#params.outputPathCandidates;
    if (candidates === undefined) return this.#params.outputPath;
    for (const tier of candidates.tiers) {
      const present: string[] = [];
      for (const candidate of tier) {
        if (await exists(candidate)) present.push(candidate);
      }
      if (present.length > 1) candidates.conflict();
      if (present.length === 1) return present[0] as string;
    }
    return candidates.fallback;
  }

  /** Adds the plugin's transformed servers to the existing file: what the plugin contributed
   * before is replaced, a user-owned server is kept and reported as a collision. */
  mergePluginServers(
    existing: string | null,
    incomingTransformed: string,
    previousEntries: ReadonlyMap<string, string>,
    hasher: Hasher
  ): ReturnType<typeof mergeOpencodeMcp> {
    return mergeOpencodeMcp(existing, incomingTransformed, previousEntries, hasher);
  }

  /** Removes the servers a plugin contributed, refusing one edited since. */
  removePluginServers(existing: string, entries: ReadonlyMap<string, string>): string {
    return unmergeOpencodeMcp(existing, entries);
  }

  /** The tool's framework-owned config merged over what a person already keeps in the file. */
  frameworkConfigOver(
    baseConfig: string,
    existing: string | null,
    incoming: Record<string, unknown>,
    mergedKeys: readonly string[] = []
  ): string {
    return buildOpencodeFlatConfig(baseConfig, existing, incoming, mergedKeys);
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

  equals(other: McpCapability): boolean {
    return (
      this.#params.outputPath === other.#params.outputPath &&
      this.#params.format === other.#params.format &&
      this.#params.mergeStrategy === other.#params.mergeStrategy
    );
  }
}
