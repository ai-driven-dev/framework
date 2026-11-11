import { mcpJsonToToml, mergeJsonUserPrime } from "../formats/mcp-format.js";

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

  format(): "json" | "toml" {
    return this.#params.format;
  }

  mergeStrategy(): "user-prime" | "framework-prime" | "none" {
    return this.#params.mergeStrategy ?? "user-prime";
  }

  isFrameworkPrime(): boolean {
    return this.mergeStrategy() === "framework-prime";
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

  /** The tool's own rewrite of the server entries, before any format conversion; unchanged when it has none. */
  transformContent(mcpJson: string): string {
    return this.#params.transformContent ? this.#params.transformContent(mcpJson) : mcpJson;
  }

  transform(mcpJson: string): string {
    const afterTransform = this.transformContent(mcpJson);
    if (this.#params.format === "toml") {
      return mcpJsonToToml(afterTransform);
    }
    return afterTransform;
  }

  /** `null` when the tool's output path is the fixed `outputPath`. */
  outputPathCandidates(): McpOutputPathCandidates | null {
    return this.#params.outputPathCandidates ?? null;
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
